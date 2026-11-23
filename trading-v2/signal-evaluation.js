// Read-only diagnostics. Directional signal accuracy is NOT realized trade profitability.
const SYMBOLS=['BTCUSDT','ETHUSDT','SOLUSDT'];
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
export function summarizeSignalOutcomes(rows=[]){
 if(!Array.isArray(rows))throw Error('Invalid outcome list');
 const safe=rows.filter(r=>SYMBOLS.includes(r?.symbol)&&['watch_long','watch_short','wait'].includes(r.signal)&&
   Number.isFinite(Number(r.next_candle_return_pct))&&
   (r.directional_correct===true||r.directional_correct===false||r.directional_correct===null));
 const summarize=list=>{
   const directional=list.filter(x=>x.signal!=='wait'&&typeof x.directional_correct==='boolean');
   const correct=directional.filter(x=>x.directional_correct===true).length;
   const netReturn=list.reduce((sum,x)=>sum+Number(x.next_candle_return_pct),0);
   return {total:list.length,directionalSignals:directional.length,correct,
     directionalAccuracy:directional.length?round(100*correct/directional.length):null,
     meanNextCandleReturnPct:list.length?round(netReturn/list.length):null,
     waitingSignals:list.filter(x=>x.signal==='wait').length,
     sampleAdequacy:directional.length>=30?'preliminary':'insufficient'};
 };
 return {
  ...summarize(safe),
  bySymbol:Object.fromEntries(SYMBOLS.map(symbol=>[symbol,summarize(safe.filter(x=>x.symbol===symbol))])),
  bySignal:Object.fromEntries(['watch_long','watch_short','wait'].map(signal=>[signal,summarize(safe.filter(x=>x.signal===signal))])),
  mode:'OBSERVATION_ONLY',horizon:'NEXT_EXACT_5M_CANDLE',returnsIncludeFees:false,
  tradingStrategyChanged:false,newsInputsActive:false
 };
}
