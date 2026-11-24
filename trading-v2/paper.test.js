import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { createAccount,snapshot,processCandle,saveAccount,loadAccount,createPaperRunner } from './paper.js';
import {generateMockCandles} from './engine.js';
function candles(base=100,end=Date.now()-300000){
 const rows=generateMockCandles(base,60);
 return rows.map((c,i)=>({...c,time:end-(59-i)*300000,closeTime:end-(59-i)*300000+299999}));
}
test('deduplicates the same closed candle',()=>{
 const a=createAccount(),cs=candles();
 assert.equal(processCandle(a,'BTCUSDT',cs).processed,true);
 assert.equal(processCandle(a,'BTCUSDT',cs).processed,false);
});
test('rejects unsupported markets',()=>assert.throws(()=>processCandle(createAccount(),'FAKEUSDT',candles()),/Unsupported/));
test('fills stops first if both stop and take hit, charges costs',()=>{
 const a=createAccount(),cs=candles(),last=cs.at(-1);
 a.cash=9000;
 a.positions.BTCUSDT={symbol:'BTCUSDT',entry:100,stop:95,take:110,quantity:10,cost:1001,openedAt:'today'};
 last.open=100;last.high=115;last.low=90;last.close=101;
 processCandle(a,'BTCUSDT',cs);
 assert.equal(a.positions.BTCUSDT,undefined);
 assert.equal(a.trades[0].reason,'STOP_LOSS');
 assert.ok(a.realizedPnl<0);
});
test('persist and restore account, no silent reset',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'paper-test-'));const path=join(dir,'paper.json');
 try{const a=createAccount();a.cash=9999;await saveAccount(path,a);assert.equal((await loadAccount(path)).cash,9999);}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('paper runner works without any execution API',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'paper-run-'));const path=join(dir,'paper.json');
 try{const runner=createPaperRunner({path,fetchKlines:async()=>({candles:candles()})});
 await runner.init();const state=await runner.runOnce();
 assert.equal(state.executionEnabled,false);
 assert.equal(state.mode,'PAPER_ONLY');
 assert.equal(state.ready,true);
 assert.equal(state.trades.every(t=>t.simulated),true);}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('account values reflect cash and marked positions',()=>{
 const a=createAccount();a.cash=8999;a.positions.BTCUSDT={symbol:'BTCUSDT',entry:100,quantity:10,cost:1001,stop:95,take:110};
 const s=snapshot(a,{BTCUSDT:105});assert.equal(s.equity,10049);
});

test('halts on persistence failure and does not commit an unsaved candle',async()=>{
 let writes=0;
 const runner=createPaperRunner({
   store:{kind:'test_remote',load:async()=>createAccount(),save:async()=>{writes++;throw Error('offline')}},
   fetchKlines:async()=>({candles:candles()})
 });
 await runner.init();
 const state=await runner.runOnce();
 assert.equal(writes,1);
 assert.equal(state.ready,false);
 assert.match(state.storageError,/offline/);
 assert.deepEqual(state.lastCandle,{});
 await assert.rejects(()=>runner.runOnce(),/halted/);
});

test('rejects stale or future candles before changing paper portfolio',()=>{
 const a=createAccount(),cs=candles();
 const before=structuredClone(a);
 assert.throws(()=>processCandle(a,'BTCUSDT',cs,{now:new Date(Date.now()+25*60*1000).toISOString()}),/Stale/);
 assert.deepEqual(a,before);
 assert.throws(()=>processCandle(a,'BTCUSDT',cs,{now:new Date(Date.now()-10*60*1000).toISOString()}),/future/);
 assert.deepEqual(a,before);
});
test('equity and per-agent unrealized return use mark prices, not entry prices',()=>{
 const a=createAccount();a.cash=8999;
 a.positions.BTCUSDT={symbol:'BTCUSDT',entry:100,quantity:10,cost:1001,stop:95,take:110};
 a.lastMarks.BTCUSDT=90;
 const state=snapshot(a);
 assert.equal(state.equity,9899);
 assert.equal(state.agentPnl.BTCUSDT.unrealizedPnl,-101.9);
 assert.equal(state.agentPnl.ETHUSDT.unrealizedPnl,0);
});

test('journals every processed candle including a WAIT decision without replay',()=>{
 const a=createAccount(),cs=candles();
 const result=processCandle(a,'BTCUSDT',cs);
 assert.equal(result.processed,true);
 assert.equal(a.lastDecision.symbol,'BTCUSDT');
 assert.equal(a.lastDecision.candleCloseTime,cs.at(-1).closeTime);
 assert.equal(a.lastDecision.simulated,true);
 assert.ok(['WAIT','BUY','SELL'].includes(a.lastDecision.action));
 assert.equal(typeof a.lastDecision.reason,'string');
 const original=structuredClone(a.lastDecision);
 assert.equal(processCandle(a,'BTCUSDT',cs).processed,false);
 assert.deepEqual(a.lastDecision,original);
});

test('each paper robot retains its own causal latest decision without overwriting other robots',()=>{
 const a=createAccount();
 const cs=candles();
 for(const symbol of ['BTCUSDT','ETHUSDT','SOLUSDT']){
  assert.equal(processCandle(a,symbol,cs).processed,true);
  assert.equal(a.lastDecisions[symbol].symbol,symbol);
  assert.equal(a.lastDecisions[symbol].candleCloseTime,cs.at(-1).closeTime);
  assert.equal(a.lastDecisions[symbol].entryGates.paperOnly,true);
 }
 const paper=snapshot(a);
 assert.deepEqual(Object.keys(paper.lastDecisions).sort(),['BTCUSDT','ETHUSDT','SOLUSDT']);
 assert.equal(paper.lastDecision.symbol,'SOLUSDT');
 assert.equal(paper.executionEnabled,false);
 const saved=structuredClone(a.lastDecisions.ETHUSDT);
 processCandle(a,'ETHUSDT',cs);
 assert.deepEqual(a.lastDecisions.ETHUSDT,saved);
});
test('existing portfolios without per-symbol decisions migrate in memory, preserving cash and trades',()=>{
 const a=createAccount();
 delete a.lastDecisions;
 a.cash=9800;a.trades=[{symbol:'BTCUSDT',side:'BUY',simulated:true}];
 const before=structuredClone(a.trades);
 const report=snapshot(a);
 assert.deepEqual(report.lastDecisions,{});
 assert.equal(report.cash,9800);
 assert.deepEqual(report.trades,before);
 processCandle(a,'ETHUSDT',candles());
 assert.equal(a.lastDecisions.ETHUSDT.symbol,'ETHUSDT');
 assert.deepEqual(a.trades.filter(x=>x.symbol==='BTCUSDT'),before);
});
test('paper decision reports risk and trend gates without changing the existing trade path',()=>{
 const a=createAccount();
 const cs=candles();
 processCandle(a,'ETHUSDT',cs);
 const d=a.lastDecisions.ETHUSDT;
 assert.equal(typeof d.entryGates.emaBullish,'boolean');
 assert.equal(typeof d.entryGates.rsiInBuyRange,'boolean');
 assert.equal(typeof d.entryGates.positionSlotsAvailable,'boolean');
 assert.ok(['EMA_TREND_NOT_BULLISH','RSI_OUTSIDE_BUY_RANGE','MAX_OPEN_POSITIONS','CAPITAL_OR_RISK_LIMIT','EMA_RSI_WATCH_LONG','NO_NEW_ENTRY'].includes(d.reason));
 assert.equal(d.simulated,true);
});
