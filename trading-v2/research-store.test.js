import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStore} from './supabase-store.js';
const url='https://example.supabase.co';
test('research results are server-only and identified by symbol and study period',async()=>{
 const report={ok:true,symbol:'BTCUSDT',from:'2026-10-26T00:00:00Z',to:'2026-11-23T00:00:00Z',summary:[]};
 const store=createSupabaseStore({url,key:'server-only',fetchFn:async(request,options)=>{
  assert.equal(request.pathname,'/rest/v1/trading_research_reports');
  assert.equal(options.method,'POST');
  assert.equal(options.headers.apikey,'server-only');
  const body=JSON.parse(options.body);
  assert.equal(body.study_kind,'WALK_FORWARD_28D_V1');
  assert.equal(body.portfolio_id,'main');
  assert.equal(body.report.symbol,'BTCUSDT');
  return {ok:true,text:async()=>JSON.stringify([body])};
 }});
 await store.saveResearchReport(report);
});
test('news archive exposes publisher metadata but never Supabase keys',async()=>{
 const item={source:'Federal Reserve',url:'https://www.federalreserve.gov/example',title:'Federal Reserve statement',publishedAt:'2026-11-23T20:00:00Z',fetchedAt:'2026-11-23T20:02:00Z',relatedSymbols:[],category:'MACRO'};
 let called=0;
 const store=createSupabaseStore({url,key:'server-secret',fetchFn:async(request,options)=>{
  called++;
  if(options.method==='POST'){
   assert.equal(request.pathname,'/rest/v1/trading_research_news');
   assert.equal(options.headers.apikey,'server-secret');
   const rows=JSON.parse(options.body);
   assert.equal(rows[0].source,'Federal Reserve');
   assert.equal(rows[0].first_seen_at,item.fetchedAt);
   assert.match(options.headers.prefer,/ignore-duplicates/);
   return {ok:true,text:async()=>JSON.stringify(rows)};
  }
  assert.equal(request.searchParams.get('limit'),'25');
  return {ok:true,text:async()=>JSON.stringify([{source:item.source,url:item.url,title:item.title,published_at:item.publishedAt,fetched_at:item.fetchedAt,first_seen_at:item.fetchedAt,related_symbols:[],context_category:'MACRO'}])};
 }});
 await store.saveNews([item]);
 assert.deepEqual(await store.listNews(),[{...item,firstSeenAt:item.fetchedAt}]);
 assert.equal(called,2);
});

test('outcome storage is idempotent and does not expose a trade action',async()=>{
 const report={source:'CoinDesk',url:'https://www.coindesk.com/markets/abc',symbol:'BTCUSDT',observedAfter:'2026-11-23T21:00:00Z',baselineCandleOpenTime:1795467900000,baselinePrice:100,outcomeCandleCloseTime:1795471499999,outcomePrice:101,returnPct:1};
 let count=0;
 const store=createSupabaseStore({url,key:'secret',fetchFn:async(request,options)=>{
  count++;
  assert.equal(options.headers.apikey,'secret');
  assert.equal(request.pathname,'/rest/v1/trading_news_price_outcomes');
  if(options.method==='POST'){
   assert.match(options.headers.prefer,/ignore-duplicates/);
   const body=JSON.parse(options.body);
   assert.equal(body[0].horizon_minutes,60);
   return {ok:true,text:async()=>'[]'};
  }
  return {ok:true,text:async()=>JSON.stringify([{source:report.source,url:report.url,symbol:report.symbol,observed_after:report.observedAfter,return_pct:report.returnPct,baseline_price:report.baselinePrice,outcome_price:report.outcomePrice,evaluated_at:'2026-11-23T22:00:00Z'}])};
 }});
 assert.deepEqual(await store.saveNewsOutcomes([report]),[]);
 const outcomes=await store.listNewsOutcomes();
 assert.equal(outcomes[0].returnPct,1);
 assert.equal(count,2);
});
