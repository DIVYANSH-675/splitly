-- SplitBill has device-owned opaque sessions validated by its Edge API.
-- No app table is exposed directly to anonymous or authenticated Data API roles.
create schema if not exists splitbill;
revoke all on schema splitbill from public, anon, authenticated;
create table splitbill.users(id text primary key,email text unique not null,name text not null,salt text not null,password text not null);
create table splitbill.sessions(token text primary key,user_id text not null references splitbill.users(id),expires bigint not null);
create index sessions_user on splitbill.sessions(user_id);
create index sessions_expiry on splitbill.sessions(expires);
create table splitbill.trips(id text primary key,code text unique not null,data text not null);
create table splitbill.profiles(user_id text primary key references splitbill.users(id),username text unique not null,photo text not null default '');
create table splitbill.operations(user_id text not null references splitbill.users(id),request_id text not null,path text not null,signature text not null,response text not null,primary key(user_id,request_id));
create table splitbill.attachments(id text primary key,trip_id text not null references splitbill.trips(id) on delete cascade,user_id text not null references splitbill.users(id),name text not null,mime text not null,data text not null);
create index attachments_trip on splitbill.attachments(trip_id);
alter table splitbill.users enable row level security;
alter table splitbill.sessions enable row level security;
alter table splitbill.trips enable row level security;
alter table splitbill.profiles enable row level security;
alter table splitbill.operations enable row level security;
alter table splitbill.attachments enable row level security;
revoke all on all tables in schema splitbill from public, anon, authenticated;
-- There are intentionally no client RLS policies. Only the server's DB role has access.
