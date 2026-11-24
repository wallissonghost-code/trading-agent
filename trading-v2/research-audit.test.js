import test from 'node:test';import assert from 'node:assert/strict';
import {auditWalkForwardReports} from './research-audit.js';
const report={symbol:'BTCUSDT',horizonDays:28,trainDays:7,testDays:3,foldCount:4,
 foldResults:[{},{},{},{}],summary:[{id:'baseline',label:'EMA',testFolds:4,closedTrades:52,positiveFolds:1,
 meanTestReturnPct:-1.83,worstTestReturnPct:-4.9,worstTestDrawdownPct:4.83}]};
test('research audit refuses to approve a losing candidate despite many trades',()=>{
 const x=auditWalkForwardReports([{completed_at:'2026-11-24T01:00:00Z',report}]);
 assert.equal(x.candidateCount,1);assert.equal(x.approved,0);
 const c=x.bySymbol.BTCUSDT.candidates[0];assert.equal(c.approved,false);
 assert.ok(c.issues.includes('NEGATIVE_MEAN_HOLDOUT_RETURN'));
 assert.ok(c.issues.includes('INCONSISTENT_POSITIVE_FOLDS'));
});
test('even strong short holdout performance cannot automatically promote a strategy',()=>{
 const strong={...report,summary:[{...report.summary[0],meanTestReturnPct:2,worstHoldoutReturnPct:1,worstTestReturnPct:1,positiveFolds:4}]};
 const x=auditWalkForwardReports([{completed_at:'2026-11-24T01:00:00Z',report:strong}]);
 assert.equal(x.bySymbol.BTCUSDT.candidates[0].approved,false);
 assert.ok(x.bySymbol.BTCUSDT.candidates[0].issues.includes('NEEDS_LONGER_INDEPENDENT_VALIDATION'));
});
test('auditor picks latest stored study and ignores malformed reports',()=>{
 const old={...report,summary:[{...report.summary[0],meanTestReturnPct:99}]};
 const x=auditWalkForwardReports([{completed_at:'2026-11-23T00:00:00Z',report:old},
 {completed_at:'2026-11-24T01:00:00Z',report},{completed_at:'2026-11-24T02:00:00Z',report:{symbol:'DOGEUSDT',summary:[]}}]);
 assert.equal(x.bySymbol.BTCUSDT.candidates[0].averageHoldoutReturnPct,-1.83);
 assert.equal(x.symbolsReviewed,1);
});
