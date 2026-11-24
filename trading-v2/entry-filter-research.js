// Frozen exploratory hypothesis: test whether trend persistence / volatility screening
// improve the *selective EMA+RSI* candidate after fees and a 30-minute cooldown.
// Only closed-candle inputs used; no tuning based on the reserved test folds.
import {runStrategyLab} from './strategy-lab.js';
import {TARGET_BARS} from './historical-market.js';
const CANDIDATE='selective';
export const FILTER_SCENARIOS=Object.freeze([
 {key:'reference',label:'Seletiva + pausa 30 min',filters:{minEmaSpreadPct:0,minAtrPct:0,minTrendBars:1}},
 {key:'trend_confirmed',label:'Tendência confirmada',filters:{minEmaSpreadPct:.12,minAtrPct:0,minTrendBars:3}},
 {key:'volatility_screen',label:'Volatilidade mínima',filters:{minEmaSpreadPct:0,minAtrPct:.25,minTrendBars:1}},
 {key:'combined',label:'Tendência + volatilidade',filters:{minEmaSpreadPct:.12,minAtrPct:.25,minTrendBars:3}}
]);
const round=n=>Math.round(n*100)/100;
export function compareEntryFilters(candles,{symbol='BTCUSDT'}={}){
 if(!Array.isArray(candles)||candles.length!==TARGET_BARS)throw Error('Entry filter research requires 28 days of history');
 const trainBars=2016,testBars=864,stepBars=1728;
 const folds=[];
 for(let start=trainBars;start+testBars<=candles.length;start+=stepBars){
  const window=candles.slice(start-trainBars,start+testBars);
  const studies=FILTER_SCENARIOS.map(({key,filters})=>{
   const result=runStrategyLab(window,{symbol,entryFilters:filters,
    costModel:{feeRate:.001,slippageRate:.0005,cooldownBars:6}});
   if(result.testCandles!==testBars)throw Error('Holdout split unexpectedly changed');
   const record=result.candidates.find(x=>x.id===CANDIDATE);
   if(!record)throw Error('Missing selective candidate');
   return {key,test:record.test};
  });
  folds.push({fold:folds.length+1,
   testFrom:new Date(window[trainBars].time).toISOString(),
   testTo:new Date(window.at(-1).closeTime).toISOString(),studies});
 }
 if(folds.length!==4)throw Error('Expected four forward folds');
 const scenarios=FILTER_SCENARIOS.map(config=>{
  const tests=folds.map(f=>f.studies.find(s=>s.key===config.key).test);
  return {key:config.key,label:config.label,parameters:config.filters,
   closedTrades:tests.reduce((n,t)=>n+t.closedTrades,0),
   meanReturnPct:round(tests.reduce((n,t)=>n+t.returnPct,0)/tests.length),
   worstReturnPct:round(Math.min(...tests.map(t=>t.returnPct))),
   bestReturnPct:round(Math.max(...tests.map(t=>t.returnPct))),
   positiveFolds:tests.filter(t=>t.returnPct>0).length,
   maxModeledDrawdownPct:round(Math.max(...tests.map(t=>t.maxDrawdownPct))),
   sufficientEvidence:false,approved:false};
 });
 const reference=scenarios[0];
 return {symbol,mode:'RESEARCH_ONLY',experiment:'ENTRY_FILTERS_V1',candidate:CANDIDATE,
  historyDays:28,testFolds:4,trainDays:7,testDays:3,
  feeRate:.001,slippageRate:.0005,cooldownBars:6,
  scenarios:scenarios.map(s=>({...s,
   improvementVsReferencePp:round(s.meanReturnPct-reference.meanReturnPct)})),
  warning:'All scenarios share previously examined historical periods. Higher historical return is exploratory only; independent future validation is required.',
  autoPromotionEnabled:false,orderExecutionEnabled:false,newsTradingEnabled:false};
}
