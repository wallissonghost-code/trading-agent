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
  async listSignalOutcomes({limit=100}={}){
   const query=new URL('/rest/v1/trading_paper_signal_outcomes',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('select','symbol,signal,action,decision_candle_close_time,next_candle_return_pct,directional_correct,evaluated_at');
   query.searchParams.set('order','evaluated_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(500,Number(limit)||100))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid signal evaluation response');
   return rows;
  },
  async listDecisions({limit=30}={}){
   const query=new URL('/rest/v1/trading_paper_decisions',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('select','decision');
   query.searchParams.set('order','observed_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(100,Number(limit)||30))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid decision journal response');
   return rows.map(row=>row.decision);
  },
  async listTrades({limit=50}={}){
   const query=new URL('/rest/v1/trading_paper_ledger',origin);
   query.searchParams.set('portfolio_id','eq.'+id);
   query.searchParams.set('select','trade');
   query.searchParams.set('order','executed_at.desc');
   query.searchParams.set('limit',String(Math.max(1,Math.min(100,Number(limit)||50))));
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid trade ledger response');
   return rows.map(row=>row.trade);
  },
  async load(){
   const query=new URL(base);query.searchParams.set('id','eq.'+id);query.searchParams.set('select','state');
   const rows=await request('GET',query);
   if(!Array.isArray(rows))throw new Error('Invalid remote state response');
   if(rows.length===0){
    const initial=createAccount();
    // Persist genesis immediately to prove remote storage is writable, even when market data is unavailable.
    const created=await request('POST',base,{id,state:initial,updated_at:new Date().toISOString()});
    if(!Array.isArray(created)||created.length!==1)throw new Error('Remote initialization not acknowledged');
    return created[0].state;
   }
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
