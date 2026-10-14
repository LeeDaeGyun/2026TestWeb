import { useCallback, useEffect, useRef, useState } from 'react'
import { readOperations,saveOperation,deleteOperation,dbError } from './lib/operations'
import OperationLogs from './OperationLogs'
import Brand from './components/Brand'
import DeviceMap from './components/DeviceMap'
import { Icon,Preview } from './components/DisplayUI'
export default function App({user,displayName}){
 const [data,setData]=useState({devices:[],contents:[],schedules:[],settings:null}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(0)
 const [tab,setTab]=useState('대시보드'),[filter,setFilter]=useState('전체'),[search,setSearch]=useState(''),[view,setView]=useState('grid'),[modal,setModal]=useState(null),[notice,setNotice]=useState(''),[formError,setFormError]=useState('')
 const dialogRef=useRef(null),requestRef=useRef(0),mutationRef=useRef(false)
 const {devices,contents,schedules,settings}=data
 const reload=useCallback(async()=>{
  const request=++requestRef.current
  setLoading(true);setError('')
  try{const result=await readOperations(user.id);if(request===requestRef.current)setData(result)}
  catch(e){if(request===requestRef.current)setError(dbError(e))}
  finally{if(request===requestRef.current)setLoading(false)}
 },[user.id])
 useEffect(()=>{
  let active=true
  readOperations(user.id).then(result=>{if(active)setData(result)}).catch(e=>{if(active)setError(dbError(e))}).finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[user.id])
 useEffect(()=>{if(modal&&dialogRef.current&&!dialogRef.current.open)dialogRef.current.showModal()},[modal])
 function open(value){setFormError('');setModal(value)}
 async function mutate(work,message){
  if(mutationRef.current)return
  mutationRef.current=true;setBusy(true);setFormError('');setNotice('')
  try{await work();setModal(null);setNotice(message);setVersion(v=>v+1);await reload()}
  catch(e){setFormError(dbError(e))}
  finally{mutationRef.current=false;setBusy(false)}
 }
 function submit(e){
  e.preventDefault();const f=new FormData(e.currentTarget),kind=modal.kind
  let payload
  if(kind==='device')payload={name:f.get('name').trim(),location:f.get('location').trim(),type:f.get('type'),size:f.get('size').trim(),status:f.get('status')}
  if(kind==='content')payload={name:f.get('name').trim(),description:f.get('description').trim(),color:f.get('color')}
  if(kind==='schedule'){
   if(!devices.length||!contents.length){setFormError('전광판과 콘텐츠를 먼저 등록해주세요.');return}
   const date=new Date(f.get('date')+'+09:00')
   if(Number.isNaN(date.getTime())||date<=new Date()){setFormError('한국 시간 기준 미래의 송출 시작 시간을 입력해주세요.');return}
   payload={device_id:f.get('device'),content_id:f.get('content'),starts_at:date.toISOString()}
  }
  if(kind==='settings')payload={name:f.get('name').trim()}
  if(('name' in payload&&!payload.name)||('location' in payload&&!payload.location)||('size' in payload&&!payload.size)){setFormError('공백만 입력할 수 없습니다.');return}
  mutate(()=>saveOperation(kind,modal.row?.id,payload,user.id),'DB에 저장했습니다. 운영 기록에서 변경 이력을 확인할 수 있습니다.')
 }
 const visible=devices.filter(d=>(filter==='전체'||d.status===filter)&&(d.name+' '+d.location).toLowerCase().includes(search.toLowerCase()))
 const nav=['대시보드','전광판 관리','콘텐츠 라이브러리','송출 스케줄','운영 기록']
 const nameOf=(list,id)=>list.find(item=>item.id===id)?.name||'삭제된 항목'
 function toKoreanInput(date){return new Date(new Date(date).getTime()+9*3600000).toISOString().slice(0,16)}
 const primaryKind=tab==='콘텐츠 라이브러리'?'content':tab==='송출 스케줄'?'schedule':'device'
 const titles={device:'전광판',content:'콘텐츠',schedule:'송출 예약',settings:'워크스페이스'}
 return <div className="app"><aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('대시보드')}}><Brand/></a><div className="workspace"><span className="workspace-icon">CB</span><div><b>{settings?.name||'내 워크스페이스'}</b><small>Supabase 운영 데이터</small></div></div><p className="nav-label">WORKSPACE</p><nav>{nav.map((n,i)=><button key={n} className={tab===n?'active':''} onClick={()=>{setTab(n);setSearch('')}}><Icon name={['grid','screen','folder','calendar','chart'][i]}/>{n}{n==='전광판 관리'&&<span className="nav-count">{devices.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="help-card"><span>운영 이력을 한곳에</span><p>등록·수정·삭제 내역을<br/>운영 기록에서 확인하세요.</p><b>사용자별 DB 저장 <Icon name="check" size={16}/></b></div><button className={'settings '+(tab==='설정'?'active':'')} onClick={()=>setTab('설정')}><Icon name="settings"/>설정</button><div className="profile"><span className="avatar">{displayName?.slice(0,1)}</span><div><b>{displayName}</b><small>회원 계정</small></div></div></div></aside>
 <div className="main-shell"><header className="topbar"><span>워크스페이스 <span className="crumb">/</span><b>{tab}</b></span><div className="top-actions"><span className="demo-dot"/>Supabase DB<button className="secondary" disabled={loading||busy} onClick={reload}>새로고침</button><span className="avatar small">{displayName?.slice(0,1)}</span></div></header><main><div className="page-heading"><div><div className="eyebrow">YOUR SCREENS, CONNECTED</div><h1>{tab}</h1><p>공간의 모든 화면, 하나의 흐름으로 관리하세요.</p></div>{!['설정','운영 기록'].includes(tab)&&<button className="primary" disabled={loading||!!error||busy||(primaryKind==='schedule'&&(!devices.length||!contents.length))} onClick={()=>open({kind:primaryKind})}><Icon name="plus"/>{titles[primaryKind]} 등록</button>}</div>
 <div className="demo-note"><span/>운영 정보와 변경 이력은 DB에 저장됩니다. 상태는 수동 기록이며 실제 장치 제어는 연결되지 않았습니다.</div>
 {notice&&<div className="notice" role="status">{notice}<button aria-label="알림 닫기" onClick={()=>setNotice('')}><Icon name="close" size={16}/></button></div>}
 {error&&<div className="db-error" role="alert"><b>운영 데이터를 불러오지 못했습니다.</b><p>{error}</p><button className="secondary" onClick={reload}>다시 시도</button></div>}
 {tab==='운영 기록'?<OperationLogs userId={user.id} version={version}/>:loading?<div className="empty" role="status">DB에서 운영 데이터를 조회하고 있습니다…</div>:!error&&<>
 {(tab==='전광판 관리'||tab==='대시보드')&&<><section className="stats" aria-label="전광판 현황">{[['전체 전광판',devices.length,'등록된 모든 디스플레이','screen'],['온라인',devices.filter(d=>d.status==='온라인').length,'수동 등록된 상태','check'],['오프라인',devices.filter(d=>d.status==='오프라인').length,'수동 등록된 상태','screen'],['예약된 송출',schedules.length,'DB에 저장된 예약','calendar']].map(([title,value,desc,icon],i)=><article key={title}><div className="stat-top">{title}<span className={'stat-icon s'+i}><Icon name={icon}/></span></div><strong>{value}<small>{i===3?'건':'대'}</small></strong><p>{desc}</p></article>)}</section>{tab==='대시보드'&&<DeviceMap devices={visible} onEdit={device=>open({kind:'device',row:device})}/>}<section className="device-section"><div className="section-heading"><h2>내 전광판 <span>{devices.length}</span></h2><span className="updated">DB 등록 상태</span></div><div className="toolbar"><div className="filters">{['전체','온라인','오프라인','점검 중'].map(f=><button className={filter===f?'selected':''} onClick={()=>setFilter(f)} key={f}>{f}</button>)}</div><div className="toolbar-right"><label className="search"><Icon name="search" size={18}/><input aria-label="전광판 검색" placeholder="이름 또는 위치 검색" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="view-toggle">{['grid','list'].map(v=><button key={v} aria-label={v==='grid'?'카드 보기':'목록 보기'} aria-pressed={view===v} className={view===v?'selected':''} onClick={()=>setView(v)}><Icon name={v==='grid'?'grid':'chart'} size={17}/></button>)}</div></div></div><div className={'devices '+view}>{visible.map(d=><article className="device-card" key={d.id}><div className="preview-wrap"><div className="device-placeholder"><Icon name="screen" size={48}/><span>실제 화면 미연결</span></div><span className={'status '+(d.status==='온라인'?'online':d.status==='오프라인'?'offline':'maintenance')}><i/>{d.status}</span></div><div className="device-info"><div className="device-title"><h3>{d.name}</h3><button aria-label={d.name+' 수정'} onClick={()=>open({kind:'device',row:d})}>···</button></div><p className="location">{d.location} · {d.type}</p><div className="device-meta"><span><Icon name="screen" size={14}/>{d.size}</span><span>수동 상태</span></div><div className="record-actions"><button className="secondary" onClick={()=>open({kind:'device',row:d})}>수정</button><button className="secondary" disabled={!contents.length} onClick={()=>open({kind:'schedule',deviceId:d.id})}>송출 예약</button><button className="danger-link" onClick={()=>open({kind:'delete',entity:'device',row:d})}>삭제</button></div></div></article>)}</div>{!visible.length&&<div className="empty">{devices.length?'검색 조건에 맞는 전광판이 없습니다.':'등록된 전광판이 없습니다. 전광판을 등록해주세요.'}</div>}<div className="list-footer"><span>총 {devices.length}대 중 {visible.length}대 표시</span></div></section></>}
 {tab==='콘텐츠 라이브러리'&&<><section className="library">{contents.map(c=><article className="device-card" key={c.id}><Preview color={c.color} content={c.name}/><div className="device-info"><h3>{c.name}</h3><p className="form-help">{c.description||'설명 없음'}</p><div className="record-actions"><button className="secondary" onClick={()=>open({kind:'content',row:c})}>수정</button><button className="danger-link" onClick={()=>open({kind:'delete',entity:'content',row:c})}>삭제</button></div></div></article>)}</section>{!contents.length&&<div className="empty">아직 콘텐츠가 없습니다. 콘텐츠를 등록해주세요.</div>}</>}
 {tab==='송출 스케줄'&&<section className="schedule-panel"><h2>예약된 송출</h2><p className="form-help">한국 시간(KST) 기준. 예약 정보는 저장되며 실제 송출은 별도 장치 연동이 필요합니다.</p>{schedules.map(s=><div className="schedule-row" key={s.id}><Icon name="calendar"/><div><b>{nameOf(contents,s.content_id)}</b><p>{nameOf(devices,s.device_id)} · {new Date(s.starts_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p></div><button className="secondary" onClick={()=>open({kind:'schedule',row:s})}>수정</button><button className="secondary" onClick={()=>open({kind:'delete',entity:'schedule',row:s})}>삭제</button></div>)}{!schedules.length&&<div className="empty">등록된 송출 예약이 없습니다.{(!devices.length||!contents.length)&&<p>전광판과 콘텐츠를 먼저 등록해주세요.</p>}</div>}</section>}
 {tab==='설정'&&<section className="schedule-panel"><h2>워크스페이스 설정</h2><div className="schedule-row"><div><b>{settings?.name||'내 워크스페이스'}</b><p>DB에 저장되는 워크스페이스 이름입니다.</p></div><button className="secondary" onClick={()=>open({kind:'settings',row:settings})}>이름 수정</button></div><div className="schedule-row"><div><b>데이터 저장 및 운영 기록</b><p>본인 계정의 전광판, 콘텐츠, 예약과 설정을 DB에서 관리합니다. 변경 이력은 DB에서 자동 기록됩니다.</p><p>기존 브라우저 데모 데이터는 자동으로 이관되지 않습니다.</p></div></div></section>}
 </>}
 <footer>© 2026 CBDS. <span>디스플레이 관리 워크스페이스</span><b><i/> Supabase 운영 DB</b></footer></main></div>
 {modal&&<div className="modal-backdrop"><dialog ref={dialogRef} className="modal" aria-labelledby="modal-title" onCancel={e=>{if(busy)e.preventDefault();else setModal(null)}}><div className="modal-heading"><h2 id="modal-title">{modal.kind==='delete'?'삭제 확인':titles[modal.kind]+(modal.row?' 수정':' 등록')}</h2><button disabled={busy} autoFocus aria-label="닫기" onClick={()=>setModal(null)}><Icon name="close"/></button></div>{modal.kind==='delete'?<><p>이 항목을 DB에서 삭제할까요? 변경 이력은 운영 기록에 남습니다. 연결된 예약이 있으면 먼저 삭제해야 합니다.</p>{formError&&<p role="alert" className="auth-error">{formError}</p>}<button className="primary" disabled={busy} onClick={()=>mutate(()=>deleteOperation(modal.entity,modal.row.id,user.id),'DB에서 삭제했습니다. 운영 기록은 보존됩니다.')}>{busy?'삭제 중…':'삭제하기'}</button></>:<form onSubmit={submit}>
 {['device','content','settings'].includes(modal.kind)&&<label>{titles[modal.kind]} 이름<input required name="name" maxLength={modal.kind==='content'?120:60} defaultValue={modal.row?.name||''}/></label>}
 {modal.kind==='device'&&<><label>설치 주소<input name="location" placeholder="예: 서울 강남구 테헤란로 152" required maxLength={80} defaultValue={modal.row?.location||''}/></label><label>유형<select name="type" defaultValue={modal.row?.type||'실내 LED'}>{['실내 LED','실내 LCD','옥외 LED'].map(t=><option key={t}>{t}</option>)}</select></label><label>해상도<input name="size" required maxLength={60} defaultValue={modal.row?.size||'1920 × 1080'}/></label><label>상태 (수동 기록)<select name="status" defaultValue={modal.row?.status||'오프라인'}>{['온라인','오프라인','점검 중'].map(t=><option key={t}>{t}</option>)}</select></label></>}
 {modal.kind==='content'&&<><label>설명<textarea name="description" maxLength={2000} rows={4} defaultValue={modal.row?.description||''}/></label><label>미리보기 테마<select name="color" defaultValue={modal.row?.color||'blue'}><option value="blue">블루</option><option value="green">그린</option><option value="orange">오렌지</option></select></label><p className="form-help">테마 미리보기용 콘텐츠 정보입니다. 파일 업로드 및 실제 송출은 연결되지 않았습니다.</p></>}
 {modal.kind==='schedule'&&<><label>전광판<select required name="device" defaultValue={modal.row?.device_id||modal.deviceId||''}><option value="" disabled>전광판 선택</option>{devices.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label><label>콘텐츠<select required name="content" defaultValue={modal.row?.content_id||''}><option value="" disabled>콘텐츠 선택</option>{contents.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>송출 시작 (한국 시간)<input type="datetime-local" required name="date" defaultValue={modal.row?toKoreanInput(modal.row.starts_at):''}/></label></>}
 {formError&&<p role="alert" className="auth-error">{formError}</p>}<button className="primary" disabled={busy}>{busy?'DB에 저장 중…':'저장하기'}</button></form>}</dialog></div>}
 </div>
}
