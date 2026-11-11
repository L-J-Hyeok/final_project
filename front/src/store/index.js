import { createStore } from 'vuex'
import { request } from '../api/client'
export default createStore({
 state:{user:null,authError:null},
 mutations:{user(s,user){s.user=user},error(s,e){s.authError=e}},
 actions:{
  async restore({commit}){try{const r=await request('/api/auth/me');commit('user',r.data);commit('error',null);return true}catch(e){commit('user',null);commit('error',e.status===401?null:e.code);return false}},
  async login({commit},body){const r=await request('/api/auth/login',{method:'POST',body});commit('user',r.data.user);commit('error',null)},
  async logout({commit}){try{await request('/api/auth/logout',{method:'POST',body:{}})}catch(e){if(e.status!==401)throw e}commit('user',null);commit('error',null)}
 }
})
