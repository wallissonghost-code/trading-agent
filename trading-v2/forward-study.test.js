import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForwardObservation,summarizeForwardStudy,FORWARD_VERSION} from './forward-study.js';
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
