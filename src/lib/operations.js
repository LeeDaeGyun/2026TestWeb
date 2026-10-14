import { supabase } from './supabase'
export function dbError(error) {
 if(error?.code==='PGRST205'||error?.code==='42P01')return '운영 DB 테이블이 준비되지 않았습니다. setup-operations.sql 적용 후 새로고침해주세요.'
 if(error?.code==='23503')return '연결된 예약이 있습니다. 예약을 먼저 삭제해주세요.'
 if(error?.code==='42501')return '데이터 접근 권한이 없습니다. 로그인 상태와 DB 권한을 확인해주세요.'
 return error?.message || 'DB 요청에 실패했습니다. 연결 상태를 확인해주세요.'
}
async function allRows(table,userId,order){
 const rows=[]
 for(let offset=0;;offset+=500){
  const {data,error}=await supabase.from(table).select('*').eq('user_id',userId).order(order,{ascending:true}).order('id').range(offset,offset+499)
  if(error)throw error
  rows.push(...data)
  if(data.length<500)return rows
 }
}
export async function readOperations(userId) {
 const results=await Promise.all([
  allRows('aurora_devices',userId,'created_at'),
  allRows('aurora_contents',userId,'created_at'),
  allRows('aurora_schedules',userId,'starts_at'),
  supabase.from('aurora_settings').select('*').eq('user_id',userId).maybeSingle(),
 ])
 for(const result of results)if(result.error)throw result.error
 return {devices:results[0],contents:results[1],schedules:results[2],settings:results[3].data}
}
const tables={device:'aurora_devices',content:'aurora_contents',schedule:'aurora_schedules',settings:'aurora_settings'}
export async function saveOperation(kind,id,payload,userId) {
 const table=tables[kind]
 if(!table)throw new Error('지원하지 않는 데이터 유형입니다.')
 let query
 if(kind==='settings') query=supabase.from(table).upsert({...payload,id:userId,user_id:userId},{onConflict:'id'})
 else query=id?supabase.from(table).update(payload).eq('id',id).eq('user_id',userId):supabase.from(table).insert({...payload,user_id:userId})
 const {data,error}=await query.select('id').single()
 if(error)throw error
 return data
}
export async function deleteOperation(kind,id,userId) {
 const {data,error}=await supabase.from(tables[kind]).delete().eq('id',id).eq('user_id',userId).select('id').single()
 if(error)throw error
 return data
}
