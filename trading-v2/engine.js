// Trading Agent V2: deterministic analysis utilities, educational/simulation-only.
export function ema(values, period) {
  if (!Array.isArray(values) || values.length < period || period < 2) return null;
  if (values.some(v=>!Number.isFinite(v))) return null;
  let current = values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const multiplier=2/(period+1);
  for(const value of values.slice(period)) current=(value-current)*multiplier+current;
  return current;
}
export function rsi(closes, period=14) {
  if (!Array.isArray(closes) || closes.length <= period) return null;
  let gain=0,loss=0;
  for(let i=1;i<=period;i++){const d=closes[i]-closes[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d);}
  gain/=period;loss/=period;
  for(let i=period+1;i<closes.length;i++){
    const d=closes[i]-closes[i-1];
    gain=(gain*(period-1)+Math.max(0,d))/period;
    loss=(loss*(period-1)+Math.max(0,-d))/period;
  }
  if(!loss) return gain===0?50:100;
  return 100-100/(1+gain/loss);
}
export function atr(candles, period=14) {
  if(!Array.isArray(candles)||candles.length<=period) return null;
  const ranges=[];
  for(let i=1;i<candles.length;i++){
    const prev=candles[i-1],c=candles[i];
    ranges.push(Math.max(c.high-c.low,Math.abs(c.high-prev.close),Math.abs(c.low-prev.close)));
  }
  let value=ranges.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(const range of ranges.slice(period))value=(value*(period-1)+range)/period;
  return value;
}
export function riskSize({capital,riskPercent,entry,stop}){
  if (![capital,riskPercent,entry,stop].every(Number.isFinite)||capital<=0||riskPercent<=0||riskPercent>1||entry<=0||stop<=0||entry===stop) return null;
  const maxLoss=capital*riskPercent/100;
  const rawQty=maxLoss/Math.abs(entry-stop);
  const quantity=Math.min(rawQty,capital/entry);
  return {quantity,notional:quantity*entry,maxEstimatedLoss:quantity*Math.abs(entry-stop),riskBudget:maxLoss};
}
export function analyze(candles,capital=10000){
  if(!Array.isArray(candles)||candles.length<35||candles.some(c=>![c.open,c.high,c.low,c.close].every(Number.isFinite)||c.low>c.high||c.close<c.low||c.close>c.high))return {ok:false,reason:'Insufficient or invalid candles'};
  const closes=candles.map(c=>c.close);
  const ema9=ema(closes,9),ema21=ema(closes,21),rsi14=rsi(closes),atr14=atr(candles);
  const price=closes.at(-1);
  const trend=ema9>ema21?'bullish':ema9<ema21?'bearish':'neutral';
  // Signal is a synthetic educational classification, not an order or advice.
  const classification=trend==='bullish'&&rsi14>=50&&rsi14<=70?'watch_long':trend==='bearish'&&rsi14>=30&&rsi14<=50?'watch_short':'wait';
  const stopDistance=Math.max(atr14*2,price*0.002);
  const exampleStop=price-stopDistance;
  const sizing=riskSize({capital,riskPercent:1,entry:price,stop:exampleStop});
  return {ok:true,price,ema9,ema21,rsi14,atr14,trend,classification,exampleStop,riskExample:sizing,source:'synthetic',executionEnabled:false};
}
export function generateMockCandles(seed=100,count=60){
  const candles=[];let last=seed;
  for(let i=0;i<count;i++){const drift=Math.sin(i*.42)*.003 + Math.cos(i*.17)*.002;const open=last,close=Math.max(.01,open*(1+drift));const spread=open*.004;
    candles.push({open,high:Math.max(open,close)+spread,low:Math.min(open,close)-spread,close});last=close;}
  return candles;
}
