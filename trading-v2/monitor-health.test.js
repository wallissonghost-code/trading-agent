import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMonitoring} from './monitor-health.js';
const now=1800000300000;
const row=(symbol,offset=0,signals={reference:false})=>({
 symbol,candle_close_time:now-150000-offset*300000,
 observed_at:new Date(now-130000-offset*300000).toISOString(),signals});
const all=['BTCUSDT','ETHUSDT','SOLUSDT'];
test('healthy latest data and no eligible signals does not mean broken bots',()=>{
 const x=summarizeMonitoring({observations:all.map(x=>row(x)),now});
 assert.equal(x.status,'HEALTHY');
 assert.equal(x.symbols[0].signalState,'NO_ELIGIBLE_SIGNALS');
 assert.equal(x.symbols[0].warnings.length,0);
 assert.equal(x.orderExecutionEnabled,false);
});
test('missed collection and failed symbol are reported separately',()=>{
 const observations=[row('BTCUSDT',6),row('ETHUSDT'),row('SOLUSDT')];
 const x=summarizeMonitoring({observations,now,capture:{sources:[{symbol:'SOLUSDT',status:'error'}]}});
 assert.equal(x.status,'ERROR');
 assert.equal(x.symbols[0].status,'STALE_DATA');
 assert.equal(x.symbols[1].status,'MONITORING');
 assert.equal(x.symbols[2].status,'COLLECTION_ERROR');
 assert.equal(x.symbols[0].signalState,'UNKNOWN_DATA_NOT_CURRENT');
});
test('detect gaps but do not reconstruct missed candles',()=>{
 const x=summarizeMonitoring({observations:[
 ...all.map(s=>row(s)),row('BTCUSDT',2)],now});
 assert.equal(x.symbols[0].gapsInLast50,1);
 assert.equal(x.symbols[0].observationsInWindow,2);
});
test('empty store does not falsely report healthy or signal absence',()=>{
 const x=summarizeMonitoring({now,serviceStartedAt:new Date(now-25000).toISOString()});
 assert.equal(x.status,'INITIALIZING');
 assert.equal(x.symbols[0].signalState,'UNKNOWN_DATA_NOT_CURRENT');
 assert.equal(x.serviceUptimeSeconds,25);
});
