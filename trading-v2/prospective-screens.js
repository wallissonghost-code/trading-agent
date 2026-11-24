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
export function summarizeScreenStudy({study,observations=[],outcomes=[]}={}){
 verifyScreenStudy(study);
 if(!Array.isArray(observations)||!Array.isArray(outcomes))throw Error('Invalid screen archive');
 const bySymbol=Object.fromEntries(['BTCUSDT','ETHUSDT','SOLUSDT'].map(symbol=>{
  const items=observations.filter(o=>o.symbol===symbol);
  const scored=outcomes.filter(o=>o.symbol===symbol);
  return [symbol,{observedCandles:items.length,
   latestObservedAt:items[0]?.observed_at||null,
   scenarios:Object.fromEntries(SCREEN_KEYS.map(key=>{
    const signs=items.filter(x=>x.signals?.[key]===true);
    const rows=scored.filter(x=>x.scenario===key&&Number.isFinite(Number(x.modeled_net_return_pct)));
    return [key,{signals:signs.length,scored:rows.length,
     positiveOutcomes:rows.filter(x=>Number(x.modeled_net_return_pct)>0).length,
     averageModeledNetReturnPct:rows.length?round(rows.reduce((n,x)=>n+Number(x.modeled_net_return_pct),0)/rows.length):null,
     enoughEvidence:false,approved:false}];
   }))}];
 }));
 return {ok:true,mode:'FROZEN_PROSPECTIVE_NEXT_BAR',version:SCREEN_VERSION,
  startedAt:study.started_at,bySymbol,observations:observations.length,outcomes:outcomes.length,
  sampleAdequacy:'INSUFFICIENT',autoPromotionEnabled:false,realOrdersEnabled:false,
  caution:'Resultados de um único candle futuro observado com taxas e slippage, não P&L de posições com stop e alvo. Sinais/cenários dependentes; seleção realizada em pesquisa anterior. Sem preenchimento de intervalos perdidos e sem aprovação automática.'};
}
