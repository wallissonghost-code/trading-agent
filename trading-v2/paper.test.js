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
