import test from 'node:test';
import assert from 'node:assert/strict';
import {getMultiweekHistory,BAR_MS} from './historical-market.js';

const BASE_TIME=1800000000000;
function feed(total=3000,{gap=false}={}){
 const rows=Array.from({length:total},(_,i)=>{
  const time=BASE_TIME+i*BAR_MS+(gap&&i>=1400?BAR_MS:0);
  const price=String(100+i*.01);
  return [time,price,String(101+i*.01),String(99+i*.01),price,'50',time+BAR_MS-1];
 });
 let calls=0;
 return {fetchFn:async url=>{
  calls++;
  const end=Number(url.searchParams.get('endTime')??Number.POSITIVE_INFINITY);
  const eligible=rows.filter(row=>row[0]<=end);
  return {ok:true,json:async()=>eligible.slice(-1000)};
 },getCalls:()=>calls};
}
test('retrieves continuous multi-page five minute history with no overlap',async()=>{
 const mock=feed(3000),now=()=>BASE_TIME+3000*BAR_MS+1;
 const result=await getMultiweekHistory('BTCUSDT',{fetchFn:mock.fetchFn,now,desiredBars:2500});
 assert.equal(result.candles.length,2500);
 assert.equal(result.candles[0].time,BASE_TIME+500*BAR_MS);
 assert.equal(mock.getCalls(),3);
});
test('refuses candles missing in a historical market segment',async()=>{
 const mock=feed(3000,{gap:true}),now=()=>BASE_TIME+3001*BAR_MS+1;
 await assert.rejects(()=>getMultiweekHistory('BTCUSDT',{fetchFn:mock.fetchFn,now,desiredBars:2500}),/Missing or duplicate/);
});
test('public history research refuses unsupported markets and short windows',async()=>{
 await assert.rejects(()=>getMultiweekHistory('DOGEUSDT'),/Unsupported/);
 await assert.rejects(()=>getMultiweekHistory('BTCUSDT',{desiredBars:0}),/Invalid/);
});
