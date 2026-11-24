import test from 'node:test';import assert from 'node:assert/strict';
import {reviewShadowStops} from './stop-review.js';
const t=1795501199999;
const observation=(offset,close=100,atr=0.3)=>({
 symbol:'ETHUSDT',candle_close_time:t-offset*300000,candle_close:close,
 atr14:atr});
const trade=(scenario='reference',reason='STOP',pnl=-12)=>({
 status:'CLOSED',symbol:'ETHUSDT',scenario,realized_pnl_usd:pnl,
 signal_candle_close_time:t,entry_fill:101,stop_price:99,target_price:105,
 exit_reason:reason,exit_candle_close_time:t+300000});
test('does not mistake duplicated strategy signals for independent entries',()=>{
 const x=reviewShadowStops({trades:[trade(),trade('combined','TIME_LIMIT',-10)],
 observations:Array.from({length:7},(_,i)=>observation(i,100-i*.2))});
 assert.equal(x.closed,2);
 assert.equal(x.uniquePerSymbolSignalCandles,1);
 assert.equal(x.bySymbol.ETHUSDT.stopExits,1);
 assert.equal(x.bySymbol.ETHUSDT.timeLimitExits,1);
 assert.equal(x.bySymbol.ETHUSDT.missingSignalContext,0);
 assert.equal(x.bySymbol.ETHUSDT.recent[0].volatilityRegime,'ATR_HIGH');
 assert.equal(x.bySymbol.ETHUSDT.recent[0].trendRegime,'RISING_6_BARS');
 assert.equal(x.realOrdersEnabled,false);
 assert.equal(x.approved,false);
});
test('missing signal candle and prior six bars are unknown, not invented',()=>{
 const x=reviewShadowStops({trades:[trade()],observations:[observation(1)]});
 const e=x.bySymbol.ETHUSDT.recent[0];
 assert.equal(e.signalAtrPct,null);
 assert.equal(e.volatilityRegime,'UNKNOWN');
 assert.equal(e.trendRegime,'UNKNOWN');
 assert.equal(x.bySymbol.ETHUSDT.missingSignalContext,1);
});
test('only finalized, valid scenario journal entries count',()=>{
 const incomplete={...trade(),status:'OPEN',realized_pnl_usd:null};
 const invalid={...trade(),status:'INVALIDATED',realized_pnl_usd:null};
 const bogus={...trade(),symbol:'FAKE'};
 const x=reviewShadowStops({trades:[incomplete,invalid,bogus],partialObservations:true});
 assert.equal(x.closed,0);
 assert.equal(x.partialObservations,true);
});
test('six-bar momentum never depends on a future candle',()=>{
 const rows=[...Array.from({length:7},(_,i)=>observation(i,100-i)),observation(-1,1000)];
 const x=reviewShadowStops({trades:[trade()],observations:rows});
 assert.equal(x.bySymbol.ETHUSDT.recent[0].signalMomentum6Pct,roundTest((100/94-1)*100));
});
function roundTest(n){return Math.round(n*1000)/1000;}
