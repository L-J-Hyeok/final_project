// Same-origin API only. No calls occur until a page explicitly invokes request().
let csrfToken=null
let csrfPending=null
export class ApiError extends Error { constructor(status,code,message){super(message);this.name='ApiError';this.status=status;this.code=code} }
export function clearCsrf(){csrfToken=null}
export async function request(path,{method='GET',body,signal}={}){
  if(!/^\/api\//.test(path)||path.includes('\\')||path.includes('#'))throw new ApiError(0,'INVALID_PATH','API 경로를 확인해 주세요.')
  if(!new URL(path,'http://api.local').pathname.startsWith('/api/'))throw new ApiError(0,'INVALID_PATH','API 경로를 확인해 주세요.')
  method=method.toUpperCase()
  const write=!['GET','HEAD'].includes(method)
  if(write&&!csrfToken){
    if(!csrfPending)csrfPending=request('/api/auth/csrf').then(r=>{if(!r?.data?.csrf_token)throw new ApiError(0,'INVALID_RESPONSE','서버 응답을 확인해 주세요.');csrfToken=r.data.csrf_token}).finally(()=>{csrfPending=null})
    await csrfPending
  }
  let response
  try{response=await fetch(path,{method,credentials:'same-origin',redirect:'error',cache:'no-store',signal,headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(write?{'X-CSRF-Token':csrfToken}:{})},body:body===undefined?undefined:JSON.stringify(body)})}
  catch(error){if(error.name==='AbortError')throw error;throw new ApiError(0,'NETWORK_ERROR','서버에 연결하지 못했어요.')}
  if(response.status===204){if(path==='/api/auth/logout')clearCsrf();return null}
  let result
  try{result=await response.json()}catch{throw new ApiError(response.status,'INVALID_RESPONSE','서버 응답을 확인해 주세요.')}
  if(!response.ok){if(response.status===401||result.error?.code==='CSRF_INVALID')clearCsrf();throw new ApiError(response.status,result.error?.code||'API_ERROR',result.error?.message||'요청을 처리하지 못했어요.')}
  if(result.data?.csrf_token)csrfToken=result.data.csrf_token
  return result // Preserve data, next_cursor and recommendation status; never retry mutations automatically.
}
