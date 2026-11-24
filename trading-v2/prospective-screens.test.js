import test from 'node:test';import assert from 'node:assert/strict';
import {SCREEN_VERSION,SCREEN_KEYS,verifyScreenStudy,buildScreenObservation,summarizeScreenStudy} from './prospective-screens.js';
const T=1796000000000;
function candles(n=100){
 let p=100;return Array.from({length:n},(_,i)=>{
 const open=p,close=p*(1+.0002+Math.sin(i/20)*.0003);p=close;
 return {time:T+i*300000,closeTime:T+(i+1)*300000-1,open,close,
 high:Math.max(open,close)*1.003,low:Math.min(open,close)*.997};
 });
}
const study={version:SCREEN_VERSION,started_at:'2026-11-24T08:00:00Z',
 horizon_minutes:5,fee_bps:10,slippage_bps:5,
 config:{screens:{reference:{},atr_at_least_025:{minAtrPct:.25},
 momentum_6_positive:{minMomentum6PctExclusive:0},
 atr_and_momentum:{minAtrPct:.25,minMomentum6PctExclusive:0}}}};
test('frozen screen config cannot silently drift',()=>{
 assert.equal(verifyScreenStudy(study),true);
 assert.throws(()=>verifyScreenStudy({...study,fee_bps:0}),/mismatch/);
 const bad=structuredClone(study);bad.config.screens.atr_and_momentum.minAtrPct=.4;
 assert.throws(()=>verifyScreenStudy(bad),/changed/);
});
test('screen signals are subordinated to reference rule and never execute',()=>{
 const c=candles(),last=c.at(-1);
 const o=buildScreenObservation(c,{symbol:'ETHUSDT',now:last.closeTime+10000,studyStartedAt:new Date(last.closeTime-1000).toISOString()});
 assert.equal(o.status,'ready');assert.equal(o.version,SCREEN_VERSION);
 assert.deepEqual(Object.keys(o.signals),SCREEN_KEYS);
 assert.ok(!o.signals.atr_and_momentum||o.signals.reference);
 assert.ok(!o.signals.atr_and_momentum||o.signals.atr_at_least_025&&o.signals.momentum_6_positive);
 assert.equal(o.executionEnabled,false);
});
test('stale or pre-start snapshots never create study observations',()=>{
 const c=candles(),last=c.at(-1);
 assert.equal(buildScreenObservation(c,{symbol:'BTCUSDT',now:last.closeTime+14*60000,
 studyStartedAt:new Date(last.closeTime-1000).toISOString()}).status,'stale');
 assert.equal(buildScreenObservation(c,{symbol:'BTCUSDT',now:last.closeTime+10000,
 studyStartedAt:new Date(last.closeTime+1000).toISOString()}).status,'not_started');
});
test('results show no false profit or approvals when study has no outcomes',()=>{
 const x=summarizeScreenStudy({study,observations:[],outcomes:[]});
 assert.equal(x.bySymbol.ETHUSDT.scenarios.reference.averageModeledNetReturnPct,null);
 assert.equal(x.realOrdersEnabled,false);
 assert.equal(x.sampleAdequacy,'INSUFFICIENT');
});
