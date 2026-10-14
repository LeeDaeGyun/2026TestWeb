-- Supabase SQL Editor에서 한 번 실행하세요. 기존 회원 테이블을 변경하지 않습니다.
begin;
create schema if not exists aurora_private;
revoke all on schema aurora_private from public, anon, authenticated;
create table public.aurora_contents (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 120),
 description text not null default '' check (length(description) <= 2000),
 color text not null default 'blue' check(color in ('blue','green','orange')),
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table public.aurora_devices (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 60),
 location text not null check(length(btrim(location)) between 1 and 80),
 type text not null check(type in ('실내 LED','실내 LCD','옥외 LED')),
 status text not null default '오프라인' check(status in ('온라인','오프라인','점검 중')),
 size text not null default '1920 × 1080' check(length(btrim(size)) between 1 and 60),
 created_at timestamptz not null default now(), unique(id,user_id)
);
create table public.aurora_schedules (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null, content_id uuid not null, starts_at timestamptz not null,
 created_at timestamptz not null default now(),
 foreign key(device_id,user_id) references public.aurora_devices(id,user_id) on delete restrict,
 foreign key(content_id,user_id) references public.aurora_contents(id,user_id) on delete restrict
);
create table public.aurora_settings (
 id uuid primary key references auth.users(id) on delete cascade,
 user_id uuid not null unique references auth.users(id) on delete cascade check(id=user_id),
 name text not null check(length(btrim(name)) between 1 and 60),
 created_at timestamptz not null default now()
);
create table public.aurora_operation_logs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid, entity text not null, entity_id uuid not null,
 action text not null check(action in ('INSERT','UPDATE','DELETE')),
 label text not null, before_data jsonb, after_data jsonb,
 created_at timestamptz not null default now()
);
create index aurora_devices_owner_idx on public.aurora_devices(user_id,created_at);
create index aurora_contents_owner_idx on public.aurora_contents(user_id,created_at);
create index aurora_schedules_owner_idx on public.aurora_schedules(user_id,starts_at);
create index aurora_schedules_device_idx on public.aurora_schedules(device_id,user_id);
create index aurora_schedules_content_idx on public.aurora_schedules(content_id,user_id);
create index aurora_logs_owner_date_idx on public.aurora_operation_logs(user_id,created_at desc,id desc);
-- 기록은 트리거만 추가하며 클라이언트의 수정·삭제를 금지합니다.
do $block$
declare t text;
begin
 foreach t in array array['aurora_devices','aurora_contents','aurora_schedules','aurora_settings'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
 end loop;
end $block$;
alter table public.aurora_operation_logs enable row level security;
revoke all on public.aurora_operation_logs from anon,authenticated;
grant select on public.aurora_operation_logs to authenticated;
create policy logs_read_own on public.aurora_operation_logs for select to authenticated
using ((select auth.uid())=user_id);
-- 수정 불가능한 이력을 같은 트랜잭션에서 기록하기 위한 제한된 권한입니다.
create function aurora_private.record_operation() returns trigger language plpgsql
security definer set search_path='' as $function$
declare row_data jsonb; old_data jsonb; new_data jsonb; owner_id uuid; actor uuid; title text;
begin
 if tg_op <> 'INSERT' then old_data=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then new_data=to_jsonb(new); end if;
 if tg_op='UPDATE' and old_data=new_data then return new; end if;
 row_data=coalesce(new_data,old_data);
 owner_id=(row_data->>'user_id')::uuid;
 actor=auth.uid();
 if not exists(select 1 from auth.users where id=owner_id) then
  if tg_op='DELETE' then return old; end if;
  raise exception 'Unknown owner' using errcode='23503';
 end if;
 if actor is not null and actor<>owner_id then raise exception 'Owner mismatch' using errcode='42501'; end if;
 if actor is null and current_setting('role',true) in ('anon','authenticated') then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 title=coalesce(row_data->>'name','송출 예약');
 if tg_table_name='aurora_schedules' then
  select d.name || ' · ' || c.name into title
  from public.aurora_devices d,public.aurora_contents c
  where d.id=(row_data->>'device_id')::uuid and c.id=(row_data->>'content_id')::uuid
    and d.user_id=owner_id and c.user_id=owner_id;
 end if;
 insert into public.aurora_operation_logs(user_id,actor_id,entity,entity_id,action,label,before_data,after_data)
 values(owner_id,actor,tg_table_name,(row_data->>'id')::uuid,tg_op,coalesce(title,'송출 예약'),old_data,new_data);
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;
revoke all on function aurora_private.record_operation() from public,anon,authenticated,service_role;
do $block$
declare t text;
begin
 foreach t in array array['aurora_devices','aurora_contents','aurora_schedules','aurora_settings'] loop
  execute format('create trigger operation_audit after insert or update or delete on public.%I for each row execute function aurora_private.record_operation()',t);
 end loop;
end $block$;
notify pgrst,'reload schema';
commit;
-- 검증용
select tablename,policyname,cmd from pg_policies where tablename like 'aurora_%' order by tablename,cmd;
