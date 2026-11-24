import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEntryFilters,FILTER_SCENARIOS} from './entry-filter-research.js';
import {runStrategyLab} from './strategy-lab.js';
import {TARGET_BARS} from './historical-market.js';
function history(n=TARGET_BARS){
 let last=100;const base=1793000000000;
 return Array.from({length:n},(_,i)=>{
  const open=last,close=open*(1+.00012+Math.sin(i/17)*.0016);last=close;
  return {time:base+i*300000,closeTime:base+(i+1)*300000-1,open,close,
   high:Math.max(open,close)*1.002,low:Math.min(open,close)*.998};
 });
}
test('entry filters compare fixed four scenarios on the same holdouts',()=>{
 const r=compareEntryFilters(history());
 assert.equal(r.testFolds,4);
 assert.equal(r.scenarios.length,4);
 assert.equal(r.scenarios[0].improvementVsReferencePp,0);
 for(const x of r.scenarios)assert.equal(x.approved,false);
 assert.equal(r.autoPromotionEnabled,false);assert.equal(r.orderExecutionEnabled,false);
});
test('filters only remove reference signals and preserve default strategy behavior',()=>{
 const data=history(320);
 const base=runStrategyLab(data);
 const identical=runStrategyLab(data,{entryFilters:FILTER_SCENARIOS[0].filters});
 assert.deepEqual(base.candidates,identical.candidates);
 const screened=runStrategyLab(data,{entryFilters:{minEmaSpreadPct:.12,minAtrPct:.25,minTrendBars:3}});
 for(let i=0;i<3;i++){
  assert.ok(screened.candidates[i].train.entries<=base.candidates[i].train.entries);
 }
});
test('reject invalid filters and historical gaps rather than estimate fictitious outcomes',()=>{
 const data=history(320);
 assert.throws(()=>runStrategyLab(data,{entryFilters:{minTrendBars:0}}),/Invalid research entry filter/);
 assert.throws(()=>runStrategyLab(data,{entryFilters:{minAtrPct:-1}}),/Invalid research entry filter/);
 assert.throws(()=>compareEntryFilters(history(300)),/28 days/);
});
