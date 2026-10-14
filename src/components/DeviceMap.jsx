import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps,locateAddress } from '../lib/kakaoMaps'
const key=import.meta.env.VITE_KAKAO_MAP_APP_KEY
export default function DeviceMap({devices,onEdit}){
 const container=useRef(null),mapRef=useRef(null),cacheRef=useRef(new Map()),overlaysRef=useRef(new Map())
 const [retry,setRetry]=useState(0),[state,setState]=useState({loading:true,error:'',located:[],failed:[]}),[selectedId,setSelectedId]=useState(null)
 const selected=state.located.find(d=>d.id===selectedId)
 useEffect(()=>{
  if(!key||!devices.length)return
  let active=true,observer,map
  const markers=[],listeners=[],overlays=overlaysRef.current
  async function initialize(){
   setState({loading:true,error:'',located:[],failed:[]})
   try{
    const maps=await loadKakaoMaps(key)
    if(!active||!container.current)return
    const geocoder=new maps.services.Geocoder(),located=[],failed=[]
    map=new maps.Map(container.current,{center:new maps.LatLng(36.3,127.8),level:13})
    mapRef.current=map
    map.addControl(new maps.ZoomControl(),maps.ControlPosition.RIGHT)

    observer=new ResizeObserver(()=>{map.relayout()})
    observer.observe(container.current)
    // 같은 주소는 화면 내 캐시를 사용하고 요청은 순차 처리합니다.
    for(const device of devices){
     if(!active)return
     const address=device.location.trim()
     let location=cacheRef.current.get(address)
     if(!location){location=await locateAddress(geocoder,maps.services,address);if(!location.error)cacheRef.current.set(address,location)}
     if(!active)return
     if(location.error){failed.push({...device,reason:location.error});continue}
     const entry={...device,coords:location};located.push(entry)
     const position=new maps.LatLng(location.lat,location.lng)
     const button=document.createElement('button')
     button.type='button'
     button.className='billboard-marker '+(device.status==='온라인'?'online':device.status==='점검 중'?'maintenance':'offline')
     button.setAttribute('aria-label',device.name+' · '+device.status+' · 위치 보기')
     button.setAttribute('aria-pressed','false')
     const screen=document.createElement('span');screen.className='billboard-screen'
     const brand=document.createElement('span');brand.className='billboard-brand';brand.textContent='CBDS'
     const status=document.createElement('span');status.className='billboard-status';status.textContent=device.status
     screen.append(brand,status)
     const name=document.createElement('span');name.className='billboard-name';name.textContent=device.name
     const pin=document.createElement('span');pin.className='billboard-pin'
     button.append(screen,name,pin)
     const marker=new maps.CustomOverlay({map,position,content:button,yAnchor:1,zIndex:2,clickable:true})
     markers.push(marker)
     overlays.set(device.id,{marker,button})
     const click=()=>{
      if(!active)return
      setSelectedId(device.id);map.panTo(position);map.setLevel(3)
     }
     button.addEventListener('click',click);listeners.push({button,click})
    }
    if(!active)return
    if(located.length===1){map.setCenter(new maps.LatLng(located[0].coords.lat,located[0].coords.lng));map.setLevel(4)}
    else if(located.length>1){
     const bounds=new maps.LatLngBounds()
     located.forEach(d=>bounds.extend(new maps.LatLng(d.coords.lat,d.coords.lng)))
     map.setBounds(bounds,110,90,50,90)
    }
    setState({loading:false,error:'',located,failed})
   }catch(error){if(active)setState({loading:false,error:error.message,located:[],failed:[]})}
  }
  initialize()
  return ()=>{
   active=false;observer?.disconnect()
   listeners.forEach(({button,click})=>button.removeEventListener('click',click))
   markers.forEach(marker=>marker.setMap(null));overlays.clear()
   if(mapRef.current===map)mapRef.current=null
  }
 },[devices,retry])
 useEffect(()=>{
  overlaysRef.current.forEach(({marker,button},id)=>{
   const selected=id===selectedId
   button.classList.toggle('selected',selected)
   button.setAttribute('aria-pressed',String(selected))
   marker.setZIndex(selected?10:2)
  })
 },[selectedId,state.located])
 function focusDevice(device){
  setSelectedId(device.id)
  const maps=window.kakao?.maps
  if(maps&&mapRef.current){mapRef.current.panTo(new maps.LatLng(device.coords.lat,device.coords.lng));mapRef.current.setLevel(3)}
 }
 return <section className="map-panel" aria-labelledby="map-heading"><div className="section-heading"><div><h2 id="map-heading">전광판 위치</h2><p className="form-help">등록된 설치 주소 기반 · 아래 검색 및 상태 필터가 지도에도 적용됩니다.</p></div><button className="secondary" disabled={state.loading&&!!key&&!!devices.length} onClick={()=>{cacheRef.current.clear();setRetry(n=>n+1)}}>지도 새로고침</button></div>
 {!key?<div className="empty">카카오맵 연결 설정이 필요합니다.</div>:!devices.length?<div className="empty">표시할 전광판이 없습니다. 전광판을 등록하거나 검색 조건을 변경해주세요.</div>:<><div className="map-layout"><div className="map-stage"><div ref={container} className="kakao-map" aria-label="전광판 설치 위치 지도"/>{state.loading&&<div className="map-message" role="status">지도와 설치 주소를 불러오고 있습니다…</div>}{state.error&&<div className="map-message" role="alert"><p>{state.error}</p><button className="secondary" onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>}</div><div className="map-device-list" aria-label="지도에 표시한 전광판 목록">{!state.loading&&!state.error&&<p className="map-count">위치 확인 {state.located.length}대 · 미확인 {state.failed.length}대</p>}{state.located.map(device=><button key={device.id} className={'map-device '+(selectedId===device.id?'selected':'')} aria-pressed={selectedId===device.id} onClick={()=>focusDevice(device)}><b>{device.name}</b><span>{device.location}</span><small>{device.status}{device.coords.approximate?' · 대략적인 위치':''}</small></button>)}{!state.loading&&!state.error&&!state.located.length&&<p className="form-help">표시 가능한 주소가 없습니다. 설치 주소를 확인해주세요.</p>}</div></div>
 {selected&&!state.loading&&!state.error&&<div className="map-selection"><div><b>{selected.name}</b><p>{selected.coords.address} · {selected.status}{selected.coords.approximate?' · 상세 주소를 입력하면 위치가 더 정확해집니다.':''}</p></div><a className="secondary" target="_blank" rel="noopener noreferrer" href={'https://map.kakao.com/link/map/'+encodeURIComponent(selected.name)+','+selected.coords.lat+','+selected.coords.lng}>카카오맵에서 보기</a><button className="secondary" onClick={()=>onEdit(selected)}>설치 주소 수정</button></div>}
 {!state.loading&&!state.error&&state.failed.length>0&&<div className="map-failures"><b>위치를 확인하지 못한 전광판</b>{state.failed.map(device=><div key={device.id}><span>{device.name} · {device.location} — {device.reason}</span><button className="secondary" onClick={()=>onEdit(device)}>주소 수정</button></div>)}</div>}</>}
 </section>
}
