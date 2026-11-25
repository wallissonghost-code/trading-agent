import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStore} from './supabase-store.js';
test('refuses malformed or non-TLS Supabase origins',()=>{
 assert.throws(()=>createSupabaseStore({url:'http://wrong.example',key:'secret'}),/Invalid Supabase host/);
});
test('loads empty account and saves state with server credentials',async()=>{
 let saved=null,calls=0;
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'test-server-secret',fetchFn:async(url,opts)=>{
 calls++;
 assert.equal(opts.headers.apikey,'test-server-secret');
 if(opts.method==='GET')return {ok:true,text:async()=>saved?JSON.stringify([{state:saved}]):'[]'};
 saved=JSON.parse(opts.body).state;
 return {ok:true,text:async()=>JSON.stringify([{state:saved}])};
 }});
 const start=await store.load();
 assert.equal(start.cash,10000);
 start.cash=8500;
 await store.save(start);
 assert.equal((await store.load()).cash,8500);
 assert.equal(calls,4);
});
test('network failure fails closed rather than resetting state',async()=>{
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'test-secret',fetchFn:async()=>({ok:false,status:503,text:async()=>'unavailable'})});
 await assert.rejects(()=>store.load(),/HTTP 503/);
});

test('reads trade ledger without exposing credentials and respects limit',async()=>{
 const trade={symbol:'BTCUSDT',side:'BUY',time:'2026-11-23T00:00:00.000Z',price:100,quantity:1};
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'private-test-key',fetchFn:async(url,opts)=>{
  assert.equal(opts.headers.apikey,'private-test-key');
  assert.equal(opts.method,'GET');
  assert.equal(url.pathname,'/rest/v1/trading_paper_ledger');
  assert.equal(url.searchParams.get('portfolio_id'),'eq.main');
  assert.equal(url.searchParams.get('limit'),'100');
  return {ok:true,text:async()=>JSON.stringify([{trade}])};
 }});
 assert.deepEqual(await store.listTrades({limit:999}),[trade]);
});

test('reads private decision journal in descending order',async()=>{
 const item={symbol:'BTCUSDT',action:'WAIT',candleCloseTime:123,observedAt:'2026-11-23T20:00:00Z'};
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'private',fetchFn:async(url,opts)=>{
  assert.equal(opts.method,'GET');
  assert.equal(opts.headers.apikey,'private');
  assert.equal(url.pathname,'/rest/v1/trading_paper_decisions');
  assert.equal(url.searchParams.get('portfolio_id'),'eq.main');
  assert.equal(url.searchParams.get('order'),'observed_at.desc');
  return {ok:true,text:async()=>JSON.stringify([{decision:item}])};
 }});
 assert.deepEqual(await store.listDecisions({limit:5}),[item]);
});

test('reads next-candle signal outcomes privately and enforces a safe limit',async()=>{
 const item={symbol:'BTCUSDT',signal:'watch_long',action:'WAIT',next_candle_return_pct:1.2,directional_correct:true};
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'private-test-key',fetchFn:async(url,opts)=>{
  assert.equal(opts.headers.apikey,'private-test-key');
  assert.equal(opts.method,'GET');
  assert.equal(url.pathname,'/rest/v1/trading_paper_signal_outcomes');
  assert.equal(url.searchParams.get('portfolio_id'),'eq.main');
  assert.equal(url.searchParams.get('order'),'evaluated_at.desc');
  assert.equal(url.searchParams.get('limit'),'500');
  return {ok:true,text:async()=>JSON.stringify([item])};
 }});
 assert.deepEqual(await store.listSignalOutcomes({limit:1000}),[item]);
});


test('admin access records append-only events and queries them without secrets',async()=>{
 const seen=[];
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'server-test-key',fetchFn:async(url,opts)=>{
  assert.equal(url.pathname,'/rest/v1/trading_admin_access_audit');
  assert.equal(opts.headers.apikey,'server-test-key');
  seen.push({method:opts.method,path:url.pathname,body:opts.body});
  if(opts.method==='POST')return {ok:true,text:async()=>JSON.stringify([{
   id:12,occurred_at:'2026-11-24T21:00:00Z'}])};
  return {ok:true,text:async()=>JSON.stringify([{
   id:12,portfolio_id:'main',event_type:'ADMIN_REVIEW_ACCESS',outcome:'UNAUTHORIZED',route:'gap-review',occurred_at:'2026-11-24T21:00:00Z'}])};
 }});
 const stored=await store.appendAdminReviewAccess({outcome:'UNAUTHORIZED',route:'gap-review'});
 assert.equal(stored.id,12);
 const event=JSON.parse(seen[0].body);
 assert.deepEqual(event,{portfolio_id:'main',event_type:'ADMIN_REVIEW_ACCESS',outcome:'UNAUTHORIZED',route:'gap-review'});
 assert.equal(seen[0].body.includes('server-test-key'),false);
 const list=await store.listAdminReviewAccess({limit:300});
 assert.equal(list.length,1);
 assert.equal(seen[1].method,'GET');
});
test('admin audit rejects arbitrary events and fails closed on persistence errors',async()=>{
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'test-secret',fetchFn:async()=>({
  ok:false,status:503,text:async()=>'service unavailable'
 })});
 await assert.rejects(()=>store.appendAdminReviewAccess({outcome:'AUTHORIZED',route:'gap-review'}),/HTTP 503/);
 await assert.rejects(()=>store.appendAdminReviewAccess({outcome:'INVALID'}),/Invalid admin audit event/);
 await assert.rejects(()=>store.appendAdminReviewAccess({outcome:'AUTHORIZED',route:'arbitrary'}),/Invalid admin audit event/);
});


test('paper candle is committed through one RPC, never separate portfolio and journal writes',async()=>{
 const requests=[];
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'server-test-secret',fetchFn:async(url,opts)=>{
  requests.push({path:url.pathname,method:opts.method,body:JSON.parse(opts.body)});
  return {ok:true,text:async()=>JSON.stringify({ok:true,symbol:'BTCUSDT',candleCloseTime:1795563899999})};
 }});
 const state={schema:1,lastCandle:{BTCUSDT:1795563899999},cash:10000};
 await store.save(state,{journal:{symbol:'BTCUSDT',previousClose:1795563599999,
  candleCloseTime:1795563899999,action:'WAIT',reason:'DATA_GAP_POSITION_LOCK',
  observedAt:'2026-11-24T23:45:34Z'}});
 assert.equal(requests.length,1);
 assert.equal(requests[0].path,'/rest/v1/rpc/trading_commit_paper_candle');
 assert.equal(requests[0].body.p_previous_close,1795563599999);
 assert.deepEqual(requests[0].body.p_state,state);
});
test('paper candle RPC failures and malformed acknowledgements fail closed',async()=>{
 const state={schema:1,lastCandle:{BTCUSDT:1795563899999}};
 const journal={symbol:'BTCUSDT',previousClose:null,candleCloseTime:1795563899999,
  action:'WAIT',reason:'NO_NEW_ENTRY',observedAt:'2026-11-24T23:45:34Z'};
 const unavailable=createSupabaseStore({url:'https://example.supabase.co',key:'secret',
  fetchFn:async()=>({ok:false,status:409,text:async()=>'cursor conflict'})});
 await assert.rejects(()=>unavailable.save(state,{journal}),/HTTP 409/);
 const malformed=createSupabaseStore({url:'https://example.supabase.co',key:'secret',
  fetchFn:async()=>({ok:true,text:async()=>JSON.stringify({ok:true,symbol:'BTCUSDT',candleCloseTime:1})})});
 await assert.rejects(()=>malformed.save(state,{journal}),/not acknowledged/);
 await assert.rejects(()=>malformed.save(state,{journal:{...journal,candleCloseTime:100}}),/Invalid paper candle journal payload/);
});
test('weekly paper report uses read-only RPC and verifies result shape',async()=>{
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'secret',
  fetchFn:async(url,opts)=>{
   assert.equal(url.pathname,'/rest/v1/rpc/trading_paper_journal_report');
   assert.deepEqual(JSON.parse(opts.body),{p_portfolio:'main'});
   return {ok:true,text:async()=>JSON.stringify({ok:true,mode:'PAPER_CANDLE_JOURNAL',markets:[],expected7d:2016})};
  }});
 const report=await store.reportPaperCandleJournal();
 assert.equal(report.expected7d,2016);
});
