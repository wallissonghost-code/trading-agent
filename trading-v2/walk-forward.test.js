import test from 'node:test';
import assert from 'node:assert/strict';
import {runWalkForward} from './walk-forward.js';
import {TARGET_BARS} from './historical-market.js';
const start=1800000000000;
function fakeHistory(n=TARGET_BARS){
 let previous=100;
 return Array.from({length:n},(_,i)=>{
  const open=previous;
  const close=open*(1+.00005+Math.sin(i/31)*.0008);
  previous=close;
  const time=start+i*300000;
  return {time,closeTime:time+299999,open,close,high:Math.max(open,close)*1.001,low:Math.min(open,close)*.999};
 });
}
test('walk-forward uses four chronological independent forward folds',()=>{
 const x=runWalkForward(fakeHistory());
 assert.equal(x.foldCount,4);
 assert.equal(x.summary.length,3);
 assert.equal(x.trainDays,7);
 assert.equal(x.testDays,3);
 assert.equal(x.autoPromotionEnabled,false);
 for(const f of x.foldResults){
  assert.ok(Date.parse(f.trainTo)<Date.parse(f.testFrom));
  assert.ok(Date.parse(f.testFrom)<Date.parse(f.testTo));
 }
 for(const row of x.summary)assert.equal(row.promotionEligible,false);
});
test('multiweek laboratory refuses missing history rather than guessing',()=>{
 assert.throws(()=>runWalkForward(fakeHistory(1000)),/exactly/);
});
