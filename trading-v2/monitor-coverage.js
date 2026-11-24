// Observed market-candle coverage is not service availability or uptime.
// The sample is intentionally limited to the previous SIX COMPLETE hours; 5-minute
// candle slots not recorded are unknown, never automatically counted as outages.
export const COVERAGE_WINDOW_MS=6*60*60*1000;
export const SLOT_MS=5*60*1000;
const ASSETS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
export function summarizeObservedCoverage({observations=[],events=[],states=[],now=Date.now(),partial=false}={}){
 if(!Array.isArray(observations)||!Array.isArray(events)||!Array.isArray(states)||!Number.isFinite(now))
  throw Error('Invalid observed coverage input');
 const endSlot=Math.floor((now-1)/SLOT_MS)*SLOT_MS-1;
 const startSlot=endSlot-COVERAGE_WINDOW_MS+SLOT_MS;
 const expectedSlots=COVERAGE_WINDOW_MS/SLOT_MS;
 const bySymbol=Object.fromEntries(ASSETS.map(symbol=>{
  const valid=observations.filter(o=>o.symbol===symbol).map(o=>Number(o.candle_close_time))
   .filter(t=>Number.isSafeInteger(t)&&t>=startSlot&&t<=endSlot&&
     (t+1)%SLOT_MS===0).sort((a,b)=>a-b);
  const unique=[...new Set(valid)];
  const missingSlots=expectedSlots-unique.length;
  const missingRuns=[];
  let begin=null,previous=null;
  for(let t=startSlot;t<=endSlot;t+=SLOT_MS){
   const exists=unique.includes(t);
   if(!exists&&begin===null)begin=t;
   if(exists&&begin!==null){
    missingRuns.push({from:begin,to:previous,slots:Math.round((previous-begin)/SLOT_MS)+1});
    begin=null;
   }
   previous=t;
  }
  if(begin!==null)missingRuns.push({from:begin,to:previous,slots:Math.round((previous-begin)/SLOT_MS)+1});
  const incidentEvents=events.filter(x=>x.symbol===symbol);
  const started=incidentEvents.filter(x=>x.kind==='ISSUE_STARTED').length;
  const changed=incidentEvents.filter(x=>x.kind==='ISSUE_CHANGED').length;
  const recovered=incidentEvents.filter(x=>x.kind==='RECOVERED').length;
  const state=states.find(s=>s.symbol===symbol)||null;
  return [symbol,{
   recordedSlots:unique.length,expectedSlots,unobservedSlots:missingSlots,
   observedCoveragePct:Math.round(unique.length/expectedSlots*10000)/100,
   unobservedIntervals:missingRuns.length,
   longestUnobservedRunMinutes:missingRuns.length?Math.max(...missingRuns.map(x=>x.slots))*5:0,
   latestRecordedSlot:unique.at(-1)??null,
   currentObservedState:state?.status||'UNVERIFIED',
   incidentStartedEvents:started,incidentChangedEvents:changed,recoveryEvents:recovered,
   selectedWindowUnknownsAreNotOutages:true,
   sufficientForTrueUptime:false
  }];
 }));
 return {ok:true,mode:'OBSERVED_CANDLE_COVERAGE',windowHours:6,
  windowStart:new Date(startSlot-SLOT_MS+1).toISOString(),
  windowEnd:new Date(endSlot).toISOString(),
  retrievedAt:new Date(now).toISOString(),expectedSlotsPerMarket:expectedSlots,
  observationHistoryPartial:Boolean(partial),
  incidentHistoryLimited:true,
  notice:'Observed 5m candle coverage, NOT 24/7 uptime. Missing slots may mean Render sleep, data API gaps, or collection outages. Incident timestamps are detection times only.',
  bySymbol,orderExecutionEnabled:false,autoPromotionEnabled:false};
}
