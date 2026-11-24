// Read-only forensic audit of simulated positions paused by missing 5m candles.
// Never clears a quarantine, books a fill, reconstructs realized PnL or enables orders.
import { SYMBOLS } from './market.js';

const INTERVAL_MS=300000;
const validPrice=value=>Number.isFinite(value)&&value>0;

export function inspectGapReconciliation({
 symbol,position=null,gap=null,locked=false,candles=[],lastCandleCloseTime=null,
 maxCandles=1000
}={}){
 if(!SYMBOLS.includes(symbol))throw Error('Unsupported gap audit symbol');
 const base={symbol,mode:'PAPER_ONLY',readOnly:true,ordersCreated:0,
  unlockAllowed:false,automaticExecution:false,
  locked:Boolean(locked),hasPosition:Boolean(position),
  status:'NO_QUARANTINE',historyComplete:false,
  candlesExpected:null,candlesAvailable:0,candlesMissing:null,
  firstPossibleTrigger:null,confidence:'NOT_EVALUATED',
  note:'A auditoria não cria ordens, não desbloqueia posições nem reconstitui lucros.'};
 if(!locked)return base;
 const previous=gap?.previousCandleCloseTime;
 const latest=lastCandleCloseTime;
 if(!position||!Number.isFinite(previous)||!Number.isFinite(latest)||
    latest<=previous||!Array.isArray(candles)||!Number.isInteger(maxCandles)||maxCandles<1||
    !validPrice(position.stop)||!validPrice(position.take)||position.stop>=position.take){
  return {...base,status:'INSUFFICIENT_EVIDENCE',confidence:'UNKNOWN',
   note:'Posição, intervalo ou limites inconsistentes. Quarentena preservada; revisão manual obrigatória.'};
 }
 const expected=Math.round((latest-previous)/INTERVAL_MS);
 if(expected<1||Math.abs((latest-previous)/INTERVAL_MS-expected)>0.00001){
  return {...base,status:'INSUFFICIENT_EVIDENCE',confidence:'UNKNOWN',
   note:'Intervalo de candles inconsistente. Não é permitido reconciliar automaticamente.'};
 }
 // Require exactly one validated candle for each interval since the last persisted close.
 const relevant=candles.filter(c=>Number.isFinite(c?.closeTime)&&c.closeTime>previous&&c.closeTime<=latest)
  .sort((a,b)=>a.closeTime-b.closeTime);
 const byTime=new Map();
 for(const candle of relevant){
  if(!validPrice(candle.high)||!validPrice(candle.low)||candle.low>candle.high||
     !validPrice(candle.open)||!validPrice(candle.close)||
     candle.open<candle.low||candle.open>candle.high||
     candle.close<candle.low||candle.close>candle.high){
   return {...base,status:'INSUFFICIENT_EVIDENCE',confidence:'UNKNOWN',
    note:'Há candle inválido no intervalo; nenhuma conclusão de execução é possível.'};
  }
  if(byTime.has(candle.closeTime))return {...base,status:'INSUFFICIENT_EVIDENCE',
   confidence:'UNKNOWN',note:'Há candles duplicados; preservar quarentena.'};
  byTime.set(candle.closeTime,candle);
 }
 let available=0,first=null;
 for(let index=1;index<=expected;index++){
  const candle=byTime.get(previous+index*INTERVAL_MS);
  if(!candle)continue;
  available++;
  if(!first){
   const stop=candle.low<=position.stop;
   const take=candle.high>=position.take;
   if(stop||take)first={candleCloseTime:candle.closeTime,
    classification:stop&&take?'BOTH_IN_SAME_CANDLE':stop?'STOP_TOUCHED':'TAKE_TOUCHED',
    // OHLC does not prove which trigger occurred first or a realizable trade fill.
    executable:false};
  }
 }
 const complete=available===expected&&expected<=maxCandles;
 const note=complete?
  'Histórico OHLC observável; possíveis toques em stop/alvo não são ordens. Revisão humana obrigatória.':
  'Histórico incompleto ou fora da janela de consulta; não é possível decidir o que teria ocorrido.';
 return {...base,status:complete?'MANUAL_REVIEW_REQUIRED':'HISTORY_INCOMPLETE',
  historyComplete:complete,candlesExpected:expected,candlesAvailable:available,
  candlesMissing:expected-available,firstPossibleTrigger:first,
  confidence:complete?(first?.classification==='BOTH_IN_SAME_CANDLE'?'AMBIGUOUS_PATH':'OHLC_ONLY'):'UNKNOWN',note};
}

export function summarizeGapReconciliation(paper,{marketBySymbol={},errorsBySymbol={}}={}){
 const symbols=SYMBOLS.map(symbol=>{
  const locked=paper?.gapLocks?.[symbol]===true;
  const position=paper?.positions?.find?.(p=>p.symbol===symbol)||null;
  const gap=paper?.dataGaps?.[symbol]||null;
  const report=inspectGapReconciliation({
   symbol,position,gap,locked,candles:marketBySymbol[symbol]||[],
   lastCandleCloseTime:paper?.lastCandle?.[symbol]??null});
  return errorsBySymbol[symbol]&&locked?
   {...report,status:'MARKET_DATA_UNAVAILABLE',historyComplete:false,confidence:'UNKNOWN',
    note:'Consulta pública de candles indisponível. Quarentena preservada.'}:
   report;
 });
 return {ok:true,mode:'PAPER_ONLY',source:'read_only_binance_ohlc_audit',
  realOrdersEnabled:false,automaticUnlockEnabled:false,automaticFillsEnabled:false,
  lockedCount:symbols.filter(s=>s.locked).length,
  symbols,notice:'Este relatório só apresenta evidências. Não altera a carteira ou remove bloqueios.'};
}
