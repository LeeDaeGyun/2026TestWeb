let sdkPromise
export function loadKakaoMaps(key) {
 if(!key)return Promise.reject(new Error('카카오맵 키가 설정되지 않았습니다.'))
 if(window.kakao?.maps?.Map&&window.kakao.maps.services)return Promise.resolve(window.kakao.maps)
 if(sdkPromise)return sdkPromise
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script')
  let settled=false
  const timer=setTimeout(()=>fail(),15000)
  function fail(){
   if(settled)return
   settled=true;clearTimeout(timer);script.remove();sdkPromise=undefined
   reject(new Error('카카오맵을 불러오지 못했습니다. JavaScript 키, SDK 도메인 등록, 지도 API 사용 설정과 네트워크 연결을 확인해주세요.'))
  }
  script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey='+encodeURIComponent(key)
  script.async=true
  script.onerror=fail
  script.onload=()=>{
   if(settled)return
   if(!window.kakao?.maps?.load){fail();return}
   window.kakao.maps.load(()=>{
    if(settled)return
    if(!window.kakao.maps.Map||!window.kakao.maps.services){fail();return}
    settled=true;clearTimeout(timer);resolve(window.kakao.maps)
   })
  }
  document.head.appendChild(script)
 })
 return sdkPromise
}
export function locateAddress(geocoder,services,address){
 return new Promise(resolve=>{
  let done=false
  const finish=value=>{if(!done){done=true;clearTimeout(timer);resolve(value)}}
  const timer=setTimeout(()=>finish({error:'주소 검색 시간 초과'}),8000)
  try{geocoder.addressSearch(address,(rows,status)=>{
   if(status!==services.Status.OK||!rows?.length){finish({error:status===services.Status.ZERO_RESULT?'주소를 찾을 수 없음':'주소 검색 실패'});return}
   const row=rows[0],lat=Number(row.y),lng=Number(row.x)
   if(!Number.isFinite(lat)||!Number.isFinite(lng)){finish({error:'좌표 정보가 올바르지 않음'});return}
   finish({lat,lng,address:row.road_address?.address_name||row.address_name,approximate:!row.road_address&&!row.address?.main_address_no})
  })}catch{finish({error:'주소 검색 실패'})}
 })
}
