import test from 'node:test';
import assert from 'node:assert/strict';
import {runStrategyLab} from './strategy-lab.js';
const makeCandles=(n=320)=>{
 let last=100;const now=Date.now()-n*300000;
 return Array.from({length:n},(_,i)=>{
  const open=last,close=open*(1+.0012+Math.sin(i/9)*.0018),high=Math.max(open,close)*1.003,low=Math.min(open,close)*.997;
  last=close;
  return {time:now+i*300000,closeTime:now+(i+1)*300000,open,high,low,close};
 });
};
test('lab compares three fixed candidates on an untouched chronological holdout',()=>{
 const result=runStrategyLab(makeCandles());
 assert.equal(result.mode,'RESEARCH_ONLY');assert.equal(result.candidates.length,3);
 assert.equal(result.trainCandles,224);assert.equal(result.testCandles,96);
 assert.equal(result.autoPromotionEnabled,false);assert.equal(result.orderExecutionEnabled,false);
 for(const row of result.candidates){
  assert.equal(typeof row.train.returnPct,'number');
  assert.equal(typeof row.test.returnPct,'number');
  assert.equal(row.promotionEligible,false);
 }
});
test('lab never fabricates positive results when the candles do not trigger a trade',()=>{
 const candles=makeCandles().map((c,i)=>({...c,open:100,close:100,high:101,low:99}));
 const r=runStrategyLab(candles);
 for(const candidate of r.candidates){
  assert.equal(candidate.test.closedTrades,0);
  assert.equal(candidate.test.winRate,null);
  assert.equal(candidate.test.netPnl,0);
 }
});
test('lab refuses insufficient or nonconsecutive candles instead of filling gaps',()=>{
 assert.throws(()=>runStrategyLab(makeCandles(80)),/180/);
 const data=makeCandles();
 data[200].closeTime+=60000;
 assert.throws(()=>runStrategyLab(data),/consecutive/);
});
