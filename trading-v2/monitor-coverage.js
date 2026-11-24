// Observed market-candle coverage is not service availability or uptime.
// The sample is intentionally limited to the previous SIX COMPLETE hours; 5-minute
// candle slots not recorded are unknown, never automatically counted as outages.
export const COVERAGE_WINDOW_MS=6*60*60*1000;
export const SLOT_MS=5*60*1000;
const ASSETS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
export function summarizeObservedCoverage({observations=[],events=[],states=[],now=Date.now(),partial=false}={}){
 if(!Array.isArray(observations)||!Array.isArray(events)||!Array.isArray(states)||!Number.isFinite(now))
  throw Error('Invalid observed coverage input');
 const endSlot=Math.floor(now/SLOT_MS)*SLOT_MS-1;
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

// One 24-hour timeline per robot: 24 buckets of 12 *fully closed* 5m candle slots.
// "Unobserved" means not recorded, not an independently verified service outage.
// Alert markers reflect the detector's timestamp, not the time an issue began.
export function buildObservedTimeline({observations=[],events=[],now=Date.now(),partial=false}={}){
 if(!Array.isArray(observations)||!Array.isArray(events)||!Number.isFinite(now))
  throw Error('Invalid timeline input');
 const closedThrough=Math.floor(now/SLOT_MS)*SLOT_MS-1;
 const windowStart=closedThrough-24*60*60*1000+SLOT_MS;
 const buckets=24,slotsPerBucket=12;
 const bySymbol=Object.fromEntries(ASSETS.map(symbol=>{
  const observed=new Set(observations.filter(x=>x.symbol===symbol)
   .map(x=>Number(x.candle_close_time))
   .filter(t=>Number.isSafeInteger(t)&&t>=windowStart&&t<=closedThrough&&(t+1)%SLOT_MS===0));
  const timeline=Array.from({length:buckets},(_,i)=>{
   const first=windowStart+i*slotsPerBucket*SLOT_MS;
   const end=first+(slotsPerBucket-1)*SLOT_MS;
   let recorded=0;
   for(let j=0;j<slotsPerBucket;j++)if(observed.has(first+j*SLOT_MS))recorded++;
   const incidents=events.filter(x=>x.symbol===symbol)
    .filter(x=>{
      const detected=Date.parse(x.recorded_at);
      return Number.isFinite(detected)&&detected>first-SLOT_MS&&detected<=end;
    });
   return {start:new Date(first-SLOT_MS+1).toISOString(),
    end:new Date(end).toISOString(),recorded,
    unobserved:slotsPerBucket-recorded,
    events:incidents.map(x=>({kind:x.kind,detectedAt:x.recorded_at})),
    state:recorded===slotsPerBucket?'RECORDED':
     recorded===0?'UNOBSERVED':'PARTIAL'};
  });
  return [symbol,{recorded:observed.size,unobserved:288-observed.size,
   coveragePct:Math.round(observed.size/288*10000)/100,
   detectedIncidents:timeline.reduce((n,x)=>n+x.events.length,0),
   timeline}];
 }));
 return {ok:true,mode:'OBSERVED_24H_TIMELINE',
  windowHours:24,slotsPerMarket:288,bucketsPerMarket:24,
  windowStart:new Date(windowStart-SLOT_MS+1).toISOString(),
  windowEnd:new Date(closedThrough).toISOString(),
  observationHistoryPartial:Boolean(partial),
  eventHistoryLimited:true,
  distinction:'No recorded candle is UNKNOWN, not a proven outage. Incident icons mark detection timestamps and may not cover the real incident duration.',
  orderExecutionEnabled:false,autoPromotionEnabled:false,bySymbol};
}
