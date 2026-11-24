import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeObservedCoverage,COVERAGE_WINDOW_MS,SLOT_MS} from './monitor-coverage.js';
const NOW=1800000000000;
const end=Math.floor(NOW/SLOT_MS)*SLOT_MS-1;
const make=(symbol,offset=0)=>({symbol,candle_close_time:end-offset*SLOT_MS});
test('reports candle coverage without calling it service uptime',()=>{
 const x=summarizeObservedCoverage({now:NOW,observations:[make('BTCUSDT'),make('BTCUSDT',1),make('ETHUSDT')]});
 assert.equal(x.windowHours,6);
 assert.equal(x.expectedSlotsPerMarket,72);
 assert.equal(x.bySymbol.BTCUSDT.recordedSlots,2);
 assert.equal(x.bySymbol.BTCUSDT.unobservedSlots,70);
 assert.equal(x.bySymbol.SOLUSDT.observedCoveragePct,0);
 assert.equal(x.bySymbol.BTCUSDT.sufficientForTrueUptime,false);
 assert.match(x.notice,/NOT 24\/7 uptime/);
 assert.equal(x.orderExecutionEnabled,false);
});
test('duplicate candle observations and entries outside window never inflate coverage',()=>{
 const x=summarizeObservedCoverage({now:NOW,observations:[make('BTCUSDT'),make('BTCUSDT'),make('BTCUSDT',72)]});
 assert.equal(x.bySymbol.BTCUSDT.recordedSlots,1);
 assert.equal(x.bySymbol.BTCUSDT.unobservedIntervals,1);
 assert.equal(x.bySymbol.BTCUSDT.longestUnobservedRunMinutes,355);
});
test('issues and recovery counts remain detection counts, not exact outage durations',()=>{
 const x=summarizeObservedCoverage({now:NOW,events:[{symbol:'ETHUSDT',kind:'ISSUE_STARTED'},
 {symbol:'ETHUSDT',kind:'RECOVERED'}],states:[{symbol:'ETHUSDT',status:'MONITORING'}]});
 assert.equal(x.bySymbol.ETHUSDT.incidentStartedEvents,1);
 assert.equal(x.bySymbol.ETHUSDT.recoveryEvents,1);
 assert.equal(x.bySymbol.ETHUSDT.currentObservedState,'MONITORING');
 assert.equal(x.bySymbol.ETHUSDT.sufficientForTrueUptime,false);
});
