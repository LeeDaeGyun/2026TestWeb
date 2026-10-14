import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import App from './App'
import Brand from './components/Brand'
function errorMessage(error) {
 const messages = { invalid_credentials:'이메일 또는 비밀번호를 확인해주세요.',email_not_confirmed:'이메일 인증 후 로그인해주세요.',user_already_exists:'이미 등록된 계정입니다. 로그인해주세요.',weak_password:'더 안전한 비밀번호를 입력해주세요.',over_email_send_rate_limit:'메일 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' }
 return messages[error.code] || error.message || '요청을 처리하지 못했습니다.'
}
export default function AuthGate() {
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[mode,setMode]=useState('login'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[profile,setProfile]=useState(null),[profileError,setProfileError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{
  if(!supabase)return
  let active=true
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setReady(true)}})
  supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setError(errorMessage(error));setSession(data.session);setReady(true)}}).catch(()=>{if(active){setError('세션을 확인하지 못했습니다. 페이지를 새로고침해주세요.');setReady(true)}})
  return ()=>{active=false;subscription.unsubscribe()}
 },[])
 useEffect(()=>{
  if(!session)return
  let active=true
  async function ensureProfile(){
   setProfileError('')
   try {
    const user=session.user
    const {data,error}=await supabase.from('aurora_profiles').select('id,display_name').eq('id',user.id).maybeSingle()
    if(error)throw error
    let result=data
    if(!result){
     const name=(user.user_metadata?.display_name || user.email?.split('@')[0] || '회원').trim().slice(0,60) || '회원'
     const response=await supabase.from('aurora_profiles').insert({id:user.id,display_name:name}).select('id,display_name').single()
     if(response.error){
      if(response.error.code==='23505'){
       const existing=await supabase.from('aurora_profiles').select('id,display_name').eq('id',user.id).single()
       if(existing.error)throw existing.error
       result=existing.data
      }else throw response.error
     }else result=response.data
    }
    if(active)setProfile(result)
   }catch{if(active)setProfileError('회원 프로필을 불러오지 못했습니다. 테이블 설정 및 연결 상태를 확인한 뒤 다시 시도해주세요.')}
  }
  ensureProfile()
  return ()=>{active=false}
 },[session,retry])
 async function signOut(){
  setBusy(true);setError('')
  try{const {error}=await supabase.auth.signOut();if(error)throw error;setProfile(null);setProfileError('');setMessage('로그아웃되었습니다.')}catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 async function submit(e){
  e.preventDefault();setError('');setMessage('')
  const fields=new FormData(e.currentTarget),email=fields.get('email').trim(),password=fields.get('password')
  if(mode==='signup'&&password!==fields.get('confirm')){setError('비밀번호가 일치하지 않습니다.');return}
  if(mode==='signup'&&!fields.get('name').trim()){setError('이름을 입력해주세요.');return}
  setBusy(true)
  try{
   const result=mode==='signup'?await supabase.auth.signUp({email,password,options:{data:{display_name:fields.get('name').trim()},emailRedirectTo:window.location.origin}}):await supabase.auth.signInWithPassword({email,password})
   if(result.error)throw result.error
   if(mode==='signup'&&!result.data.session){setMessage('가입 요청을 접수했습니다. 이메일 인증이 필요한 경우 받은 메일의 링크를 눌러주세요. 기존 계정은 로그인해주세요.');setMode('login')}
  }catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 if(!supabase)return <div className="auth-page"><div className="auth-card"><h1>연결 설정이 필요합니다</h1><p>.env.local의 Supabase 설정을 확인하고 개발 서버를 재시작해주세요.</p></div></div>
 if(!ready)return <div className="auth-page" role="status">로그인 상태를 확인하고 있습니다…</div>
 if(session)return <><div className="account-bar"><span>{profile?.display_name || session.user.email} 님</span><button disabled={busy} onClick={signOut}>{busy?'처리 중…':'로그아웃'}</button></div>{error&&<div className="notice" role="alert">{error}</div>}{profileError?<div className="auth-page"><div className="auth-card"><h2>회원 정보 연결 확인</h2><p role="alert">{profileError}</p><button className="primary" onClick={()=>setRetry(n=>n+1)}>다시 시도</button><button className="secondary" disabled={busy} onClick={signOut}>로그아웃</button></div></div>:profile?.id===session.user.id?<App key={session.user.id} user={session.user} displayName={profile.display_name}/>:<div className="auth-page" role="status">회원 정보를 불러오고 있습니다…</div>}</>
 return <div className="auth-page"><section className="auth-intro"><div className="brand"><Brand/></div><span className="eyebrow">YOUR SCREENS, CONNECTED</span><h1>모든 화면을 연결하는<br/>하나의 워크스페이스.</h1><p>전광판과 콘텐츠, 송출 일정을 한곳에서 관리하세요.</p><div className="auth-art"><span>CBDS / STUDIO</span><strong>좋은 순간을<br/>더 큰 화면으로.</strong></div></section><section className="auth-card"><h2>{mode==='login'?'다시 만나 반갑습니다':'새로운 워크스페이스의 시작'}</h2><p>{mode==='login'?'계정으로 로그인해 관리를 시작하세요.':'이메일로 회원가입하고 화면 관리를 시작하세요.'}</p><div className="auth-tabs">{[['login','로그인'],['signup','회원가입']].map(([value,label])=><button key={value} disabled={busy} className={mode===value?'selected':''} onClick={()=>{setMode(value);setError('');setMessage('')}}>{label}</button>)}</div><form key={mode} onSubmit={submit}>{mode==='signup'&&<label>이름<input name="name" required maxLength={60} autoComplete="name" placeholder="이름을 입력해주세요"/></label>}<label>이메일<input name="email" required type="email" autoComplete="email" placeholder="you@company.com"/></label><label>비밀번호<input name="password" required type="password" minLength={mode==='signup'?8:undefined} autoComplete={mode==='signup'?'new-password':'current-password'} placeholder={mode==='signup'?'8자 이상 입력해주세요':'비밀번호를 입력해주세요'}/></label>{mode==='signup'&&<label>비밀번호 확인<input name="confirm" type="password" required autoComplete="new-password" placeholder="비밀번호를 다시 입력해주세요"/></label>}{error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="auth-success" role="status">{message}</p>}<button className="primary" disabled={busy}>{busy?'처리 중…':mode==='login'?'로그인':'회원가입'}</button></form><p className="form-help">계정 인증은 Supabase로 처리됩니다. 운영 데이터와 변경 기록은 사용자별 DB에 저장됩니다.</p></section></div>
}
