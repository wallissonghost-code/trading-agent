import test from 'node:test';import assert from 'node:assert/strict';
import {comparePreSignalHypotheses,SCREEN_HYPOTHESES} from './hypothesis-screen.js';
const T=1795501199999;
const candle=(i,{atr=.4,price=100+i}={})=>({symbol:'ETHUSDT',candle_close_time:T-i*300000,candle_close:price,atr14:atr});
const trade=(scenario='reference',pnl=-14)=>({symbol:'ETHUSDT',scenario,status:'CLOSED',signal_candle_close_time:T,exit_candle_close_time:T+300000,realized_pnl_usd:pnl});
test('screens only reference scenario and does not claim excluded losses are saved',()=>{
 const x=comparePreSignalHypotheses({trades:[trade(),trade('combined',100)],observations:
  Array.from({length:7},(_,i)=>candle(i,{price:100-i}))});
 assert.equal(x.closedReferenceTrades,1);
 assert.equal(x.bySymbol.ETHUSDT.scenarios.length,3);
 const atr=x.bySymbol.ETHUSDT.scenarios[0];
 assert.equal(atr.kept.count,1);
 assert.equal(atr.kept.observedNetPnlUsd,-14);
 assert.equal(x.strategyParametersChanged,false);
 assert.equal(x.autoPromotionEnabled,false);
 assert.equal(x.realOrdersEnabled,false);
 assert.match(x.interpretation,/não equivale a lucro economizado/);
});
test('missing pre-entry history is unknown, never treated as passing or excluded',()=>{
 const x=comparePreSignalHypotheses({trades:[trade()],observations:[candle(0)]});
 const rows=x.bySymbol.ETHUSDT.scenarios;
 assert.equal(rows[0].kept.count,1);
 assert.equal(rows[1].unknownContext,1);
 assert.equal(rows[1].evaluated,0);
 assert.equal(rows[2].unknownContext,1);
});
test('duplicate reference signal is marked ambiguous and removed from comparisons',()=>{
 const x=comparePreSignalHypotheses({trades:[trade(),trade('reference',-2)],observations:[candle(0)]});
 assert.equal(x.bySymbol.ETHUSDT.ambiguousDuplicateSignals,1);
 assert.equal(x.closedReferenceTrades,0);
});
test('future candles cannot influence past signal indicators',()=>{
 const history=[...Array.from({length:7},(_,i)=>candle(i,{price:100-i}))];
 const a=comparePreSignalHypotheses({trades:[trade()],observations:history});
 const b=comparePreSignalHypotheses({trades:[trade()],observations:
  [...history,{symbol:'ETHUSDT',candle_close_time:T+300000,candle_close:5000,atr14:1000}]});
 assert.deepEqual(a.bySymbol,b.bySymbol);
 assert.equal(SCREEN_HYPOTHESES.length,3);
});
