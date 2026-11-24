import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForwardObservation,summarizeForwardStudy,FORWARD_VERSION,verifyFrozenForwardConfig,SHADOW_VERSION,verifyShadowStudy,buildShadowObservation,summarizeShadowTrades} from './forward-study.js';
import {FILTER_SCENARIOS} from './entry-filter-research.js';
const BASE=1793000000000;
function history(n=100){let p=100;return Array.from({length:n},(_,i)=>{const open=p;const close=p*(1+.0002+Math.sin(i/21)*.0012);p=close;return {
 time:BASE+i*300000,closeTime:BASE+(i+1)*300000-1,
 open,close,high:Math.max(open,close)*1.002,low:Math.min(open,close)*.998
};});}
test('signal snapshots are made strictly from closed historical information at the collection time',()=>{
 const c=history();const last=c.at(-1);
 const o=buildForwardObservation(c,{symbol:'BTCUSDT',
  studyStartedAt:new Date(last.closeTime-3600000).toISOString(),now:last.closeTime+20000});
 assert.equal(o.status,'ready');assert.equal(o.version,FORWARD_VERSION);
 assert.deepEqual(Object.keys(o.signals),['reference','trend_confirmed','volatility_screen','combined']);
 assert.equal(o.executionEnabled,false);
 assert.ok(!o.signals.combined||o.signals.reference);
});
test('prospective collector never backfills missing, old, or pre-frozen candles',()=>{
 const c=history();const last=c.at(-1);
 assert.equal(buildForwardObservation(c,{symbol:'BTCUSDT',studyStartedAt:new Date(last.closeTime+5000).toISOString(),now:last.closeTime+20000}).status,'not_started');
 assert.equal(buildForwardObservation(c,{symbol:'BTCUSDT',studyStartedAt:new Date(last.closeTime-10000).toISOString(),now:last.closeTime+13*60000}).status,'stale');
 const broken=[...c];broken[75]={...broken[75],time:broken[75].time+300000};
 assert.throws(()=>buildForwardObservation(broken,{symbol:'BTCUSDT',studyStartedAt:new Date(last.closeTime-10000).toISOString(),now:last.closeTime+20000}),/Gap/);
});
test('reports insufficient independent evidence and never presents per-bar comparisons as profits',()=>{
 const v=summarizeForwardStudy({study:{version:FORWARD_VERSION,started_at:'2026-11-24T01:00:00Z'},
 observations:[],outcomes:[]});
 assert.equal(v.sampleAdequacy,'INSUFFICIENT');
 assert.equal(v.bySymbol.BTCUSDT.scenarios.reference.meanModeledNetReturnPct,null);
 assert.equal(v.autoPromotionEnabled,false);
 assert.match(v.note,/not the stop\/take trading strategy P&L/);
});

test('frozen study verification prevents silent changes to ATR, RSI or risk-cost parameters',()=>{
 const study={version:FORWARD_VERSION,started_at:'2026-11-24T01:58:52Z',
  horizon_minutes:5,fees_bps:10,slippage_bps:5,
  configs:Object.fromEntries(FILTER_SCENARIOS.map(s=>[s.key,{...s.filters,rsiMin:55,rsiMax:65}]))};
 assert.equal(verifyFrozenForwardConfig(study),true);
 assert.throws(()=>verifyFrozenForwardConfig({...study,fees_bps:0}),/mismatch/);
 const wrong=JSON.parse(JSON.stringify(study));
 wrong.configs.combined.minAtrPct=.50;
 assert.throws(()=>verifyFrozenForwardConfig(wrong),/parameter drift/);
});

test('frozen shadow execution uses ATR stop, full OHLC and independent journal',()=>{
 const c=history();const last=c.at(-1);
 const snapshot=buildShadowObservation(c,{symbol:'BTCUSDT',studyStartedAt:new Date(last.closeTime-60000).toISOString(),now:last.closeTime+10000});
 assert.equal(snapshot.version,SHADOW_VERSION);
 assert.equal(snapshot.candleHigh,last.high);
 assert.equal(snapshot.candleLow,last.low);
 assert.ok(snapshot.stopDistance>0);
 assert.equal(snapshot.executionEnabled,false);
 assert.ok(snapshot.signals.combined===false||snapshot.signals.reference===true);
});
test('shadow study fails if any execution risk or filter parameters drift',()=>{
 const configs=Object.fromEntries(FILTER_SCENARIOS.map(x=>[x.key,{...x.filters,rsiMin:55,rsiMax:65}]));
 const model={version:SHADOW_VERSION,started_at:'2026-11-24T02:13:50Z',
  fee_bps:10,slippage_bps:5,risk_budget_pct:1,max_exposure_pct:50,
  atr_multiplier:2.5,target_r_multiple:2,max_holding_bars:24,cooldown_bars:6,configs};
 assert.equal(verifyShadowStudy(model),true);
 assert.throws(()=>verifyShadowStudy({...model,max_exposure_pct:100}),/mismatch/);
 assert.throws(()=>verifyShadowStudy({...model,cooldown_bars:0}),/mismatch/);
 const out=summarizeShadowTrades({study:model,trades:[
   {symbol:'BTCUSDT',scenario:'reference',status:'OPEN',entry_fill:100,stop_price:98,
     target_price:104,exit_fill:null,realized_pnl_usd:null,net_return_pct:null},
   {symbol:'BTCUSDT',scenario:'reference',status:'CLOSED',entry_fill:100,stop_price:98,
     target_price:104,exit_fill:104,realized_pnl_usd:12,net_return_pct:3.9,exit_reason:'TARGET'},
   {symbol:'BTCUSDT',scenario:'reference',status:'INVALIDATED',entry_fill:100,stop_price:98,
     target_price:104,exit_fill:null,realized_pnl_usd:null,net_return_pct:null,exit_reason:'DATA_GAP'}
 ]});
 assert.equal(out.closed,1);
 assert.equal(out.open,1);
 assert.equal(out.invalidated,1);
 assert.equal(out.bySymbol.BTCUSDT.scenarios.reference.totalRealizedPnlUsd,12);
 assert.equal(out.bySymbol.BTCUSDT.scenarios.reference.approved,false);
 assert.equal(out.orderExecutionEnabled,false);
});
