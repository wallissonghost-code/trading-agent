import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStore} from './supabase-store.js';
test('atomic monitoring transition writes call the server-only RPC and never post to public tables',async()=>{
 let writes=0;
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'private',fetchFn:async(path,request)=>{
  assert.equal(path.pathname,'/rest/v1/rpc/trading_record_health_transitions');
  assert.equal(request.method,'POST');
  assert.equal(request.headers.apikey,'private');
  const body=JSON.parse(request.body);
  assert.equal(body.p_portfolio,'main');
  assert.deepEqual(body.p_snapshot.map(s=>s.status),['MONITORING','STALE_DATA','COLLECTION_ERROR']);
  writes++;
  return {ok:true,text:async()=>JSON.stringify({ok:true,transitions:2})};
 }});
 const result=await store.recordMonitoringTransitions([
  {symbol:'BTCUSDT',status:'MONITORING'},
  {symbol:'ETHUSDT',status:'STALE_DATA'},
  {symbol:'SOLUSDT',status:'COLLECTION_ERROR'}]);
 assert.equal(result.transitions,2);
 assert.equal(writes,1);
 await assert.rejects(()=>store.recordMonitoringTransitions([{symbol:'BTCUSDT',status:'FICTITIOUS'}]),/Invalid/);
 assert.equal(writes,1);
});
test('historical monitor alerts and current states are restricted to read-only filtered queries',async()=>{
 const paths=[];
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'private',fetchFn:async(path,request)=>{
  assert.equal(request.method,'GET');
  assert.equal(path.searchParams.get('portfolio_id'),'eq.main');
  paths.push(path.pathname);
  return {ok:true,text:async()=>'[]'};
 }});
 assert.deepEqual(await store.listMonitoringEvents({limit:30}),[]);
 assert.deepEqual(await store.listMonitoringStates(),[]);
 assert.deepEqual(paths,['/rest/v1/trading_monitor_events','/rest/v1/trading_monitor_state']);
});
