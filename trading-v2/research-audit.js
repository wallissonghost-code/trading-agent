// Evaluation gate for archived walk-forward studies. Review-only: never changes paper trades.
const ALLOWED=new Set(['BTCUSDT','ETHUSDT','SOLUSDT']);
export function auditWalkForwardReports(reports=[]){
 if(!Array.isArray(reports))throw Error('Invalid archived reports');
 const latest=new Map();
 for(const row of reports){
  const report=row?.report;
  if(!report||!ALLOWED.has(report.symbol)||!Array.isArray(report.summary)||!Array.isArray(report.foldResults))continue;
  const stamp=Date.parse(row.completed_at);
  if(!Number.isFinite(stamp))continue;
  const old=latest.get(report.symbol);
  if(!old||stamp>old.stamp)latest.set(report.symbol,{stamp,report});
 }
 const bySymbol={};
 for(const [symbol,{report,stamp}] of latest){
  const validated=report.foldCount===4&&report.foldResults.length===4&&report.horizonDays===28&&
    report.trainDays===7&&report.testDays===3;
  const candidates=(report.summary||[]).map(c=>{
   const four=Number(c.testFolds)===4;
   const trades=Number(c.closedTrades);
   const positives=Number(c.positiveFolds);
   const avg=Number(c.meanTestReturnPct);
   const worst=Number(c.worstTestReturnPct);
   const dd=Number(c.worstTestDrawdownPct);
   const valid=[trades,positives,avg,worst,dd].every(Number.isFinite)&&
     trades>=0&&positives>=0&&positives<=4&&dd>=0&&four&&validated;
   const reasons=[];
   if(!valid)reasons.push('INVALID_OR_INCOMPLETE_REPORT');
   if(trades<30)reasons.push('INSUFFICIENT_TRADES');
   if(positives<3)reasons.push('INCONSISTENT_POSITIVE_FOLDS');
   if(avg<=0)reasons.push('NEGATIVE_MEAN_HOLDOUT_RETURN');
   if(worst<0)reasons.push('NEGATIVE_WORST_HOLDOUT');
   if(dd>5)reasons.push('EXCESSIVE_MODELED_DRAWDOWN');
   // Fundamental safety gate: only 28 days observed and overlapping training windows.
   reasons.push('NEEDS_LONGER_INDEPENDENT_VALIDATION');
   return {id:String(c.id),label:String(c.label),trades:valid?trades:null,positiveFolds:valid?positives:null,
    averageHoldoutReturnPct:valid?avg:null,worstHoldoutReturnPct:valid?worst:null,
    worstModeledDrawdownPct:valid?dd:null,issues:reasons,status:'RESEARCH_ONLY',approved:false};
  });
  bySymbol[symbol]={updatedAt:new Date(stamp).toISOString(),complete:validated,foldCount:report.foldCount,
    candidates,approved:0};
 }
 return {mode:'RESEARCH_AUDIT',evaluation:'OBSERVATIONAL',
  source:'persisted_walk_forward_reports',symbolsReviewed:Object.keys(bySymbol).length,
  candidateCount:Object.values(bySymbol).reduce((total,r)=>total+r.candidates.length,0),
  rejectedOrUnapproved:Object.values(bySymbol).reduce((total,r)=>total+r.candidates.filter(c=>!c.approved).length,0),
  approved:0,autoPromotionEnabled:false,orderExecutionEnabled:false,bySymbol};
}
