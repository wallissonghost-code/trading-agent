import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseStrategyLosses} from './loss-diagnostics.js';
import {TARGET_BARS} from './historical-market.js';
const start=1793000000000;
function candles(n=TARGET_BARS){
 let prev=100;
 return Array.from({length:n},(_,i)=>{
  const open=prev,close=open*(1+.00015+Math.sin(i/19)*.0011);
  prev=close;const time=start+i*300000;
  return {time,closeTime:time+299999,open,close,high:Math.max(open,close)*1.002,low:Math.min(open,close)*.998};
 });
}
test('diagnostics compare three cost models on identical chronological folds',()=>{
 const d=diagnoseStrategyLosses(candles());
 assert.equal(d.foldCount,4);assert.equal(d.candidates.length,3);
 assert.equal(d.costAssumptions.length,3);
 for(const c of d.candidates){
  assert.equal(c.approved,false);
  assert.equal(c.estimatedCostSensitivityPp,Math.round((c.meanReturnNoCostsPct-c.meanReturnBasePct)*100)/100);
  assert.equal(c.folds,4);
 }
 assert.equal(d.safeguards.realOrdersEnabled,false);
});
test('diagnostics never interpret a cost-free backtest as a proof of profitability',()=>{
 const d=diagnoseStrategyLosses(candles());
 assert.equal(d.candidates.every(c=>c.status==='EXPLORATORY_ONLY'),true);
 assert.match(d.interpretation,/not an exact attribution/);
 assert.throws(()=>diagnoseStrategyLosses(candles(300)),/28 days/);
});
