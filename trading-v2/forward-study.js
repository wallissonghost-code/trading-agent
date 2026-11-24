// Prospective research only. Every outcome is produced by a DB trigger AFTER a
// future full candle was observed; no historical backfill or paper order is allowed.
import {ema,rsi,atr} from './engine.js';
import {FILTER_SCENARIOS} from './entry-filter-research.js';
export const FORWARD_VERSION='filters-v1-20261124';
export const FORWARD_KEYS=Object.freeze(FILTER_SCENARIOS.map(s=>s.key));
const INTERVAL_MS=300000;
export function buildForwardObservation(candles,{symbol,now=Date.now(),studyStartedAt}={}){
 if(!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(symbol))throw Error('Invalid forward study symbol');
 const started=Date.parse(studyStartedAt);
 if(!Number.isFinite(started))throw Error('Frozen study start is missing');
 if(!Array.isArray(candles)||candles.length<40)throw Error('Insufficient future signal history');
 for(let i=0;i<candles.length;i++){
  const c=candles[i];
  if(!c||![c.time,c.closeTime,c.open,c.high,c.low,c.close].every(Number.isFinite)||
     c.closeTime!==c.time+INTERVAL_MS-1||c.open<=0||c.close<=0||
     c.low<=0||c.high<c.low||c.open>c.high||c.open<c.low||c.close>c.high||c.close<c.low||
     (i&&c.time-candles[i-1].time!==INTERVAL_MS))throw Error('Gap or invalid future candle');
 }
 const last=candles.at(-1);
 // Never claim samples observed before the version was frozen.
 if(last.closeTime<started)return {status:'not_started',symbol};
 // Reject stale snapshots after service sleeps. This isn't a catch-up backtest.
 if(now<=last.closeTime||now-last.closeTime>11*60*1000)
  return {status:'stale',symbol};
 const closes=candles.map(c=>c.close);
 const fast=ema(closes,9),slow=ema(closes,21),strength=rsi(closes),volatility=atr(candles,14);
 if(![fast,slow,strength,volatility].every(Number.isFinite))throw Error('Incomplete frozen filters');
 const relativeSpread=(fast-slow)/last.close*100;
 const atrPct=volatility/last.close*100;
 let persistent=0;
 for(let offset=0;offset<20;offset++){
  const known=closes.slice(0,closes.length-offset);
  if(known.length<35||ema(known,9)<=ema(known,21))break;
  persistent++;
 }
 const signals=Object.fromEntries(FILTER_SCENARIOS.map(config=>[
  config.key,fast>slow&&strength>=55&&strength<=65&&
  relativeSpread>=config.filters.minEmaSpreadPct&&
  atrPct>=config.filters.minAtrPct&&persistent>=config.filters.minTrendBars
 ]));
 return {status:'ready',symbol,version:FORWARD_VERSION,
  candleOpenTime:last.time,candleCloseTime:last.closeTime,
  candleOpen:last.open,candleClose:last.close,signals,
  signalCount:Object.values(signals).filter(Boolean).length,
  mode:'RESEARCH_ONLY',executionEnabled:false};
}
export function summarizeForwardStudy({study,observations=[],outcomes=[]}={}){
 if(!study||study.version!==FORWARD_VERSION)throw Error('Unknown frozen study version');
 const bySymbol={};
 for(const symbol of ['BTCUSDT','ETHUSDT','SOLUSDT']){
  const snapshots=observations.filter(x=>x.symbol===symbol);
  const scores=outcomes.filter(x=>x.symbol===symbol);
  const variants=Object.fromEntries(FORWARD_KEYS.map(key=>{
   const list=scores.filter(x=>x.scenario===key);
   const mean=list.length?list.reduce((sum,r)=>sum+Number(r.modeled_net_return_pct),0)/list.length:null;
   const positives=list.filter(x=>Number(x.modeled_net_return_pct)>0).length;
   return [key,{samples:list.length,positive:positives,
    meanModeledNetReturnPct:mean===null?null:Math.round(mean*10000)/10000,
    evidence:'INSUFFICIENT',approved:false}];
  }));
  bySymbol[symbol]={observations:snapshots.length,scored:scores.length,
   earliestObservedAt:snapshots.length?snapshots.at(-1).observed_at:null,
   scenarios:variants};
 }
 return {version:FORWARD_VERSION,startedAt:study.started_at,mode:'PROSPECTIVE_OBSERVATION',
  note:'Future 5-minute single-bar hypothetical outcomes; not the stop/take trading strategy P&L.',
  sampleAdequacy:'INSUFFICIENT',autoPromotionEnabled:false,realOrdersEnabled:false,bySymbol};
}
