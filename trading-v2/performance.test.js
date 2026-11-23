import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from './performance.js';
test('empty portfolio analytics never invent results',()=>{
 const r=performance([]);
 assert.equal(r.closed,0);assert.equal(r.winRate,null);
 assert.equal(r.curve.length,1);assert.equal(r.netPnl,0);
 assert.equal(r.learningMode,'observation_only');
});
test('calculates closed-trade stats and realized equity curve',()=>{
 const r=performance([
 {side:'SELL',symbol:'BTCUSDT',realizedPnl:-40,time:'2026-01-02T00:00:00Z'},
 {side:'BUY',symbol:'BTCUSDT',realizedPnl:null,time:'2026-01-01T00:00:00Z'},
 {side:'SELL',symbol:'BTCUSDT',realizedPnl:60,time:'2026-01-01T00:00:00Z'},
 {side:'SELL',symbol:'ETHUSDT',realizedPnl:20,time:'2026-01-03T00:00:00Z'}
 ]);
 assert.equal(r.closed,3);assert.equal(r.winRate,66.67);
 assert.equal(r.averageWin,40);assert.equal(r.averageLoss,40);
 assert.equal(r.profitFactor,2);assert.equal(r.netPnl,40);
 assert.deepEqual(r.curve.map(x=>x.equity),[10000,10060,10020,10040]);
 assert.equal(r.bySymbol.BTCUSDT.closed,2);
});
