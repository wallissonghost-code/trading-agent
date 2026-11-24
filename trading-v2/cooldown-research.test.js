import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCooldowns} from './cooldown-research.js';
import {TARGET_BARS} from './historical-market.js';
const base=1793000000000;
const candles=(n=TARGET_BARS)=>{
 let p=100;
 return Array.from({length:n},(_,i)=>{
  const open=p,close=p*(1+.00008+Math.sin(i/13)*.0014);p=close;
  return {time:base+i*300000,closeTime:base+(i+1)*300000-1,
   open,close,high:Math.max(open,close)*1.002,low:Math.min(open,close)*.998};
 });
};
test('30m and 60m pauses do not increase trade count and never change live execution',()=>{
 const r=compareCooldowns(candles());
 assert.equal(r.candidates.length,3);
 assert.equal(r.folds,4);
 for(const c of r.candidates){
  assert.equal(c.scenarios.length,3);
  assert.equal(c.scenarios[0].key,'unchanged');
  assert.ok(c.scenarios[1].closedTrades<=c.scenarios[0].closedTrades);
  assert.ok(c.scenarios[2].closedTrades<=c.scenarios[0].closedTrades);
  assert.equal(c.promotionEligible,false);
 }
 assert.equal(r.orderExecutionEnabled,false);
});
test('incomplete research sample is rejected instead of imputed',()=>{
 assert.throws(()=>compareCooldowns(candles(300)),/28 days/);
});
