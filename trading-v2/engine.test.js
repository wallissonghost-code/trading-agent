import test from 'node:test';
import assert from 'node:assert/strict';
import {ema,rsi,atr,riskSize,analyze,generateMockCandles} from './engine.js';
test('EMA of constant values equals constant',()=>assert.equal(ema(Array(30).fill(10),9),10));
test('RSI constant series is neutral',()=>assert.equal(rsi(Array(30).fill(10)),50));
test('ATR is nonnegative',()=>assert.ok(atr(generateMockCandles())>0));
test('risk never exceeds one percent budget',()=>{
const x=riskSize({capital:10000,riskPercent:1,entry:100,stop:95});
assert.ok(x.maxEstimatedLoss<=100);assert.ok(x.notional<=10000);
});
test('reject invalid risk configuration',()=>assert.equal(riskSize({capital:10000,riskPercent:3,entry:100,stop:95}),null));
test('analysis uses mock source only',()=>{const x=analyze(generateMockCandles());assert.equal(x.ok,true);assert.equal(x.source,'synthetic');assert.equal(x.executionEnabled,false);});
