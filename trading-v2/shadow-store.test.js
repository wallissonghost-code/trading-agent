import test from 'node:test';import assert from 'node:assert/strict';
import {createSupabaseStore} from './supabase-store.js';
const base='https://example.supabase.co';
test('read frozen shadow model with all risk bounds and 30 minute cooldown',async()=>{
 const store=createSupabaseStore({url:base,key:'private',fetchFn:async(path,options)=>{
  assert.equal(options.headers.apikey,'private');
  assert.equal(options.method,'GET');
  assert.equal(path.pathname,'/rest/v1/trading_shadow_studies');
  assert.equal(path.searchParams.get('version'),'eq.shadow-v1-20261124');
  assert.ok(path.searchParams.get('select').includes('cooldown_bars'));
  return {ok:true,text:async()=>JSON.stringify([{version:'shadow-v1-20261124',cooldown_bars:6}])};
 }});
 assert.equal((await store.getFrozenShadowStudy()).cooldown_bars,6);
});
test('shadow OHLC observations are stored only server-side, never with user credentials',async()=>{
 const store=createSupabaseStore({url:base,key:'server-secret',fetchFn:async(path,options)=>{
  assert.equal(path.pathname,'/rest/v1/trading_shadow_candles');
  assert.equal(options.headers.Authorization,'Bearer server-secret');
  assert.match(options.headers.prefer,/ignore-duplicates/);
  const row=JSON.parse(options.body);
  assert.equal(row.candle_high,105);
  assert.equal(row.candle_low,95);
  assert.equal(row.stop_distance,2.5);
  assert.equal(row.portfolio_id,'main');
  assert.equal(row.observed_at,undefined);
  return {ok:true,text:async()=>JSON.stringify([row])};
 }});
 assert.equal(await store.insertShadowObservation({version:'shadow-v1-20261124',symbol:'BTCUSDT',
  candleOpenTime:1795478400000,candleCloseTime:1795478699999,
  candleOpen:100,candleHigh:105,candleLow:95,candleClose:102,
  atr14:1.5,stopDistance:2.5,
  signals:{reference:true,trend_confirmed:false,volatility_screen:false,combined:false}}),true);
});
test('shadow trade report has read-only ledger query and bounded history',async()=>{
 const store=createSupabaseStore({url:base,key:'private',fetchFn:async(path,options)=>{
  assert.equal(options.method,'GET');
  assert.equal(path.pathname,'/rest/v1/trading_shadow_trades');
  assert.equal(path.searchParams.get('limit'),'500');
  assert.equal(path.searchParams.get('version'),'eq.shadow-v1-20261124');
  return {ok:true,text:async()=>'[]'};
 }});
 assert.deepEqual(await store.listShadowTrades(),[]);
});
