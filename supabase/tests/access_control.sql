begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into public.profiles (id, auth_subject, display_name, email, role, state) values
('10000000-0000-4000-8000-000000000001', 'auth0|test-user-a', 'Учебный пользователь А', 'user-a@example.test', 'user', 'active'),
('10000000-0000-4000-8000-000000000002', 'auth0|test-user-b', 'Учебный пользователь Б', 'user-b@example.test', 'user', 'active'),
('10000000-0000-4000-8000-000000000003', 'auth0|test-admin', 'Учебный администратор', 'admin-test@example.test', 'admin', 'active'),
('10000000-0000-4000-8000-000000000004', 'auth0|test-specialist', 'Учебный специалист', 'specialist@example.test', 'specialist', 'active');

insert into public.specialist_category_access (specialist_id, category_id, granted_by)
select '10000000-0000-4000-8000-000000000004', id, '10000000-0000-4000-8000-000000000003'
from public.categories where name = 'Приложения';

insert into public.tickets (id, number, subject, description, category_id, author_id) values
('20000000-0000-4000-8000-000000000001', 9901, 'Учебная заявка пользователя А', 'Обезличенное описание для проверки доступа.', (select id from public.categories where name = 'Приложения'), '10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000002', 9902, 'Учебная заявка пользователя Б', 'Обезличенное описание для проверки изоляции.', (select id from public.categories where name = 'Оборудование'), '10000000-0000-4000-8000-000000000002');

select plan(10);

select ok(not has_table_privilege('anon', 'public.tickets', 'SELECT'), 'аноним не имеет права читать заявки');
select ok(not has_table_privilege('anon', 'public.tickets', 'INSERT'), 'аноним не имеет права изменять заявки');

set local role authenticated;
set local request.jwt.claims = '{"sub":"auth0|test-user-a","role":"authenticated"}';
select results_eq('select number from public.tickets order by number', 'values (9901::bigint)', 'пользователь видит только свою заявку');
select results_eq($$select count(*)::bigint from public.tickets where id = '20000000-0000-4000-8000-000000000002'$$, 'values (0::bigint)', 'прямой ID чужой заявки не раскрывает строку');
select ok(not has_table_privilege('authenticated', 'public.tickets', 'UPDATE'), 'клиент не получает прямое UPDATE заявок');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"auth0|test-specialist","role":"authenticated"}';
select results_eq('select number from public.tickets order by number', 'values (9901::bigint)', 'специалист видит разрешённую очередь');
select results_eq($$select count(*)::bigint from public.tickets where id = '20000000-0000-4000-8000-000000000002'$$, 'values (0::bigint)', 'специалист не видит чужую очередь по ID');
select throws_ok(
  $$select public.admin_update_role('10000000-0000-4000-8000-000000000002', 'admin', 'request-test-01')$$,
  'P0001', 'forbidden', 'специалист не меняет роли'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"auth0|test-admin","role":"authenticated"}';
select lives_ok(
  $$select public.admin_update_role('10000000-0000-4000-8000-000000000004', 'user', 'request-test-02')$$,
  'администратор меняет роль через разрешённый RPC'
);
select results_eq(
  $$select role::text from public.profiles where id = '10000000-0000-4000-8000-000000000004'$$,
  $$values ('user'::text)$$,
  'изменение роли записано'
);

select * from finish();
rollback;
