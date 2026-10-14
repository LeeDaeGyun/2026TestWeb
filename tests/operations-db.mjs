import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite()
try{
 await db.exec(`
 create role anon;
 create role authenticated;
 create role service_role;
 create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
 `)
 await db.exec(await readFile(new URL('../supabase/setup-operations.sql',import.meta.url),'utf8'))
 await db.exec("set role authenticated; set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'")
 const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222'
 const device=(await db.query("insert into public.aurora_devices(user_id,name,location,type) values($1,'장치 A','서울','실내 LED') returning id",[owner])).rows[0].id
 const content=(await db.query("insert into public.aurora_contents(user_id,name) values($1,'콘텐츠 A') returning id",[owner])).rows[0].id
 const schedule=(await db.query("insert into public.aurora_schedules(user_id,device_id,content_id,starts_at) values($1,$2,$3,now()+interval '1 day') returning id",[owner,device,content])).rows[0].id
 await db.query("insert into public.aurora_settings(id,user_id,name) values($1,$1,'워크스페이스 A')",[owner])
 assert.equal((await db.query('select * from public.aurora_operation_logs')).rows.length,4)
 await db.query("update public.aurora_devices set name='장치 B' where id=$1",[device])
 const log=(await db.query("select * from public.aurora_operation_logs where action='UPDATE'")).rows[0]
 assert.equal(log.before_data.name,'장치 A');assert.equal(log.after_data.name,'장치 B');assert.equal(log.actor_id,owner)
 await assert.rejects(db.query("delete from public.aurora_devices where id=$1",[device]),/foreign key/i)
 assert.equal((await db.query('select * from public.aurora_operation_logs')).rows.length,5)
 await assert.rejects(db.exec("delete from public.aurora_operation_logs"),/permission denied/i)
 await assert.rejects(db.exec("update public.aurora_operation_logs set label='fake'"),/permission denied/i)
 await assert.rejects(db.query("insert into public.aurora_operation_logs(user_id,entity,entity_id,action,label) values($1,'fake',$2,'INSERT','fake')",[owner,device]),/permission denied/i)
 await db.exec("set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'")
 for(const table of ['aurora_devices','aurora_contents','aurora_schedules','aurora_settings','aurora_operation_logs']) assert.equal((await db.query('select * from public.'+table)).rows.length,0)
 await assert.rejects(db.query("insert into public.aurora_devices(user_id,name,location,type) values($1,'forged','서울','실내 LED')",[owner]),/row.level security/i)
 await assert.rejects(db.query("insert into public.aurora_schedules(user_id,device_id,content_id,starts_at) values($1,$2,$3,now())",[other,device,content]),/foreign key/i)
 assert.equal((await db.query("update public.aurora_devices set name='forged' where id=$1 returning id",[device])).rows.length,0)
 await db.exec("set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'")
 await db.query("delete from public.aurora_schedules where id=$1",[schedule])
 const deletion=(await db.query("select * from public.aurora_operation_logs where action='DELETE'")).rows[0]
 assert.equal(deletion.label,'장치 B · 콘텐츠 A');assert.equal(deletion.after_data,null)
 await db.query("delete from public.aurora_devices where id=$1",[device])
 assert.equal((await db.query('select * from public.aurora_operation_logs')).rows.length,7)
 await db.exec("set role anon")
 await assert.rejects(db.exec("select * from public.aurora_devices"),/permission denied/i)
 await db.exec('reset role')
 await db.query("delete from auth.users where id=$1",[owner])
 assert.equal((await db.query('select * from public.aurora_operation_logs')).rows.length,0)
 console.log('PASS: schema, CRUD audit, before/after, atomic rollback, immutable logs, tenant isolation, cross-owner FK, anonymous denial, account cleanup')
}finally{await db.close()}
