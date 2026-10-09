-- Ejecutar completo después de la migración administrativa. No conserva fixtures.
begin;
select set_config('admin_test.admin', gen_random_uuid()::text, true);
select set_config('admin_test.reader', gen_random_uuid()::text, true);
select set_config('admin_test.work', 'OL' || (300000000000 + floor(random()*100000000000))::bigint::text || 'W', true);
insert into auth.users(id,email,aud,role) values
 (current_setting('admin_test.admin')::uuid,current_setting('admin_test.admin')||'@example.invalid','authenticated','authenticated'),
 (current_setting('admin_test.reader')::uuid,current_setting('admin_test.reader')||'@example.invalid','authenticated','authenticated');
insert into public.library_admins values(current_setting('admin_test.admin')::uuid);
create function pg_temp.admin_assert(ok boolean,description text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %',description; end if; end $$;
create function pg_temp.admin_error(statement text,expected text) returns void language plpgsql as $$
begin begin execute statement; exception when others then
 if position(expected in sqlerrm)=0 then raise exception 'Unexpected error: %',sqlerrm; end if; return;
 end; raise exception 'FAIL: operation succeeded'; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('admin_test.reader'),true);
select pg_temp.admin_assert(not public.is_library_admin(),'reader is not admin');
select pg_temp.admin_error('select public.admin_dashboard()','exclusivo');
select pg_temp.admin_error($q$select public.admin_save_book(current_setting('admin_test.work'),'Test','Author',null,1,false)$q$,'exclusivo');
select pg_temp.admin_error('insert into public.library_admins values (auth.uid())','permission denied');
select set_config('request.jwt.claim.sub',current_setting('admin_test.admin'),true);
select pg_temp.admin_assert(public.is_library_admin(),'admin role recognized');
select public.admin_save_book(current_setting('admin_test.work'),'Test','Author',null,2,false);
select pg_temp.admin_assert(total_copies=2 and available_copies=2,'new stock') from public.library_books where work_id=current_setting('admin_test.work');
select public.borrow_book(current_setting('admin_test.work'),'Test','Author',null);
select set_config('request.jwt.claim.sub',current_setting('admin_test.reader'),true);
select public.borrow_book(current_setting('admin_test.work'),'Test','Author',null);
select set_config('request.jwt.claim.sub',current_setting('admin_test.admin'),true);
select pg_temp.admin_error($q$select public.admin_save_book(current_setting('admin_test.work'),'Test','Author',null,1,false)$q$,'préstamos activos');
select public.admin_save_book(current_setting('admin_test.work'),'Test','Author',null,3,false);
select pg_temp.admin_assert(available_copies=1,'adding copy preserves active loans') from public.library_books where work_id=current_setting('admin_test.work');
select pg_temp.admin_assert(jsonb_array_length(public.admin_dashboard()->'loans')>=2,'admin sees circulation across users');
select public.admin_save_book(current_setting('admin_test.work'),'Test','Author',null,3,true);
select public.return_book(id) from public.loans where work_id=current_setting('admin_test.work') and returned_at is null;
select pg_temp.admin_error($q$select public.borrow_book(current_setting('admin_test.work'),'Test','Author',null)$q$,'retirada');
select pg_temp.admin_assert(available_copies=2,'rejected retired borrow rolls back stock') from public.library_books where work_id=current_setting('admin_test.work');
select public.admin_save_book(current_setting('admin_test.work'),'Test','Author',null,1,false);
select public.reserve_book(current_setting('admin_test.work'),'Test','Author',null);
select pg_temp.admin_error($q$select public.admin_save_book(current_setting('admin_test.work'),'Test','Author',null,1,true)$q$,'reservas pendientes');
select public.cancel_reservation(id) from public.reservations where work_id=current_setting('admin_test.work') and status='waiting';
select public.admin_save_book(current_setting('admin_test.work'),'Test','Author',null,1,true);
select pg_temp.admin_error($q$select public.reserve_book(current_setting('admin_test.work'),'Test','Author',null)$q$,'retirada');
select set_config('request.jwt.claim.sub',current_setting('admin_test.reader'),true);
select public.return_book(id) from public.loans where work_id=current_setting('admin_test.work') and returned_at is null;
select pg_temp.admin_assert(available_copies=1,'reader returns retired work') from public.library_books where work_id=current_setting('admin_test.work');
reset role;
set local role anon;
select pg_temp.admin_error('select public.admin_dashboard()','permission denied');
reset role;
select 'PASS: administrative permissions, stock, retirement and circulation' as result;
rollback;
