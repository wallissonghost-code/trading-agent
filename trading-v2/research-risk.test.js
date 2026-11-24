import test from 'node:test';
import assert from 'node:assert/strict';
import {explainResearchRisk} from './research-risk.js';
import {FILTER_SCENARIOS} from './entry-filter-research.js';
function candles(n=110){
 let p=100;const base=1793000000000;
 return Array.from({length:n},(_,i)=>{
  const open=p,close=p*(1+.00022+Math.sin(i/9)*.0014);p=close;
  return {time:base+i*300000,closeTime:base+(i+1)*300000-1,
   open,close,high:Math.max(open,close)*1.002,low:Math.min(open,close)*.998};
 });
}
test('frozen entry rules explain each unmet condition without altering simulation',()=>{
 const c=candles(),r=explainResearchRisk(c,{symbol:'BTCUSDT',now:c.at(-1).closeTime+10000});
 assert.equal(r.scenarios.length,4);
 assert.deepEqual(r.scenarios.map(x=>x.key),FILTER_SCENARIOS.map(x=>x.key));
 for(const scenario of r.scenarios){
  assert.equal(scenario.eligibleForResearch,scenario.conditions.every(x=>x.pass));
  assert.deepEqual(scenario.blockedBy,scenario.conditions.filter(x=>!x.pass).map(x=>x.key));
 }
 assert.equal(r.realOrdersEnabled,false);
 assert.equal(r.autoPromotionEnabled,false);
 assert.equal(r.decisionExecutionEnabled,false);
});
test('stale candles suppress all readiness decisions and maintain risk caveat',()=>{
 const c=candles(),r=explainResearchRisk(c,{now:c.at(-1).closeTime+20*60000});
 assert.equal(r.dataFresh,false);
 assert.ok(r.scenarios.every(x=>x.decision==='DATA_STALE'&&!x.eligibleForResearch));
 assert.match(r.riskProxy.caveat,/Gaps/);
});
test('sizing proxy stays within 1% risk estimate and 50% exposure',()=>{
 const c=candles(),r=explainResearchRisk(c,{now:c.at(-1).closeTime+10000});
 const x=r.riskProxy;
 assert.ok(x.indicativeQuantity*x.indicativeEntry<=x.notionalLimitUsd+.1);
 assert.ok(x.estimatedStopPnLUsd>=-x.riskBudgetUsd-.1);
 assert.ok(x.estimatedTargetPnLUsd!==null);
 assert.ok(x.indicativeStop<x.indicativeEntry&&x.indicativeTarget>x.indicativeEntry);
});
test('gaps and malformed market data must never be interpreted as entry-ready',()=>{
 const c=candles();c[30]={...c[30],time:c[30].time+300000};
 assert.throws(()=>explainResearchRisk(c),/Invalid or gapped/);
});
