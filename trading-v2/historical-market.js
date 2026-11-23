// Public, read-only Binance Spot historical fetch. No API keys, no orders.
// Backward pagination with endTime, exact chronological validation and strict gap detection.
import {parseKlines,SYMBOLS} from './market.js';
export const BAR_MS=300000;
export const TARGET_BARS=28*24*12; // 28 full calendar days of 5-minute bars.
export async function getMultiweekHistory(symbol,{fetchFn=fetch,now=Date.now,desiredBars=TARGET_BARS}={}){
 if(!SYMBOLS.includes(symbol))throw Error('Unsupported research symbol');
 if(!Number.isInteger(desiredBars)||desiredBars<2500||desiredBars>TARGET_BARS)throw Error('Invalid study length');
 const end=now(),pages=[];
 let latestOpenBefore=Number.POSITIVE_INFINITY;
 const count=Math.ceil(desiredBars/1000);
 for(let n=0;n<count;n++){
  const url=new URL('/api/v3/klines','https://data-api.binance.vision');
  url.searchParams.set('symbol',symbol);
  url.searchParams.set('interval','5m');
  url.searchParams.set('limit','1000');
  if(Number.isFinite(latestOpenBefore))url.searchParams.set('endTime',String(latestOpenBefore-1));
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
  let response;
  try{response=await fetchFn(url,{signal:controller.signal,headers:{accept:'application/json'}});}
  finally{clearTimeout(timeout);}
  if(!response?.ok)throw Error('Public Binance historical data HTTP '+(response?.status??'unavailable'));
  const rows=parseKlines(await response.json());
  const closed=rows.filter(c=>c.closeTime<end&&c.time<latestOpenBefore);
  if(closed.length===0)throw Error('Empty or overlapping historical page');
  latestOpenBefore=closed[0].time;
  pages.unshift(closed);
 }
 const all=pages.flat().slice(-desiredBars);
 if(all.length!==desiredBars)throw Error('Incomplete historical candle window');
 for(let i=1;i<all.length;i++){
  if(all[i].time-all[i-1].time!==BAR_MS || all[i].closeTime<=all[i-1].closeTime)throw Error('Missing or duplicate historical candles');
 }
 if(end-all.at(-1).closeTime>20*60*1000)throw Error('Historical last candle too old');
 return {symbol,interval:'5m',source:'binance_public_spot',
  from:new Date(all[0].time).toISOString(),to:new Date(all.at(-1).closeTime).toISOString(),
  candles:all,pages:count,spanDays:Number(((all.at(-1).closeTime-all[0].time)/86400000).toFixed(2))};
}
