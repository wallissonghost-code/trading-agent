// Read-only, observational audit of the frozen prospective shadow journal.
// Never derives strategy improvements from exit information, never promotes orders.
export const STOP_REVIEW_VERSION='shadow-v1-20261124';
const SYMBOLS=['BTCUSDT','ETHUSDT','SOLUSDT'];
const SCENARIOS=['reference','trend_confirmed','volatility_screen','combined'];
const round=(n,d=3)=>Math.round(n*10**d)/10**d;
const BAR=300000;
export function reviewShadowStops({trades=[],observations=[],partialTrades=false,partialObservations=false}={}){
 if(!Array.isArray(trades)||!Array.isArray(observations))throw Error('Invalid audit inputs');
 const historical=new Map();
 for(const x of observations){
  if(!SYMBOLS.includes(x.symbol))continue;
  const t=Number(x.candle_close_time);
  if(!Number.isSafeInteger(t)||(t+1)%BAR!==0)continue;
  const key=x.symbol+':'+t;
  if(!historical.has(key))historical.set(key,x);
 }
 const valid=trades.filter(t=>t.status==='CLOSED'&&SYMBOLS.includes(t.symbol)&&
  SCENARIOS.includes(t.scenario)&&t.realized_pnl_usd!==null&&
  Number.isFinite(Number(t.realized_pnl_usd))&&
  Number.isSafeInteger(Number(t.signal_candle_close_time))&&
  Number.isFinite(Number(t.entry_fill))&&Number(t.entry_fill)>0);
 const bySymbol=Object.fromEntries(SYMBOLS.map(symbol=>{
  const subset=valid.filter(t=>t.symbol===symbol);
  const entries=subset.map(t=>{
   // Signal candle is at or BEFORE the decision. Never use any future bar for regime labels.
   const signal=historical.get(symbol+':'+Number(t.signal_candle_close_time));
   const signalPrice=signal?Number(signal.candle_close):NaN;
   const atr=signal?Number(signal.atr14):NaN;
   const atrPct=Number.isFinite(signalPrice)&&signalPrice>0&&Number.isFinite(atr)&&atr>0?atr/signalPrice*100:null;
   const entry=Number(t.entry_fill),stop=Number(t.stop_price),target=Number(t.target_price);
   const stopDistancePct=Number.isFinite(stop)&&stop>0&&stop<entry?round((entry-stop)/entry*100):null;
   const targetDistancePct=Number.isFinite(target)&&target>entry?round((target-entry)/entry*100):null;
   const six=Array.from({length:7},(_,i)=>historical.get(symbol+':'+(Number(t.signal_candle_close_time)-(6-i)*BAR)));
   const close0=six[0]?Number(six[0].candle_close):NaN;
   const close6=six[6]?Number(six[6].candle_close):NaN;
   const momentum6Pct=six.every(Boolean)&&[close0,close6].every(Number.isFinite)&&close0>0?
    round((close6/close0-1)*100):null;
   const volatilityRegime=atrPct===null?'UNKNOWN':atrPct>=0.25?'ATR_HIGH':'ATR_LOW';
   const trendRegime=momentum6Pct===null?'UNKNOWN':momentum6Pct>0?'RISING_6_BARS':
    momentum6Pct<0?'FALLING_6_BARS':'FLAT_6_BARS';
   return {scenario:t.scenario,signalCandleCloseTime:Number(t.signal_candle_close_time),
    exitCandleCloseTime:Number(t.exit_candle_close_time)||null,
    pnlUsd:round(Number(t.realized_pnl_usd),2),exitReason:t.exit_reason||'UNKNOWN',
    stopDistancePct,targetDistancePct,
    signalAtrPct:atrPct===null?null:round(atrPct),volatilityRegime,
    signalMomentum6Pct:momentum6Pct,trendRegime,
    entrySignalObserved:atrPct!==null,stopReasonRecorded:t.exit_reason==='STOP'};
  });
  const uniqueSignalKeys=new Set(entries.map(x=>x.signalCandleCloseTime));
  const outcome=(reason)=>entries.filter(x=>x.exitReason===reason);
  const group=(key)=>Object.fromEntries([...new Set(entries.map(x=>x[key]))].map(value=>{
   const items=entries.filter(x=>x[key]===value);
   return [value,{trades:items.length,losses:items.filter(x=>x.pnlUsd<0).length,
    netPnlUsd:round(items.reduce((n,x)=>n+x.pnlUsd,0),2)}];
  }));
  return [symbol,{closed:entries.length,losses:entries.filter(x=>x.pnlUsd<0).length,
   netPnlUsd:round(entries.reduce((n,x)=>n+x.pnlUsd,0),2),
   uniqueSignalCandles:uniqueSignalKeys.size,
   stopExits:outcome('STOP').length,timeLimitExits:outcome('TIME_LIMIT').length,
   targetExits:outcome('TARGET').length,otherExits:entries.filter(x=>!['STOP','TIME_LIMIT','TARGET'].includes(x.exitReason)).length,
   missingSignalContext:entries.filter(x=>!x.entrySignalObserved).length,
   volatilityRegimes:group('volatilityRegime'),trendRegimes:group('trendRegime'),
   recent:entries.sort((a,b)=>(b.exitCandleCloseTime||0)-(a.exitCandleCloseTime||0)).slice(0,8)}];
 }));
 const total=Object.values(bySymbol).reduce((n,x)=>n+x.closed,0);
 return {ok:true,mode:'FROZEN_SHADOW_STOP_AUDIT',version:STOP_REVIEW_VERSION,
  closed:total,uniquePerSymbolSignalCandles:Object.values(bySymbol).reduce((n,x)=>n+x.uniqueSignalCandles,0),
  losses:Object.values(bySymbol).reduce((n,x)=>n+x.losses,0),
  partialTrades:Boolean(partialTrades),partialObservations:Boolean(partialObservations),
  rulesUnchanged:true,approved:false,realOrdersEnabled:false,autoPromotionEnabled:false,
  notice:'Análise descritiva, sem causalidade demonstrada. Cenários podem repetir o mesmo sinal e não equivalem a amostras independentes. ATR 0,25% é um limiar descritivo, não uma nova regra. Movimento de seis candles usa somente preços já fechados no candle do sinal. Contexto desconhecido não é preenchido.',
  bySymbol};
}
