import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGapReviewCase,buildGapReviewPlan} from './gap-review-plan.js';

const sample={symbol:'BTCUSDT',locked:true,status:'MANUAL_REVIEW_REQUIRED',
 historyComplete:true,candlesExpected:4,candlesAvailable:4,candlesMissing:0,
 firstPossibleTrigger:null,confidence:'OHLC_ONLY'};
const position={symbol:'BTCUSDT',entry:60000,quantity:0.05,cost:3003,stop:59400,take:61200,
 openedAt:'2026-11-24T12:00:00.000Z',entryCandle:1795500000000};
const gap={previousCandleCloseTime:1795500000000,resumedCandleCloseTime:1795501200000,
 missedCandles:3,detectedAt:'2026-11-24T12:20:10.000Z'};
const decision={reason:'DATA_GAP_POSITION_LOCK',candleCloseTime:1795501200000};
test('review case is read only with fingerprint and no financial authority',()=>{
 const input={position,gap,decision};
 const old=structuredClone(input);
 const report=buildGapReviewCase(sample,input);
 assert.equal(report.state,'MANUAL_REVIEW_READY');
 assert.match(report.evidenceSha256,/^[a-f0-9]{64}$/);
 assert.equal(report.canUnlock,false);
 assert.equal(report.canSettle,false);
 assert.equal(report.canApproveInApp,false);
 assert.equal(report.authorization,'NOT_CONFIGURED');
 assert.deepEqual(input,old);
});
test('fingerprint stable for identical evidence and changes for changed position',()=>{
 const a=buildGapReviewCase(sample,{position,gap,decision});
 const b=buildGapReviewCase(structuredClone(sample),{position:structuredClone(position),gap:structuredClone(gap),decision:structuredClone(decision)});
 const changed=buildGapReviewCase(sample,{position:{...position,quantity:0.06},gap,decision});
 assert.equal(a.evidenceSha256,b.evidenceSha256);
 assert.notEqual(a.evidenceSha256,changed.evidenceSha256);
 assert.notEqual(a.caseId,changed.caseId);
});
test('incomplete evidence cannot be presented as ready',()=>{
 const r=buildGapReviewCase({...sample,status:'HISTORY_INCOMPLETE',historyComplete:false,candlesMissing:1},{position,gap});
 assert.equal(r.state,'EVIDENCE_INCOMPLETE');
 assert.equal(r.canUnlock,false);
});
test('both stop and target touched is flagged as ambiguous for human review',()=>{
 const r=buildGapReviewCase({...sample,firstPossibleTrigger:{classification:'BOTH_IN_SAME_CANDLE',executable:false}},{position,gap});
 assert.equal(r.state,'AMBIGUOUS_MANUAL_REVIEW');
 assert.match(r.reason,/ambíguo/i);
 assert.equal(r.canSettle,false);
});
test('unlocked symbol yields no active case or actions',()=>{
 const r=buildGapReviewCase({symbol:'ETHUSDT',locked:false,status:'NO_QUARANTINE',historyComplete:false});
 assert.equal(r.state,'NO_ACTIVE_CASE');
 assert.deepEqual(r.suggestedActions,[]);
 assert.deepEqual(r.requiredSteps,[]);
});
test('plan returns all three assets with no state mutation or approval route',()=>{
 const report={mode:'PAPER_ONLY',symbols:[
  sample,{symbol:'ETHUSDT',locked:false,status:'NO_QUARANTINE'},
  {symbol:'SOLUSDT',locked:false,status:'NO_QUARANTINE'}]};
 const paper={positions:[position],dataGaps:{BTCUSDT:gap},lastDecisions:{BTCUSDT:decision}};
 const before=structuredClone(paper);
 const plan=buildGapReviewPlan(report,paper);
 assert.deepEqual(paper,before);
 assert.equal(plan.lockedCount,1);
 assert.equal(plan.cases.length,3);
 assert.equal(plan.manualMutationsEnabled,false);
 assert.equal(plan.realOrdersEnabled,false);
 assert.equal(plan.cases[0].evidence.gap.missedCandles,3);
});
test('unsupported report and symbols are rejected',()=>{
 assert.throws(()=>buildGapReviewCase({symbol:'DOGEUSDT'}),/Unsupported/);
 assert.throws(()=>buildGapReviewPlan({mode:'LIVE',symbols:[]},{}),/Invalid/);
});
