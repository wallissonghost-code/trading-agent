import test from 'node:test';
import assert from 'node:assert/strict';
import {parseKlines,getKlines} from './market.js';
test('reject unsupported symbol before network access',async()=>await assert.rejects(()=>getKlines('DOGEUSDT'),/Unsupported/));
test('validate and convert Binance kline arrays',()=>{
 const rows=Array.from({length:40},(_,i)=>[i*300000,'100','102','99','101','10',i*300000+299999]);
 const candles=parseKlines(rows);
 assert.equal(candles.length,40);assert.equal(candles[0].close,101);
});
test('reject unordered candles',()=>{
 const rows=Array.from({length:40},(_,i)=>[0,'100','102','99','101','10',299999]);
 assert.throws(()=>parseKlines(rows),/out of order/);
});
test('live endpoint excludes unfinished candle and caches',async()=>{
 let calls=0;
 const now=Date.now();
 const rows=Array.from({length:60},(_,i)=>{
 const t=now-60*300000+i*300000;
 return [t,'100','102','99','101','10',t+299999];
 });
 const fetchFn=async()=>{calls++;return {ok:true,json:async()=>rows}};
 const first=await getKlines('BTCUSDT',{fetchFn,now:()=>now});
 const second=await getKlines('BTCUSDT',{fetchFn,now:()=>now});
 assert.equal(first.dataSource,'binance_public_spot');
 assert.ok(first.candles.every(c=>c.closeTime<now));
 assert.equal(second.cached,true);
 assert.equal(calls,1);
});
