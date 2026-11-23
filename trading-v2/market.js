// Public Binance Spot market data. Read-only: no keys, signatures, balances or orders.
const BASE='https://data-api.binance.vision';
export const SYMBOLS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
const CACHE_MS=15000, cache=new Map();
export function parseKlines(rows){
  if(!Array.isArray(rows)||rows.length<35)throw new Error('Invalid or insufficient Binance candles');
  const candles=rows.map(row=>{
    if(!Array.isArray(row)||row.length<7)throw new Error('Invalid candle format');
    const [time,open,high,low,close,volume,closeTime]=row;
    const candle={time:Number(time),open:Number(open),high:Number(high),low:Number(low),close:Number(close),volume:Number(volume),closeTime:Number(closeTime)};
    if(!Object.values(candle).every(Number.isFinite)||candle.open<=0||candle.close<=0||candle.low<=0||candle.high<candle.low||candle.open<candle.low||candle.open>candle.high||candle.close<candle.low||candle.close>candle.high)throw new Error('Invalid market candle');
    return candle;
  });
  for(let i=1;i<candles.length;i++)if(candles[i].time<=candles[i-1].time)throw new Error('Market candles out of order');
  return candles;
}
export async function getKlines(symbol,{fetchFn=fetch,now=Date.now,limit=100}={}){
  if(!Number.isInteger(limit)||limit<50||limit>1000)throw new Error('Invalid candle research limit');
  if(!SYMBOLS.includes(symbol))throw new Error('Unsupported market symbol');
  const key=symbol+':5m:'+limit;
  const stamp=now();
  const prior=cache.get(key);
  if(prior&&stamp-prior.receivedAt<CACHE_MS)return {...prior.result,cached:true};
  // Deduplicate simultaneous requests and avoid repeated upstream calls.
  if(prior?.pending)return prior.pending;
  const pending=(async()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),7000);
    try{
      const url=new URL('/api/v3/klines',BASE);
      url.searchParams.set('symbol',symbol);
      url.searchParams.set('interval','5m');
      url.searchParams.set('limit',String(limit));
      const res=await fetchFn(url,{signal:controller.signal,headers:{accept:'application/json'}});
      if(!res.ok)throw new Error('Binance public data HTTP '+res.status);
      const candles=parseKlines(await res.json());
      // Exclude currently forming candle; indicators use only fully closed candles.
      const closed=candles.filter(c=>c.closeTime<now());
      if(closed.length<35)throw new Error('Not enough closed candles');
      const result={symbol,interval:'5m',dataSource:'binance_public_spot',receivedAt:new Date(now()).toISOString(),lastClosedAt:new Date(closed.at(-1).closeTime).toISOString(),candles:closed,cached:false};
      cache.set(key,{receivedAt:now(),result});
      return result;
    }finally{clearTimeout(timeout);const value=cache.get(key);if(value?.pending===pending)cache.delete(key);}
  })();
  cache.set(key,{...prior,pending});
  return pending;
}
