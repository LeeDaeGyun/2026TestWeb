import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { dbError } from './lib/operations'
const entities={aurora_devices:'전광판',aurora_contents:'콘텐츠',aurora_schedules:'송출 예약',aurora_settings:'설정'}
const actions={INSERT:'등록',UPDATE:'수정',DELETE:'삭제'}
export default function OperationLogs({userId,version}) {
 const [entity,setEntity]=useState(''),[action,setAction]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[page,setPage]=useState(0),[refresh,setRefresh]=useState(0)
 const [result,setResult]=useState({rows:[],count:0,loading:true,error:''}),[selected,setSelected]=useState(null)
 useEffect(()=>{
  let active=true
  async function queryLogs(){
   setResult(r=>({...r,loading:true,error:''}))
   if(start&&end&&start>end){setResult({rows:[],count:0,loading:false,error:'시작일은 종료일보다 늦을 수 없습니다.'});return}
   try{
    let query=supabase.from('aurora_operation_logs').select('*',{count:'exact'}).eq('user_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false})
    if(entity)query=query.eq('entity',entity)
    if(action)query=query.eq('action',action)
    if(start)query=query.gte('created_at',start+'T00:00:00+09:00')
    if(end)query=query.lte('created_at',end+'T23:59:59.999999+09:00')
    const {data,count,error}=await query.range(page*20,page*20+19)
    if(error)throw error
    if(active)setResult({rows:data,count,loading:false,error:''})
   }catch(e){if(active)setResult({rows:[],count:0,loading:false,error:dbError(e)})}
  }
  queryLogs()
  return ()=>{active=false}
 },[userId,version,entity,action,start,end,page,refresh])
 function change(setter,value){setter(value);setPage(0);setSelected(null)}
 return <section className="schedule-panel"><div className="section-heading"><div><h2>운영 기록</h2><p className="form-help">DB에 저장된 변경 이력 · 한국 시간(KST) · 성공한 데이터 변경만 기록됩니다.</p></div><button className="secondary" onClick={()=>setRefresh(n=>n+1)}>새로고침</button></div><div className="log-filters"><label>대상<select value={entity} onChange={e=>change(setEntity,e.target.value)}><option value="">전체 대상</option>{Object.entries(entities).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label><label>작업<select value={action} onChange={e=>change(setAction,e.target.value)}><option value="">전체 작업</option>{Object.entries(actions).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label><label>시작일<input type="date" value={start} onChange={e=>change(setStart,e.target.value)}/></label><label>종료일<input type="date" value={end} onChange={e=>change(setEnd,e.target.value)}/></label><button className="secondary" onClick={()=>{setEntity('');setAction('');setStart('');setEnd('');setPage(0)}}>필터 초기화</button></div>
 {result.error?<p role="alert" className="auth-error">{result.error}</p>:result.loading?<div className="empty" role="status">운영 기록을 조회하고 있습니다…</div>:<><div className="table-scroll"><table className="logs-table"><thead><tr><th>일시 (KST)</th><th>대상</th><th>작업</th><th>이름</th><th>처리자</th><th>상세</th></tr></thead><tbody>{result.rows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</td><td>{entities[row.entity]||row.entity}</td><td><span className={'log-badge '+row.action}>{actions[row.action]}</span></td><td>{row.label}</td><td>{row.actor_id===userId?'본인':'시스템'}</td><td><button className="secondary" onClick={()=>setSelected(selected?.id===row.id?null:row)}>변경 내용</button></td></tr>)}</tbody></table></div>{!result.rows.length&&<div className="empty">조회 조건에 맞는 운영 기록이 없습니다.</div>}<div className="log-pagination"><span>총 {result.count}건 · {page+1} / {Math.max(1,Math.ceil(result.count/20))}페이지</span><button className="secondary" disabled={page===0} onClick={()=>{setPage(n=>n-1);setSelected(null)}}>이전</button><button className="secondary" disabled={(page+1)*20>=result.count} onClick={()=>{setPage(n=>n+1);setSelected(null)}}>다음</button></div></>}
 {selected&&<section className="log-detail"><h3>{selected.label} · 변경 내용</h3><div className="log-snapshots"><div><h4>변경 전</h4><pre>{JSON.stringify(selected.before_data,null,2)||'없음'}</pre></div><div><h4>변경 후</h4><pre>{JSON.stringify(selected.after_data,null,2)||'없음'}</pre></div></div></section>}
 </section>
}
