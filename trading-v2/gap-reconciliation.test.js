import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectGapReconciliation,summarizeGapReconciliation} from './gap-reconciliation.js';

const interval=300000,baseClose=1795550000000;
const position={symbol:'BTCUSDT',entry:100,stop:95,take:110,quantity:10,cost:1001};
const gap={previousCandleCloseTime:baseClose,missedCandles:2,resumedCandleCloseTime:baseClose+3*interval};
const bar=(index,{open=100,high=103,low=97,close=101}={})=>
 ({closeTime:baseClose+index*interval,open,high,low,close});
const audit=(overrides={})=>inspectGapReconciliation({symbol:'BTCUSDT',position,gap,locked:true,
 lastCandleCloseTime:baseClose+3*interval,
 candles:[bar(1),bar(2),bar(3)],...overrides});

test('complete OHLC history only authorizes human review, never automatic liquidation',()=>{
 const result=audit();
 assert.equal(result.status,'MANUAL_REVIEW_REQUIRED');
 assert.equal(result.historyComplete,true);
 assert.equal(result.candlesExpected,3);
 assert.equal(result.candlesMissing,0);
 assert.equal(result.firstPossibleTrigger,null);
 assert.equal(result.unlockAllowed,false);
 assert.equal(result.ordersCreated,0);
 assert.equal(result.automaticExecution,false);
});
test('stop touched is historical evidence, not a booked trade',()=>{
 const result=audit({candles:[bar(1),bar(2,{low:93}),bar(3)]});
 assert.equal(result.firstPossibleTrigger.classification,'STOP_TOUCHED');
 assert.equal(result.firstPossibleTrigger.executable,false);
 assert.equal(result.status,'MANUAL_REVIEW_REQUIRED');
});
test('OHLC cannot infer whether stop or take happened first within a candle',()=>{
 const result=audit({candles:[bar(1),bar(2,{high:111,low:94}),bar(3)]});
 assert.equal(result.firstPossibleTrigger.classification,'BOTH_IN_SAME_CANDLE');
 assert.equal(result.confidence,'AMBIGUOUS_PATH');
 assert.equal(result.automaticExecution,false);
});
test('historical candles missing from server response never justify release',()=>{
 const result=audit({candles:[bar(1),bar(3)]});
 assert.equal(result.status,'HISTORY_INCOMPLETE');
 assert.equal(result.candlesMissing,1);
 assert.equal(result.unlockAllowed,false);
});
test('outside bounded fetch window is not silently classified as fully observed',()=>{
 const result=audit({maxCandles:2});
 assert.equal(result.status,'HISTORY_INCOMPLETE');
 assert.equal(result.historyComplete,false);
});
test('invalid and duplicated market bars fail closed',()=>{
 assert.equal(audit({candles:[bar(1),bar(2,{low:115,high:110}),bar(3)]}).status,'INSUFFICIENT_EVIDENCE');
 assert.equal(audit({candles:[bar(1),bar(2),bar(2),bar(3)]}).status,'INSUFFICIENT_EVIDENCE');
});
test('missing gap metadata or a position never causes implicit unlock',()=>{
 assert.equal(audit({gap:null}).status,'INSUFFICIENT_EVIDENCE');
 assert.equal(audit({position:null}).status,'INSUFFICIENT_EVIDENCE');
 assert.equal(audit({locked:false}).status,'NO_QUARANTINE');
});
test('read-only summary makes no market calls and leaves account unchanged',()=>{
 const paper={gapLocks:{BTCUSDT:true},dataGaps:{BTCUSDT:gap},
  positions:[position],lastCandle:{BTCUSDT:baseClose+3*interval}};
 const before=structuredClone(paper);
 const result=summarizeGapReconciliation(paper,{marketBySymbol:{BTCUSDT:[bar(1),bar(2),bar(3)]}});
 assert.deepEqual(paper,before);
 assert.equal(result.lockedCount,1);
 assert.deepEqual(result.symbols.map(x=>x.symbol),['BTCUSDT','ETHUSDT','SOLUSDT']);
 assert.equal(result.symbols[1].status,'NO_QUARANTINE');
 assert.equal(result.automaticUnlockEnabled,false);
 assert.equal(result.automaticFillsEnabled,false);
});
test('failed external candle query only returns diagnostic, not a position mutation',()=>{
 const paper={gapLocks:{BTCUSDT:true},dataGaps:{BTCUSDT:gap},
  positions:[position],lastCandle:{BTCUSDT:baseClose+3*interval}};
 const result=summarizeGapReconciliation(paper,{errorsBySymbol:{BTCUSDT:'503'}});
 assert.equal(result.symbols[0].status,'MARKET_DATA_UNAVAILABLE');
 assert.equal(result.symbols[0].confidence,'UNKNOWN');
 assert.equal(result.symbols[0].unlockAllowed,false);
 assert.equal(paper.positions.length,1);
});
