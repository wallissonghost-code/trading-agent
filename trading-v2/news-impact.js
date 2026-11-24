// Observational one-hour post-collection price study; never a trading signal.
// Anchors AFTER the first verified RSS observation to prevent publication-time lookahead.
const BAR=300000,HOUR=3600000;
export function evaluateHeadlineImpact(news,candles,{symbol,now=Date.now()}={}){
 if(!news||!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(symbol))return {status:'invalid'};
 if(!news.relatedSymbols?.includes(symbol)&&news.category!=='MACRO')return {status:'unrelated'};
 const seen=Date.parse(news.firstSeenAt||news.fetchedAt),published=Date.parse(news.publishedAt);
 if(!Number.isFinite(seen)||!Number.isFinite(published)||seen<published-300000)return {status:'invalid'};
 if(!Array.isArray(candles)||candles.length<15)return {status:'insufficient_history'};
 const ordered=candles.every((c,i)=>Number.isFinite(c.time)&&Number.isFinite(c.closeTime)&&
  Number.isFinite(c.open)&&Number.isFinite(c.close)&&c.open>0&&c.close>0&&
  c.closeTime===c.time+BAR-1&&(i===0||c.time-candles[i-1].time===BAR));
 if(!ordered)return {status:'invalid_history'};
 // First FULL bar that begins no earlier than the initial discovery time.
 const base=candles.find(c=>c.time>=seen);
 if(!base)return {status:'outside_window'};
 const targetCloseTime=base.time+HOUR-1;
 if(now<=targetCloseTime)return {status:'pending'};
 const target=candles.find(c=>c.closeTime===targetCloseTime);
 if(!target)return {status:'missing_future_candle'};
 if(base.time-seen>=BAR)return {status:'missing_first_candle'};
 const value=Number((((target.close/base.open)-1)*100).toFixed(5));
 return {status:'evaluated',source:news.source,url:news.url,symbol,
  observedAfter:new Date(seen).toISOString(),baselineCandleOpenTime:base.time,
  baselinePrice:base.open,outcomeCandleCloseTime:target.closeTime,
  outcomePrice:target.close,returnPct:value,horizonMinutes:60,
  causalAttribution:false,signalGenerated:false};
}
export function summarizeHeadlineImpacts(outcomes=[]){
 const symbols=['BTCUSDT','ETHUSDT','SOLUSDT'];
 const valid=outcomes.filter(x=>symbols.includes(x.symbol)&&Number.isFinite(Number(x.returnPct)));
 const make=list=>({
  samples:list.length,
  averagePostObservationReturnPct:list.length?Number((list.reduce((sum,x)=>sum+Number(x.returnPct),0)/list.length).toFixed(4)):null,
  positiveOutcomes:list.filter(x=>Number(x.returnPct)>0).length,
  negativeOutcomes:list.filter(x=>Number(x.returnPct)<0).length,
  sufficientEvidence:false
 });
 return {mode:'OBSERVATIONAL_NONCAUSAL',horizonMinutes:60,newsTradingEnabled:false,
  total:valid.length,bySymbol:Object.fromEntries(symbols.map(symbol=>[symbol,make(valid.filter(x=>x.symbol===symbol))])),
  overall:make(valid)};
}
