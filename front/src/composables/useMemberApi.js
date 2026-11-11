import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { request, clearCsrf } from '../api/client'
export function useMemberApi() {
  const store=useStore(), router=useRouter(), route=useRoute()
  return async (path, options) => {
    const returnPath=route.fullPath
    try { return await request(path, options) }
    catch (e) {
      if(e.status===401 || e.code==='CSRF_INVALID') {
        await store.dispatch('restore')
        if(!store.state.user && !store.state.authError && route.path!=='/login') {
          clearCsrf()
          await router.replace({path:'/login',query:{next:returnPath,expired:'1'}})
        }
      }
      throw e
    }
  }
}
export function memberMessage(e) {
  return ({PROFILE_CHANGED:'다른 화면에서 정보가 변경됐어요. 입력 내용은 유지했습니다. 최신 정보를 다시 불러온 뒤 확인해 주세요.',DEVICE_LIMIT:'보유 기기는 최대 20개까지 등록할 수 있어요.',NOT_FOUND:'기기를 찾을 수 없어요. 목록을 다시 불러와 주세요.',INVALID_INPUT:'입력값과 필수 항목, 숫자 범위를 확인해 주세요.',CSRF_INVALID:'보안 확인에 실패했어요. 다시 시도해 주세요.',AUTH_REQUIRED:'세션이 만료됐어요. 다시 로그인해 주세요.',RATE_LIMITED:'요청이 많아요. 잠시 후 다시 시도해 주세요.',VERSION_EXHAUSTED:'프로필을 더 이상 변경할 수 없어요. 관리자에게 문의해 주세요.'})[e.code] || '처리하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.'
}
