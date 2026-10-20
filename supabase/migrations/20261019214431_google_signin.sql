create table splitbill.oauth_identities (
  provider text not null check (provider='google'),
  subject text not null,
  user_id text not null references splitbill.users(id),
  email text not null,
  primary key(provider,subject),
  unique(user_id,provider)
);
alter table splitbill.oauth_identities enable row level security;
revoke all on splitbill.oauth_identities from public, anon, authenticated;
grant select,insert,update on splitbill.oauth_identities to splitbill_api;
create policy server_api on splitbill.oauth_identities for all to splitbill_api
using (current_user='splitbill_api') with check (current_user='splitbill_api');
