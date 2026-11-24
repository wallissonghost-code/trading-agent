// Frozen hypothesis: does delaying repeat entries help after fees? Research only.
// Compare identical market windows and strategy parameters; only cooldown varies.
import {runStrategyLab,LAB_CANDIDATES} from './strategy-lab.js';
import {TARGET_BARS} from './historical-market.js';
const SETTINGS=Object.freeze([
 {key:'unchanged',label:'Sem pausa',cooldownBars:0},
 {key:'pause_30m',label:'Pausa de 30 minutos',cooldownBars:6},
 {key:'pause_60m',label:'Pausa de 60 minutos',cooldownBars:12}
]);
const rounded=v=>Math.round(v*100)/100;
export function compareCooldowns(candles,{symbol='BTCUSDT'}={}){
 if(!Array.isArray(candles)||candles.length!==TARGET_BARS)throw Error('Research comparison requires exactly 28 days');
 const training=2016,testing=864,step=1728;
 const folds=[];
 for(let start=training;start+testing<=candles.length;start+=step){
  const window=candles.slice(start-training,start+testing);
  const scenarios=SETTINGS.map(config=>{
   const run=runStrategyLab(window,{symbol,costModel:{feeRate:.001,slippageRate:.0005,cooldownBars:config.cooldownBars}});
   if(run.testCandles!==testing)throw Error('Test set changed');
   return {key:config.key,results:Object.fromEntries(run.candidates.map(c=>[c.id,c.test]))};
  });
  folds.push({fold:folds.length,scenarios});
 }
 if(folds.length!==4)throw Error('Expected four test folds');
 const candidates=LAB_CANDIDATES.map(candidate=>{
  const series=SETTINGS.map(option=>{
   const tests=folds.map(f=>f.scenarios.find(x=>x.key===option.key).results[candidate.id]);
   const totalTrades=tests.reduce((a,t)=>a+t.closedTrades,0);
   return {key:option.key,label:option.label,cooldownBars:option.cooldownBars,
    closedTrades:totalTrades,
    skippedSignals:tests.reduce((a,t)=>a+t.cooldownSkippedSignals,0),
    meanHoldoutReturnPct:rounded(tests.reduce((a,t)=>a+t.returnPct,0)/tests.length),
    worstHoldoutReturnPct:rounded(Math.min(...tests.map(t=>t.returnPct))),
    positiveFolds:tests.filter(t=>t.returnPct>0).length};
  });
  const base=series[0];
  return {id:candidate.id,label:candidate.label,scenarios:series,
   differencesVsBaseline:series.slice(1).map(x=>({
    key:x.key,meanReturnDifferencePp:rounded(x.meanHoldoutReturnPct-base.meanHoldoutReturnPct),
    fewerClosedTrades:base.closedTrades-x.closedTrades})),
   winningResearchNotEstablished:true,promotionEligible:false};
 });
 return {symbol,mode:'RESEARCH_ONLY',experiment:'COOLDOWN_SENSITIVITY_V1',
  days:28,folds:4,horizon:'3d_holdout',feeRate:.001,slippageRate:.0005,
  candidates,disclaimer:'Exploratory sensitivity on reused historical holdouts; no strategy selection or causal conclusions.',
  autoPromotionEnabled:false,orderExecutionEnabled:false};
}
