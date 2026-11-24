// Sensitivity study, not a causal explanation or strategy approval.
// Same fixed parameters and chronological holdouts, varying only assumed trading costs.
import {runStrategyLab,LAB_CANDIDATES} from './strategy-lab.js';
import {TARGET_BARS} from './historical-market.js';
const round=n=>Math.round(n*100)/100;
const CONFIGS=Object.freeze([
 {key:'no_costs',label:'Sem custos (referência irrealista)',feeRate:0,slippageRate:0},
 {key:'base',label:'Custos estimados padrão',feeRate:.001,slippageRate:.0005},
 {key:'stress',label:'Custos agravados',feeRate:.002,slippageRate:.001}
]);
export function diagnoseStrategyLosses(candles,{symbol='BTCUSDT'}={}){
 if(!Array.isArray(candles)||candles.length!==TARGET_BARS)throw Error('Diagnostics require exactly 28 days');
 const trainBars=2016,testBars=864,stepBars=1728;
 const folds=[];
 for(let start=trainBars;start+testBars<=candles.length;start+=stepBars){
  const window=candles.slice(start-trainBars,start+testBars);
  const marketReturn=round((window.at(-1).close/window[trainBars].open-1)*100);
  const scenarios=CONFIGS.map(model=>{
   const lab=runStrategyLab(window,{symbol,costModel:model});
   if(lab.testCandles!==testBars)throw Error('Research split changed');
   return {key:model.key,byCandidate:Object.fromEntries(lab.candidates.map(c=>[c.id,c.test]))};
  });
  folds.push({fold:folds.length+1,marketReturnPct:marketReturn,
    marketDirection:marketReturn>0?'rising':marketReturn<0?'falling':'flat',
    scenarios});
 }
 if(folds.length!==4)throw Error('Research fold count mismatch');
 const byCandidate=LAB_CANDIDATES.map(c=>{
  const tests=Object.fromEntries(CONFIGS.map(model=>[model.key,
   folds.map(f=>f.scenarios.find(sc=>sc.key===model.key).byCandidate[c.id])]));
  const mean=key=>round(tests[key].reduce((sum,r)=>sum+r.returnPct,0)/tests[key].length);
  const base=mean('base'),noCosts=mean('no_costs'),stress=mean('stress');
  const trades=tests.base.reduce((sum,r)=>sum+r.closedTrades,0);
  return {id:c.id,label:c.label,folds:4,trades,
   averageTradesPerFold:round(trades/4),
   meanReturnNoCostsPct:noCosts,meanReturnBasePct:base,
   meanReturnStressPct:stress,
   estimatedCostSensitivityPp:round(noCosts-base),
   stressCostSensitivityPp:round(base-stress),
   profitableFoldsBase:tests.base.filter(r=>r.returnPct>0).length,
   lossPersistsWithoutCosts:noCosts<=0,
   status:'EXPLORATORY_ONLY',approved:false};
 });
 const rising=folds.filter(f=>f.marketReturnPct>0).length;
 return {symbol,mode:'RESEARCH_DIAGNOSTICS',period:'28d',foldCount:folds.length,
  marketReference:{risingFolds:rising,fallingFolds:folds.filter(f=>f.marketReturnPct<0).length,
    foldReturnsPct:folds.map(f=>f.marketReturnPct)},
  costAssumptions:CONFIGS.map(({key,label,feeRate,slippageRate})=>({key,label,feeRate,slippageRate})),
  candidates:byCandidate,
  interpretation:'Cost scenario difference is sensitivity, not an exact attribution of losses; varying costs can change trade quantity and execution.',
  safeguards:{autoPromotionEnabled:false,newsDrivenTrading:false,realOrdersEnabled:false}};
}
