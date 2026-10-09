begin;
create table if not exists public.library_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.library_admins enable row level security;
revoke all on public.library_admins from public, anon, authenticated;

create or replace function public.is_library_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.library_admins where user_id = auth.uid());
$$;
revoke all on function public.is_library_admin() from public, anon;
grant execute on function public.is_library_admin() to authenticated;

alter table public.library_books add column if not exists title text;
alter table public.library_books add column if not exists author text;
alter table public.library_books add column if not exists cover_id integer;
alter table public.library_books add column if not exists retired boolean not null default false;

create or replace function public.admin_save_book(
 p_work_id text, p_title text, p_author text, p_cover_id integer,
 p_total_copies integer, p_retired boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare v_book public.library_books%rowtype; v_active integer;
begin
 if not public.is_library_admin() then raise exception 'Acceso exclusivo para administradores.'; end if;
 if p_work_id is null or p_work_id !~ '^OL[0-9]+W$' or p_title is null or char_length(trim(p_title)) not between 1 and 250
 or p_author is null or char_length(trim(p_author)) not between 1 and 250
 or p_total_copies is null or p_total_copies not between 1 and 10000 or p_retired is null
 or (p_cover_id is not null and p_cover_id < 1) then raise exception 'Datos del inventario inválidos.'; end if;
 -- Serialize creation as well as updates for a work; then share the row lock with lending.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_work_id, 0));
 select * into v_book from public.library_books where work_id=p_work_id for update;
 if found then
  select count(*) into v_active from public.loans where work_id=p_work_id and returned_at is null;
  if p_total_copies < v_active then raise exception 'No puedes reducir ejemplares por debajo de los préstamos activos (%).', v_active; end if;
  if p_retired and exists(select 1 from public.reservations where work_id=p_work_id and status='waiting') then
   raise exception 'Resuelve las reservas pendientes antes de retirar la obra.';
  end if;
  update public.library_books set title=trim(p_title), author=trim(p_author), cover_id=p_cover_id,
   total_copies=p_total_copies, available_copies=p_total_copies-v_active, retired=p_retired where work_id=p_work_id;
 else
  insert into public.library_books(work_id,title,author,cover_id,total_copies,available_copies,retired)
   values(p_work_id,trim(p_title),trim(p_author),p_cover_id,p_total_copies,p_total_copies,p_retired);
 end if;
end; $$;

create or replace function public.reject_retired_lending() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.library_books where work_id=new.work_id and retired=false for update;
 if not found then raise exception 'Esta obra está retirada de nuevos préstamos y reservas.'; end if;
 return new;
end; $$;
drop trigger if exists reject_retired_loans on public.loans;
create trigger reject_retired_loans before insert on public.loans for each row execute function public.reject_retired_lending();
drop trigger if exists reject_retired_reservations on public.reservations;
create trigger reject_retired_reservations before insert on public.reservations for each row execute function public.reject_retired_lending();
revoke all on function public.reject_retired_lending() from public,anon,authenticated;

create or replace function public.admin_dashboard() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_library_admin() then raise exception 'Acceso exclusivo para administradores.'; end if;
 return pg_catalog.jsonb_build_object(
 'books', coalesce((select jsonb_agg(b order by b.title,b.work_id) from public.library_books b),'[]'::jsonb),
 'loans', coalesce((select jsonb_agg(t order by t.due_at) from
  (select l.*,u.email from public.loans l join auth.users u on u.id=l.user_id where l.returned_at is null) t),'[]'::jsonb),
 'reservations', coalesce((select jsonb_agg(t order by t.created_at,t.id) from
  (select r.*,u.email from public.reservations r join auth.users u on u.id=r.user_id where r.status='waiting') t),'[]'::jsonb)
 );
end; $$;
revoke all on function public.admin_save_book(text,text,text,integer,integer,boolean) from public,anon;
revoke all on function public.admin_dashboard() from public,anon;
grant execute on function public.admin_save_book(text,text,text,integer,integer,boolean), public.admin_dashboard() to authenticated;
commit;
