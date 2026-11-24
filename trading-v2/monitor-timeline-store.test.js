import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStore} from './supabase-store.js';
test('24h timeline queries bounded historical candle records from server-only Supabase',async()=>{
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'private-key',
 fetchFn:async(path,req)=>{
  assert.equal(path.pathname,'/rest/v1/trading_shadow_candles');
  assert.equal(req.method,'GET');
  assert.equal(req.headers.apikey,'private-key');
  assert.equal(path.searchParams.get('portfolio_id'),'eq.main');
  assert.equal(path.searchParams.get('candle_close_time'),'gte.1793000000000');
  assert.equal(path.searchParams.get('limit'),'1000');
  assert.equal(path.searchParams.get('select'),'symbol,candle_close_time,observed_at');
  return {ok:true,text:async()=>JSON.stringify([])};
 }});
 assert.deepEqual(await store.listTimelineObservations({since:1793000000000}),[]);
 await assert.rejects(()=>store.listTimelineObservations({since:-1}),/Invalid observation cutoff/);
});
