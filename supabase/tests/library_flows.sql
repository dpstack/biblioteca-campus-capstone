-- Integration checks against the installed Supabase schema.
-- Run as the database administrator in SQL Editor. All fixtures and writes
-- are inside one transaction and ROLLBACK removes them. No real loans change.
begin;

select set_config('capstone.user_a', gen_random_uuid()::text, true);
select set_config('capstone.user_b', gen_random_uuid()::text, true);
select set_config('capstone.work_id', 'OL' || (100000000000 + floor(random() * 100000000000))::bigint::text || 'W', true);

insert into auth.users (id, email, aud, role) values
  (current_setting('capstone.user_a')::uuid, current_setting('capstone.user_a') || '@example.invalid', 'authenticated', 'authenticated'),
  (current_setting('capstone.user_b')::uuid, current_setting('capstone.user_b') || '@example.invalid', 'authenticated', 'authenticated');
insert into public.library_books (work_id, total_copies, available_copies)
values (current_setting('capstone.work_id'), 1, 1);

create function pg_temp.assert_true(ok boolean, description text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %', description; end if;
end $$;
create function pg_temp.expect_error(statement text, expected text) returns void
language plpgsql as $$ begin
  begin
    execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then
      raise exception 'Unexpected error: %, expected %', sqlerrm, expected;
    end if;
    return;
  end;
  raise exception 'FAIL: operation unexpectedly succeeded: %', statement;
end $$;

-- A takes the only copy. Duplicates cannot alter stock.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('capstone.user_a'), true);
select public.borrow_book(current_setting('capstone.work_id'), 'Capstone test', 'Test author', null);
select pg_temp.assert_true(available_copies = 0, 'Borrow decrements inventory') from public.library_books where work_id = current_setting('capstone.work_id');
select pg_temp.assert_true(due_at > borrowed_at and due_at <= borrowed_at + interval '14 days', 'Due date is 14 days') from public.loans where work_id = current_setting('capstone.work_id');
select pg_temp.expect_error($q$select public.borrow_book(current_setting('capstone.work_id'), 'Capstone test', 'Test author', null)$q$, 'Ya tienes un préstamo activo');
select pg_temp.expect_error($q$select public.reserve_book(current_setting('capstone.work_id'), 'Capstone test', 'Test author', null)$q$, 'Ya tienes esta obra en préstamo');
insert into public.reading_list (user_id, work_id, title, author, status)
values (auth.uid(), current_setting('capstone.work_id'), 'Capstone test', 'Test author', 'reading');

-- B cannot read or edit A's records and reserves the exhausted title.
select set_config('request.jwt.claim.sub', current_setting('capstone.user_b'), true);
select pg_temp.assert_true(count(*) = 0, 'B cannot read A loans') from public.loans where work_id = current_setting('capstone.work_id');
select pg_temp.assert_true(count(*) = 0, 'B cannot read A reading list') from public.reading_list where work_id = current_setting('capstone.work_id');
select pg_temp.expect_error($q$insert into public.reading_list(user_id, work_id, title, author, status) values (current_setting('capstone.user_a')::uuid, current_setting('capstone.work_id'), 'Test', 'Test', 'finished')$q$, 'row-level security');
with changed as (update public.reading_list set status = 'finished' where work_id = current_setting('capstone.work_id') returning *)
select pg_temp.assert_true(count(*) = 0, 'B cannot update A reading list') from changed;
select public.reserve_book(current_setting('capstone.work_id'), 'Capstone test', 'Test author', null);
select pg_temp.expect_error($q$select public.reserve_book(current_setting('capstone.work_id'), 'Capstone test', 'Test author', null)$q$, 'Ya reservaste esta obra');

-- Returning restores stock and keeps history. A cannot bypass B's queue.
select set_config('request.jwt.claim.sub', current_setting('capstone.user_a'), true);
select pg_temp.assert_true(count(*) = 0, 'A cannot read B reservations') from public.reservations where work_id = current_setting('capstone.work_id');
select public.return_book(id) from public.loans where work_id = current_setting('capstone.work_id') and returned_at is null;
select pg_temp.assert_true(available_copies = 1, 'Return restores inventory') from public.library_books where work_id = current_setting('capstone.work_id');
select pg_temp.assert_true(returned_at is not null, 'History persists after return') from public.loans where work_id = current_setting('capstone.work_id');
select pg_temp.expect_error($q$select public.return_book(id) from public.loans where work_id = current_setting('capstone.work_id')$q$, 'ya fue devuelto');
select pg_temp.expect_error($q$select public.borrow_book(current_setting('capstone.work_id'), 'Capstone test', 'Test author', null)$q$, 'reservado para otra persona');

-- B gets the reserved copy. Its reservation is fulfilled atomically.
select set_config('request.jwt.claim.sub', current_setting('capstone.user_b'), true);
select public.borrow_book(current_setting('capstone.work_id'), 'Capstone test', 'Test author', null);
select pg_temp.assert_true(status = 'fulfilled', 'Borrow fulfills the first reservation') from public.reservations where work_id = current_setting('capstone.work_id');
select set_config('request.jwt.claim.sub', current_setting('capstone.user_a'), true);
select public.reserve_book(current_setting('capstone.work_id'), 'Capstone test', 'Test author', null);
select public.cancel_reservation(id) from public.reservations where work_id = current_setting('capstone.work_id') and status = 'waiting';
select pg_temp.assert_true(status = 'cancelled', 'Cancellation persists') from public.reservations where work_id = current_setting('capstone.work_id');
update public.reading_list set status = 'finished' where work_id = current_setting('capstone.work_id');
select pg_temp.assert_true(status = 'finished', 'Own reading status updates') from public.reading_list where work_id = current_setting('capstone.work_id');
delete from public.reading_list where work_id = current_setting('capstone.work_id');
select pg_temp.assert_true(count(*) = 0, 'Own reading item can be removed') from public.reading_list where work_id = current_setting('capstone.work_id');

-- Anonymous visitors cannot use protected endpoints.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($q$select id from public.loans where work_id = current_setting('capstone.work_id')$q$, 'permission denied');
select pg_temp.expect_error($q$select public.borrow_book(current_setting('capstone.work_id'), 'Test', 'Test', null)$q$, 'permission denied');
select pg_temp.assert_true(count(*) = 1, 'Anonymous inventory is readable') from public.library_books where work_id = current_setting('capstone.work_id');
reset role;
select 'PASS: loans, duplicate rejection, returns, reservations, queue, reading and RLS' as result;
rollback;
