import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStore} from './supabase-store.js';

test('prospective archive reads frozen configuration and writes idempotent observed signals only',async()=>{
 let calls=0;
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'private-key',fetchFn:async(path,options)=>{
  assert.equal(options.headers.apikey,'private-key');
  assert.ok(path.pathname.startsWith('/rest/v1/trading_forward_'));
  if(options.method==='GET'){
   assert.equal(path.pathname,'/rest/v1/trading_forward_studies');
   assert.equal(path.searchParams.get('version'),'eq.filters-v1-20261124');
   return {ok:true,text:async()=>JSON.stringify([{version:'filters-v1-20261124',started_at:'2026-11-24T01:58:52Z'}])};
  }
  calls++;
  assert.equal(options.method,'POST');
  assert.equal(path.pathname,'/rest/v1/trading_forward_candles');
  assert.match(options.headers.prefer,/ignore-duplicates/);
  const o=JSON.parse(options.body);
  assert.equal(o.portfolio_id,'main');
  assert.equal(o.version,'filters-v1-20261124');
  assert.equal(o.observed_at,undefined);
  assert.equal(o.signals.reference,true);
  return {ok:true,text:async()=>JSON.stringify([o])};
 }});
 const version=await store.getFrozenForwardStudy();
 assert.equal(version.version,'filters-v1-20261124');
 const inserted=await store.insertForwardObservation({
  symbol:'BTCUSDT',version:version.version,candleOpenTime:1795478400000,
  candleCloseTime:1795478699999,candleOpen:100,candleClose:101,
  signals:{reference:true,trend_confirmed:false,volatility_screen:false,combined:false}
 });
 assert.equal(inserted,true);assert.equal(calls,1);
});
test('forward snapshot route does not rely on browser keys',async()=>{
 const calls=[];
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'server-only',fetchFn:async(path,options)=>{
  calls.push(path.pathname);
  assert.equal(options.method,'GET');
  assert.equal(options.headers.apikey,'server-only');
  return {ok:true,text:async()=>JSON.stringify([])};
 }});
 assert.deepEqual(await store.listForwardObservations({limit:12}),[]);
 assert.deepEqual(await store.listForwardOutcomes({limit:12}),[]);
 assert.deepEqual(calls,['/rest/v1/trading_forward_candles','/rest/v1/trading_forward_outcomes']);
});
