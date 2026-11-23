// Server-only persistence adapter. No Supabase secrets go to the browser.
import { createAccount } from './paper.js';
export function createSupabaseStore({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,fetchFn=fetch,id='main'}={}){
 if(!url||!key)throw new Error('Supabase credentials not configured');
 const origin=new URL(url);
 if(origin.protocol!=='https:'||!origin.hostname.endsWith('.supabase.co'))throw new Error('Invalid Supabase host');
 const base=new URL('/rest/v1/trading_paper_states',origin);
 const headers={'apikey':key,'Authorization':'Bearer '+key,'content-type':'application/json','accept':'application/json'};
 async function request(method,path,body){
   const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),8000);
   try{
    const response=await fetchFn(path,{method,headers:{...headers,...(method==='POST'?{'prefer':'resolution=merge-duplicates,return=representation'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:ctrl.signal});
    const message=await response.text();
    if(!response.ok)throw new Error('Remote paper persistence HTTP '+response.status+': '+message.slice(0,120));
    return message?JSON.parse(message):null;
   }finally{clearTimeout(timeout);}
 }
 return {
  kind:'supabase',
  async load(){
   const query=new URL(base);query.searchParams.set('id','eq.'+id);query.searchParams.set('select','state');
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid remote state response');
   if(rows.length===0)return createAccount();
   if(rows.length!==1)throw new Error('Duplicate remote paper state');
   const state=rows[0].state;
   if(state?.schema!==1||!Number.isFinite(state.cash)||state.cash<0||!state.positions||!state.lastCandle||!Array.isArray(state.trades))throw new Error('Invalid remote portfolio state');
   return state;
  },
  async save(state){
   const rows=await request('POST',base,{id,state,updated_at:new Date().toISOString()});
   if(!Array.isArray(rows)||rows.length!==1)throw new Error('Remote state not acknowledged');
  }
 };
}
