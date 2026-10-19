create table splitbill.backup_emails(user_id text primary key references splitbill.users(id),email text unique not null,verified_at text not null);
create table splitbill.email_challenges(user_id text primary key references splitbill.users(id),email text not null,created_at bigint not null);
alter table splitbill.backup_emails enable row level security;
alter table splitbill.email_challenges enable row level security;
revoke all on splitbill.backup_emails, splitbill.email_challenges from public, anon, authenticated;
