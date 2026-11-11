import { createRouter, createWebHistory } from 'vue-router'
import store from '../store'
import HomeView from '../views/HomeView.vue'
const placeholder=()=>import('../views/PlaceholderView.vue')
const routes=[{path:'/compare',name:'compare',component:()=>import('../views/CompareView.vue'),meta:{title:'제품 스펙 비교'}},{path:'/',name:'home',component:HomeView,meta:{title:'나에게 맞는 IT기기'}},
...Object.entries({'/register':'회원가입','/login':'로그인','/profile':'내 프로필','/devices':'보유 기기 관리','/recommend':'AI 제품 추천','/recommendations/:id':'추천 결과','/history':'추천 이력','/upgrade':'업그레이드 추천','/pc':'조립 PC 추천'}).map(([path,title])=>({path,component:['/register','/login'].includes(path)?()=>import('../views/AuthView.vue'):path==='/profile'?()=>import('../views/ProfileView.vue'):path==='/devices'?()=>import('../views/DevicesView.vue'):placeholder,meta:{title,requiresAuth:['/profile','/devices','/recommend','/recommendations/:id','/history','/upgrade'].includes(path),description:path==='/pc'?'조립 PC 추천은 향후 확장 기능입니다. 현재는 제공하지 않습니다.':undefined}})),
{path:'/error',name:'error',component:()=>import('../views/ErrorView.vue'),meta:{title:'오류 안내'}},
{path:'/:pathMatch(.*)*',name:'not-found',component:()=>import('../views/ErrorView.vue'),meta:{title:'페이지 없음'}}]
const router=createRouter({history:createWebHistory(process.env.BASE_URL),routes,scrollBehavior(to){return to.hash?{el:to.hash,top:100}:{top:0}}})
router.beforeEach(async to=>{await store.dispatch('restore');if(to.meta.requiresAuth&&!store.state.user)return {path:'/login',query:{next:to.fullPath}};if(['/login','/register'].includes(to.path)&&store.state.user)return '/'})
router.afterEach(to=>{document.title=`${to.meta.title || '홈'} · 기기로운`})
export default router
