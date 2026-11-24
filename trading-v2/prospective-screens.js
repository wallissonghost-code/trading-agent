// Independent, forward-only next-candle research. Never changes existing shadow/paper studies.
import {buildForwardObservation} from './forward-study.js';
import {atr} from './engine.js';
export const SCREEN_VERSION='screens-v1-20261124';
export const SCREEN_KEYS=Object.freeze(['reference','atr_at_least_025','momentum_6_positive','atr_and_momentum']);
export function verifyScreenStudy(study){
 if(study?.version!==SCREEN_VERSION||!Number.isFinite(Date.parse(study.started_at))||
   Number(study.horizon_minutes)!==5||Number(study.fee_bps)!==10||Number(study.slippage_bps)!==5)
  throw Error('Screen study frozen parameters mismatch');
 const config=study.config;
 if(config?.screens?.atr_at_least_025?.minAtrPct!==0.25||
   config?.screens?.momentum_6_positive?.minMomentum6PctExclusive!==0||
   config?.screens?.atr_and_momentum?.minAtrPct!==0.25||
   config?.screens?.atr_and_momentum?.minMomentum6PctExclusive!==0||
   !config?.screens?.reference||Object.keys(config.screens).length!==4)
  throw Error('Frozen screen hypothesis set changed');
 return true;
}
export function buildScreenObservation(candles,{symbol,now=Date.now(),studyStartedAt}={}){
 const sample=buildForwardObservation(candles,{symbol,now,studyStartedAt});
 if(sample.status!=='ready')return sample;
 const signal=sample.signals.reference===true,last=candles.at(-1);
 const volatility=atr(candles,14)/last.close*100;
 const initial=candles.at(-7)?.close;
 if(!Number.isFinite(volatility)||volatility<=0||!Number.isFinite(initial)||initial<=0)
  throw Error('Incomplete pre-signal screens');
 const momentum=(last.close/initial-1)*100;
 const high=volatility>=.25,rising=momentum>0;
 return {...sample,version:SCREEN_VERSION,atrPct:volatility,momentum6Pct:momentum,
  signals:{reference:signal,atr_at_least_025:signal&&high,
   momentum_6_positive:signal&&rising,atr_and_momentum:signal&&high&&rising},
  studyMode:'FROZEN_PROSPECTIVE_NEXT_BAR',executionEnabled:false};
}
const round=n=>Math.round(n*10000)/10000;
export function summarizeScreenStudy({study,observations=[],outcomes=[],now=Date.now()}={}){
 verifyScreenStudy(study);
 if(!Array.isArray(observations)||!Array.isArray(outcomes))throw Error('Invalid screen archive');
 const bySymbol=Object.fromEntries(['BTCUSDT','ETHUSDT','SOLUSDT'].map(symbol=>{
  const items=observations.filter(o=>o.symbol===symbol)
   .sort((a,b)=>Number(a.candle_close_time)-Number(b.candle_close_time));
  const scored=outcomes.filter(o=>o.symbol===symbol);
  const candleTimes=new Set(items.map(x=>Number(x.candle_close_time)));
  const gapIntervals=items.slice(1).reduce((count,x,i)=>
   count+(Number(x.candle_close_time)-Number(items[i].candle_close_time)>300000?1:0),0);
  const missingCandleSlots=items.slice(1).reduce((count,x,i)=>{
   const distance=Number(x.candle_close_time)-Number(items[i].candle_close_time);
   return count+(Number.isSafeInteger(distance)&&distance>300000&&distance%300000===0?distance/300000-1:0);
  },0);
  const latest=items.at(-1);
  const latestClose=Number(latest?.candle_close_time);
  const ageMinutes=latest&&Number.isSafeInteger(latestClose)&&Number.isFinite(now)?
   Math.max(0,Math.round((now-latestClose)/60000)):null;
  const freshness=ageMinutes===null?'NO_OBSERVATIONS':ageMinutes>15?'DELAYED':'RECENT';
  // A trailing period without candles is missing coverage, even when the stored
  // first-to-last series looked complete (e.g., a sleeping free-tier server).
  const trailingMissingSlots=latest&&Number.isSafeInteger(latestClose)&&Number.isFinite(now)?
   Math.max(0,Math.floor((now-latestClose)/300000)):0;
  const expectedSlotsSinceFirst=items.length+missingCandleSlots+trailingMissingSlots;
  // The diagnostic prioritizes data integrity over absence of qualifying signals.
  // Never confuse no opportunities with a broken bot, or vice versa.
  const referenceSignals=items.filter(x=>x.signals?.reference===true).length;
  const refScored=new Set(scored.filter(x=>x.scenario==='reference').map(x=>Number(x.signal_candle_close_time)));
  const refPending=items.filter(x=>x.signals?.reference===true&&!refScored.has(Number(x.candle_close_time)));
  const hasMissingEvaluations=refPending.some(x=>candleTimes.has(Number(x.candle_close_time)+300000));
  const hasExpiredResult=refPending.some(x=>!candleTimes.has(Number(x.candle_close_time)+300000)&&
    Number.isFinite(now)&&now>Number(x.candle_close_time)+300000+660000);
  const hasFutureToObserve=refPending.some(x=>!candleTimes.has(Number(x.candle_close_time)+300000)&&
    Number.isFinite(now)&&now<=Number(x.candle_close_time)+300000+660000);
  const diagnostic=items.length===0?'NO_OBSERVATIONS':
   freshness==='DELAYED'?'COLLECTION_DELAYED':
   hasMissingEvaluations?'EVALUATION_MISSING':
   hasExpiredResult?'RESULT_EXPIRED':
   hasFutureToObserve?'WAITING_NEXT_CANDLE':
   referenceSignals===0?'NO_ELIGIBLE_SIGNALS':'OBSERVING_RESULTS';
  return [symbol,{observedCandles:items.length,gapIntervals,missingCandleSlots,diagnostic,
   trailingMissingSlots,expectedSlotsSinceFirst,
   coverageSinceFirstPct:expectedSlotsSinceFirst?
    round(100*items.length/expectedSlotsSinceFirst):null,
   coveragePct:items.length?round(100*items.length/(items.length+missingCandleSlots)):null,
   latestObservedAt:latest?.observed_at||null,
   latestCandleCloseTime:latest?.candle_close_time??null,
   ageMinutes,freshness,
   scenarios:Object.fromEntries(SCREEN_KEYS.map(key=>{
    const signs=items.filter(x=>x.signals?.[key]===true);
    const rows=scored.filter(x=>x.scenario===key&&Number.isFinite(Number(x.modeled_net_return_pct)));
    const completed=new Set(rows.map(x=>Number(x.signal_candle_close_time)));
    const missing=signs.filter(x=>!completed.has(Number(x.candle_close_time)));
    const withoutNextCandle=missing.filter(x=>!candleTimes.has(Number(x.candle_close_time)+300000));
    // Never treat a days-old missing next candle as an outcome still waiting.
    // Allow a generous observation buffer before marking the chance as expired.
    const expiredWithoutNextCandle=withoutNextCandle.filter(x=>
     Number.isFinite(now)&&now>Number(x.candle_close_time)+300000+660000).length;
    const awaitingNextCandle=withoutNextCandle.length-expiredWithoutNextCandle;
    const unscoredWithNextCandle=missing.length-withoutNextCandle.length;
    return [key,{signals:signs.length,scored:rows.length,
     awaitingNextCandle,expiredWithoutNextCandle,unscoredWithNextCandle,
     positiveOutcomes:rows.filter(x=>Number(x.modeled_net_return_pct)>0).length,
     averageModeledNetReturnPct:rows.length?round(rows.reduce((n,x)=>n+Number(x.modeled_net_return_pct),0)/rows.length):null,
     enoughEvidence:false,approved:false}];
   }))}];
 }));
 return {ok:true,mode:'FROZEN_PROSPECTIVE_NEXT_BAR',version:SCREEN_VERSION,
  startedAt:study.started_at,bySymbol,observations:observations.length,outcomes:outcomes.length,
  sampleAdequacy:'INSUFFICIENT',dataTimestamp:new Date(now).toISOString(),completenessRule:'CANDLE_CONTIGUITY_REQUIRED',autoPromotionEnabled:false,realOrdersEnabled:false,
  caution:'Resultados de um único candle futuro observado com taxas e slippage, não P&L de posições com stop e alvo. Sinais/cenários dependentes; seleção realizada em pesquisa anterior. Cobertura desde o primeiro registro inclui intervalos perdidos após a última coleta; histórico anterior não é estimado. Sem preenchimento de intervalos perdidos e sem aprovação automática.'};
}
