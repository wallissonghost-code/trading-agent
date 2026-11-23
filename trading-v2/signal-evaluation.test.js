import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSignalOutcomes} from './signal-evaluation.js';
test('empty evaluation does not invent accuracy',()=>{
 const x=summarizeSignalOutcomes([]);
 assert.equal(x.total,0);assert.equal(x.directionalAccuracy,null);
 assert.equal(x.sampleAdequacy,'insufficient');
});
test('directional accuracy excludes wait classifications and reports insufficient sample',()=>{
 const x=summarizeSignalOutcomes([
 {symbol:'BTCUSDT',signal:'watch_long',next_candle_return_pct:0.3,directional_correct:true},
 {symbol:'BTCUSDT',signal:'watch_short',next_candle_return_pct:0.1,directional_correct:false},
 {symbol:'ETHUSDT',signal:'wait',next_candle_return_pct:-0.2,directional_correct:null},
 {symbol:'UNKNOWN',signal:'watch_long',next_candle_return_pct:9,directional_correct:true}
 ]);
 assert.equal(x.total,3);assert.equal(x.directionalSignals,2);
 assert.equal(x.correct,1);assert.equal(x.directionalAccuracy,50);
 assert.equal(x.waitingSignals,1);assert.equal(x.sampleAdequacy,'insufficient');
 assert.equal(x.bySymbol.BTCUSDT.directionalAccuracy,50);
 assert.equal(x.bySymbol.SOLUSDT.directionalAccuracy,null);
 assert.equal(x.bySignal.wait.directionalAccuracy,null);
 assert.equal(x.returnsIncludeFees,false);
});
