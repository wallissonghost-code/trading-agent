// Paper testing evidence quality. Independent shadow observations are contextual,
// NEVER proof that a simulated paper trade was executed or continuously monitored.
import {SYMBOLS} from './market.js';

const FRESH_MS=20*60*1000;
const MIN_OBSERVATION_DAYS=7;
const sortUnique=(values)=>[...new Set(values)].sort((a,b)=>a-b);
const isFiniteTime=(x)=>Number.isSafeInteger(x)&&x>0;
const integer=(x)=>Number.isSafeInteger(x)&&x>=0?x:0;
export function summarizePaperEvidence({paper={},timeline=null,coverage=null,now=Date.now()}={}){
 if(!Number.isFinite(now))throw Error('Invalid evidence clock');
 const persisted=paper?.persistence==='supabase';
 const ready=paper?.ready===true&&!paper?.storageError;
 const trades=Array.isArray(paper?.trades)?paper.trades:[];
 const bySymbol={};
 for(const symbol of SYMBOLS){
  const raw=paper.lastCandle?.[symbol];
  const close=isFiniteTime(raw)?raw:null;
  const ageMinutes=close===null?null:Math.max(0,Math.round((now-close)/60000));
  const fresh=close!==null&&close<=now+60000&&now-close<=FRESH_MS;
  const locked=paper.gapLocks?.[symbol]===true;
  const gap=paper.dataGaps?.[symbol]||null;
  const fault=typeof paper.lastError?.[symbol]==='string'&&paper.lastError[symbol].length>0;
  const shadow24=timeline?.bySymbol?.[symbol]||null;
  const shadow6=coverage?.bySymbol?.[symbol]||null;
  const covered24=shadow24&&integer(shadow24.recorded)<=288&&shadow24.recorded>=0
   ?shadow24.recorded:null;
  const covered6=shadow6&&integer(shadow6.recordedSlots)<=72&&shadow6.recordedSlots>=0
   ?shadow6.recordedSlots:null;
  const reasons=[];
  if(!persisted)reasons.push('PAPER_PERSISTENCE_NOT_CONFIRMED');
  if(!ready)reasons.push('PAPER_RUNNER_NOT_READY');
  if(!fresh)reasons.push('LATEST_PAPER_CANDLE_STALE_OR_MISSING');
  if(fault)reasons.push('PAPER_MARKET_ERROR');
  if(locked)reasons.push('UNRECONCILED_POSITION_GAP');
  if(!timeline?.ok||!coverage?.ok||covered24===null||covered6===null)
   reasons.push('SHADOW_COVERAGE_UNAVAILABLE');
  if(timeline?.observationHistoryPartial||coverage?.observationHistoryPartial)
   reasons.push('SHADOW_HISTORY_QUERY_PARTIAL');
  if(covered24!==null&&covered24<288)reasons.push('UNOBSERVED_SHADOW_24H_SLOTS');
  if(covered6!==null&&covered6<72)reasons.push('UNOBSERVED_SHADOW_6H_SLOTS');
  reasons.push('PAPER_CANDLE_JOURNAL_7D_UNAVAILABLE');
  bySymbol[symbol]={
   symbol,status:reasons.length===1?'OBSERVATION_ONLY':'EVIDENCE_INSUFFICIENT',
   paperLastCloseAt:close===null?null:new Date(close).toISOString(),
   paperLastCandleAgeMinutes:ageMinutes,
   paperLastCandleFresh:fresh,
   activePaperPosition:paper.positions?.some?.(p=>p.symbol===symbol)===true,
   paperGapLocked:locked,latestKnownGapCandles:gap?integer(gap.missedCandles):0,
   shadowObserved24hSlots:covered24,shadowExpected24hSlots:288,
   shadowObserved6hSlots:covered6,shadowExpected6hSlots:72,
   shadowCoverage24hPct:covered24===null?null:Number((covered24/288*100).toFixed(2)),
   shadowCoverage6hPct:covered6===null?null:Number((covered6/72*100).toFixed(2)),
   // Current snapshot contains the most recent 30 trades, not the full ledger.
   recentPaperTradeRecords:trades.filter(t=>t.symbol===symbol).length,
   reasons,readyForLiveTrading:false
  };
 }
 return {ok:true,mode:'PAPER_EVIDENCE_DIAGNOSTICS',generatedAt:new Date(now).toISOString(),
  decision:'MORE_OBSERVATIONS_REQUIRED',minimumPaperObservationDays:MIN_OBSERVATION_DAYS,
  paperPersistence:persisted?'supabase':'UNCONFIRMED',
  dataSource:'paper_snapshot_plus_independent_shadow_research_observations',
  primaryLimitation:'O histórico de candles shadow não é o diário contínuo de execuções paper. Ainda não há 7 dias completos de candles paper auditados.',
  samplePartial:trades.length===30,
  results:SYMBOLS.map(s=>bySymbol[s]),
  automaticPromotionEnabled:false,realOrdersEnabled:false,
  noAutoHostingUpgrade:true,
  note:'Ausência de observação não comprova queda do serviço. Cobertura shadow é apenas contexto; não é taxa de sucesso, lucro ou disponibilidade do motor paper.'};
}
