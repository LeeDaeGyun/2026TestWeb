-- Supabase SQL Editor에서 실행합니다. 비밀번호는 auth.users에서 Supabase Auth가 관리합니다.
begin;
create table public.aurora_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);
alter table public.aurora_profiles enable row level security;
revoke all on public.aurora_profiles from anon, authenticated;
grant select, insert on public.aurora_profiles to authenticated;
create policy aurora_profiles_read_own on public.aurora_profiles
for select to authenticated using ((select auth.uid()) = id);
create policy aurora_profiles_insert_own on public.aurora_profiles
for insert to authenticated with check ((select auth.uid()) = id);
commit;
-- 검증: 테이블 RLS와 정책을 확인합니다.
select relname, relrowsecurity from pg_class where oid = 'public.aurora_profiles'::regclass;
select policyname, cmd, roles from pg_policies where tablename = 'aurora_profiles';
