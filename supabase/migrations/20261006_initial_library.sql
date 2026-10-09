-- Ejecutar una sola vez en el SQL Editor de Supabase.
-- Los IDs OL...W identifican obras de Open Library, NO su disponibilidad física.

create extension if not exists pgcrypto;

create table if not exists public.library_books (
  work_id text primary key check (work_id ~ '^OL[0-9]+W$'),
  total_copies integer not null check (total_copies > 0),
  available_copies integer not null check (available_copies between 0 and total_copies),
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id text not null references public.library_books(work_id),
  title text not null check (char_length(title) between 1 and 250),
  author text not null check (char_length(author) between 1 and 250),
  cover_id integer,
  borrowed_at timestamptz not null default now(),
  due_at timestamptz not null,
  returned_at timestamptz,
  constraint return_after_borrow check (returned_at is null or returned_at >= borrowed_at)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id text not null references public.library_books(work_id),
  title text not null check (char_length(title) between 1 and 250),
  author text not null check (char_length(author) between 1 and 250),
  cover_id integer,
  status text not null default 'waiting' check (status in ('waiting', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.reading_list (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id text not null check (work_id ~ '^OL[0-9]+W$'),
  title text not null check (char_length(title) between 1 and 250),
  author text not null check (char_length(author) between 1 and 250),
  cover_id integer,
  status text not null check (status in ('want_to_read', 'reading', 'finished')),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

create unique index if not exists loans_one_active_per_user_book
  on public.loans (user_id, work_id) where returned_at is null;
create unique index if not exists reservations_one_waiting_per_user_book
  on public.reservations (user_id, work_id) where status = 'waiting';
create index if not exists loans_user_id_idx on public.loans (user_id);
create index if not exists reservations_user_id_idx on public.reservations (user_id);
create index if not exists reservations_queue_idx on public.reservations (work_id, created_at, id) where status = 'waiting';

alter table public.library_books enable row level security;
alter table public.loans enable row level security;
alter table public.reservations enable row level security;
alter table public.reading_list enable row level security;

revoke all on public.library_books, public.loans, public.reservations, public.reading_list from anon, authenticated;
grant select on public.library_books to anon, authenticated;
grant select on public.loans, public.reservations to authenticated;
grant select, insert, update, delete on public.reading_list to authenticated;

create policy "Public inventory is readable" on public.library_books
  for select to anon, authenticated using (true);
create policy "Users can read own loans" on public.loans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read own reservations" on public.reservations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can read own reading list" on public.reading_list
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add own reading list" on public.reading_list
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own reading list" on public.reading_list
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own reading list" on public.reading_list
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Las operaciones de inventario son transacciones protegidas: el cliente no puede
-- modificar directamente el número de ejemplares ni los préstamos/reservas.
create or replace function public.borrow_book(
  p_work_id text, p_title text, p_author text, p_cover_id integer default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_book public.library_books%rowtype;
  v_reservation public.reservations%rowtype;
  v_loan_id uuid;
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_work_id !~ '^OL[0-9]+W$' or char_length(p_title) not between 1 and 250 or char_length(p_author) not between 1 and 250 then
    raise exception 'Datos del libro inválidos.';
  end if;
  select * into v_book from public.library_books where work_id = p_work_id for update;
  if not found then raise exception 'Este libro no pertenece a la colección.'; end if;
  if exists (select 1 from public.loans where user_id = v_user_id and work_id = p_work_id and returned_at is null) then
    raise exception 'Ya tienes un préstamo activo de esta obra.';
  end if;
  if v_book.available_copies < 1 then raise exception 'No hay ejemplares disponibles; puedes reservarlo.'; end if;
  select * into v_reservation from public.reservations
    where work_id = p_work_id and status = 'waiting'
    order by created_at, id limit 1 for update;
  if found and v_reservation.user_id <> v_user_id then
    raise exception 'El próximo ejemplar está reservado para otra persona.';
  end if;
  update public.library_books set available_copies = available_copies - 1 where work_id = p_work_id;
  insert into public.loans (user_id, work_id, title, author, cover_id, due_at)
    values (v_user_id, p_work_id, p_title, p_author, p_cover_id, now() + interval '14 days') returning id into v_loan_id;
  if v_reservation.id is not null then
    update public.reservations set status = 'fulfilled' where id = v_reservation.id;
  end if;
  return v_loan_id;
end;
$$;

create or replace function public.reserve_book(
  p_work_id text, p_title text, p_author text, p_cover_id integer default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_book public.library_books%rowtype;
  v_reservation_id uuid;
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.'; end if;
  if p_work_id !~ '^OL[0-9]+W$' or char_length(p_title) not between 1 and 250 or char_length(p_author) not between 1 and 250 then
    raise exception 'Datos del libro inválidos.';
  end if;
  select * into v_book from public.library_books where work_id = p_work_id for update;
  if not found then raise exception 'Este libro no pertenece a la colección.'; end if;
  if v_book.available_copies > 0 then raise exception 'Hay ejemplares disponibles; solicita un préstamo.'; end if;
  if exists (select 1 from public.loans where user_id = v_user_id and work_id = p_work_id and returned_at is null) then
    raise exception 'Ya tienes esta obra en préstamo.';
  end if;
  if exists (select 1 from public.reservations where user_id = v_user_id and work_id = p_work_id and status = 'waiting') then
    raise exception 'Ya reservaste esta obra.';
  end if;
  insert into public.reservations (user_id, work_id, title, author, cover_id)
    values (v_user_id, p_work_id, p_title, p_author, p_cover_id) returning id into v_reservation_id;
  return v_reservation_id;
end;
$$;

create or replace function public.return_book(p_loan_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_work_id text;
  v_loan public.loans%rowtype;
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.'; end if;
  select work_id into v_work_id from public.loans where id = p_loan_id and user_id = v_user_id;
  if not found then raise exception 'Préstamo no encontrado.'; end if;
  perform 1 from public.library_books where work_id = v_work_id for update;
  select * into v_loan from public.loans where id = p_loan_id for update;
  if v_loan.returned_at is not null then raise exception 'Este préstamo ya fue devuelto.'; end if;
  update public.loans set returned_at = now() where id = p_loan_id;
  update public.library_books set available_copies = available_copies + 1 where work_id = v_work_id;
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.'; end if;
  update public.reservations set status = 'cancelled'
    where id = p_reservation_id and user_id = v_user_id and status = 'waiting';
  if not found then raise exception 'Reserva pendiente no encontrada.'; end if;
end;
$$;

revoke all on function public.borrow_book(text,text,text,integer) from public, anon;
revoke all on function public.reserve_book(text,text,text,integer) from public, anon;
revoke all on function public.return_book(uuid) from public, anon;
revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.borrow_book(text,text,text,integer) to authenticated;
grant execute on function public.reserve_book(text,text,text,integer) to authenticated;
grant execute on function public.return_book(uuid) to authenticated;
grant execute on function public.cancel_reservation(uuid) to authenticated;

-- Ejemplares de ejemplo. Sustituir por el inventario real de la institución.
insert into public.library_books (work_id, total_copies, available_copies) values
  ('OL27448W', 2, 2),
  ('OL45804W', 2, 2),
  ('OL18417W', 2, 2)
on conflict (work_id) do nothing;
