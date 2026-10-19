-- Runtime app queries assume a role limited to this app's private tables.
-- This role cannot log in and is never granted to anon/authenticated clients.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='splitbill_api') then
    create role splitbill_api nologin;
  end if;
end $$;
grant splitbill_api to postgres with set true;
grant usage on schema splitbill to splitbill_api;
grant select,insert,update on splitbill.users,splitbill.profiles to splitbill_api;
grant select,insert,delete on splitbill.sessions,splitbill.backup_emails to splitbill_api;
grant select,insert on splitbill.operations,splitbill.attachments to splitbill_api;
grant select,insert,update,delete on splitbill.trips,splitbill.email_challenges to splitbill_api;
do $$ declare item text; begin
  foreach item in array array['users','sessions','trips','profiles','operations','attachments','backup_emails','email_challenges'] loop
    execute format('create policy server_api on splitbill.%I for all to splitbill_api using (current_user = %L) with check (current_user = %L)', item,'splitbill_api','splitbill_api');
  end loop;
end $$;
create index if not exists attachments_user on splitbill.attachments(user_id);
