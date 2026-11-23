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
