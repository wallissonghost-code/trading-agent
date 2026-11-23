// Research only: multiple chronological forward test windows with a frozen candidate set.
// No training on future candles and no automatic promotion to the paper runner.
import {runStrategyLab,LAB_CANDIDATES} from './strategy-lab.js';
import {TARGET_BARS} from './historical-market.js';

export function runWalkForward(candles,{symbol='BTCUSDT'}={}){
 if(!Array.isArray(candles)||candles.length!==TARGET_BARS)throw Error('Walk-forward requires exactly 28 days of five-minute candles');
 const trainBars=2016,testBars=864,stepBars=1728;
 const folds=[];
 for(let start=trainBars;start+testBars<=candles.length;start+=stepBars){
  // Restrict lookback to the training window and keep the test segment untouched.
  const window=candles.slice(start-trainBars,start+testBars);
  const study=runStrategyLab(window,{symbol});
  if(study.trainCandles!==trainBars||study.testCandles!==testBars)throw Error('Invalid chronological research split');
  folds.push({fold:folds.length+1,
   trainFrom:new Date(window[0].time).toISOString(),trainTo:study.trainEndsAt,
   testFrom:study.testStartsAt,testTo:new Date(window.at(-1).closeTime).toISOString(),
   candidates:study.candidates});
 }
 if(folds.length!==4)throw Error('Unexpected walk-forward fold count');
 const summary=LAB_CANDIDATES.map(config=>{
  const tests=folds.map(f=>f.candidates.find(c=>c.id===config.id).test);
  const training=folds.map(f=>f.candidates.find(c=>c.id===config.id).train);
  const sum=key=>tests.reduce((total,part)=>total+part[key],0);
  const closed=sum('closedTrades');
  const positiveFolds=tests.filter(t=>t.returnPct>0).length;
  return {id:config.id,label:config.label,
   testFolds:tests.length,positiveFolds,
   closedTrades:closed,
   meanTestReturnPct:Number((sum('returnPct')/tests.length).toFixed(2)),
   worstTestReturnPct:Number(Math.min(...tests.map(x=>x.returnPct)).toFixed(2)),
   bestTestReturnPct:Number(Math.max(...tests.map(x=>x.returnPct)).toFixed(2)),
   meanTrainReturnPct:Number((training.reduce((a,b)=>a+b.returnPct,0)/training.length).toFixed(2)),
   worstTestDrawdownPct:Number(Math.max(...tests.map(x=>x.maxDrawdownPct)).toFixed(2)),
   evidence:closed>=30?'preliminary_only':'insufficient',
   promotionEligible:false};
 });
 return {symbol,mode:'RESEARCH_ONLY',horizonDays:28,
   trainDays:7,testDays:3,stepDays:6,foldCount:folds.length,
   sampleAdequacy:'insufficient_for_production',autoPromotionEnabled:false,
   fillsAreSimulated:true,newsInputsActive:false,
   foldResults:folds,summary};
}
