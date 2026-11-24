// Prospective research only. Every outcome is produced by a DB trigger AFTER a
// future full candle was observed; no historical backfill or paper order is allowed.
import {ema,rsi,atr} from './engine.js';
import {FILTER_SCENARIOS} from './entry-filter-research.js';
export const FORWARD_VERSION='filters-v1-20261124';
export const FORWARD_KEYS=Object.freeze(FILTER_SCENARIOS.map(s=>s.key));
const INTERVAL_MS=300000;
// Fail closed if a later deployment accidentally changes any frozen parameters.
export function verifyFrozenForwardConfig(study){
 if(study?.version!==FORWARD_VERSION||!Number.isFinite(Date.parse(study.started_at))||
    Number(study.horizon_minutes)!==5||Number(study.fees_bps)!==10||Number(study.slippage_bps)!==5)
  throw Error('Frozen study version or cost assumption mismatch');
 const actual=study.configs;
 if(!actual||Object.keys(actual).length!==FORWARD_KEYS.length)throw Error('Frozen study scenario set mismatch');
 for(const item of FILTER_SCENARIOS){
  const expected={...item.filters,rsiMin:55,rsiMax:65};
  const got=actual[item.key];
  if(!got||Object.keys(got).length!==Object.keys(expected).length||
     Object.entries(expected).some(([name,value])=>Number(got[name])!==value))
   throw Error('Frozen study parameter drift: '+item.key);
 }
 return true;
}
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

// Separate frozen prospective paper experiment; never transfers balance or positions
// to the actual paper portfolio. Position processing is atomic in Supabase.
export const SHADOW_VERSION='shadow-v1-20261124';
export function verifyShadowStudy(study){
 if(study?.version!==SHADOW_VERSION||!Number.isFinite(Date.parse(study.started_at))||
  Number(study.fee_bps)!==10||Number(study.slippage_bps)!==5||
  Number(study.risk_budget_pct)!==1||Number(study.max_exposure_pct)!==50||
  Number(study.atr_multiplier)!==2.5||Number(study.target_r_multiple)!==2||
  Number(study.max_holding_bars)!==24||Number(study.cooldown_bars)!==6)
  throw Error('Shadow study frozen execution rules mismatch');
 const configs=study.configs;
 if(!configs||Object.keys(configs).length!==FILTER_SCENARIOS.length)
  throw Error('Shadow study scenario mismatch');
 for(const option of FILTER_SCENARIOS){
  const expected={...option.filters,rsiMin:55,rsiMax:65};
  const found=configs[option.key];
  if(!found||Object.keys(found).length!==Object.keys(expected).length||
   Object.entries(expected).some(([key,value])=>Number(found[key])!==value))
   throw Error('Shadow study scenario parameter drift: '+option.key);
 }
 return true;
}
export function buildShadowObservation(candles,{symbol,now=Date.now(),studyStartedAt}={}){
 const snapshot=buildForwardObservation(candles,{symbol,now,studyStartedAt});
 if(snapshot.status!=='ready')return snapshot;
 const last=candles.at(-1),stopDistance=Math.max(atr(candles,14)*2.5,last.close*.002);
 if(!Number.isFinite(stopDistance)||stopDistance<=0)throw Error('Invalid frozen stop distance');
 return {...snapshot,version:SHADOW_VERSION,
  candleHigh:last.high,candleLow:last.low,atr14:atr(candles,14),stopDistance,
  executionEnabled:false};
}
export function summarizeShadowTrades({study,trades=[]}={}){
 verifyShadowStudy(study);
 const markets=['BTCUSDT','ETHUSDT','SOLUSDT'],states=['OPEN','CLOSED','INVALIDATED'];
 const summary=Object.fromEntries(markets.map(symbol=>{
  const subset=trades.filter(x=>x.symbol===symbol);
  const variants=Object.fromEntries(FORWARD_KEYS.map(scenario=>{
   const list=subset.filter(x=>x.scenario===scenario);
   const closed=list.filter(x=>x.status==='CLOSED');
   const net=closed.reduce((n,x)=>n+Number(x.realized_pnl_usd),0);
   const wins=closed.filter(x=>Number(x.realized_pnl_usd)>0).length;
   return [scenario,{open:list.filter(x=>x.status==='OPEN').length,
    closed:closed.length,invalidated:list.filter(x=>x.status==='INVALIDATED').length,
    wins,winRatePct:closed.length?Math.round(wins/closed.length*10000)/100:null,
    totalRealizedPnlUsd:Math.round(net*100)/100,
    averageNetReturnPct:closed.length?Math.round(closed.reduce((n,x)=>n+Number(x.net_return_pct),0)/closed.length*10000)/10000:null,
    sampleAdequacy:'INSUFFICIENT',approved:false}];
  }));
  return [symbol,{trades:subset.length,scenarios:variants}];
 }));
 const completed=trades.filter(x=>x.status==='CLOSED');
 return {ok:true,version:SHADOW_VERSION,startedAt:study.started_at,
  mode:'FROZEN_PROSPECTIVE_SHADOW_TRADES',assumedStartingCapitalUsd:10000,
  open:trades.filter(x=>x.status==='OPEN').length,closed:completed.length,
  invalidated:trades.filter(x=>x.status==='INVALIDATED').length,
  source:'supabase',bySymbol:summary,partialHistory:trades.length>=500,
  warnings:['P&L e fills fictícios; stops e alvos intrabar são estimados a partir de OHLC.',
   'A referência de US$ 10.000 é fixa por cenário, sem capitalização dos resultados.',
   'Dados incompletos invalidam posições; nenhuma estratégia foi aprovada.'],
  orderExecutionEnabled:false,autoPromotionEnabled:false,
  recentTrades:trades.filter(x=>states.includes(x.status)).slice(0,20).map(x=>({
   symbol:x.symbol,scenario:x.scenario,status:x.status,entryFill:Number(x.entry_fill),
   exitFill:x.exit_fill===null?null:Number(x.exit_fill),
   netPnlUsd:x.realized_pnl_usd===null?null:Number(x.realized_pnl_usd),
   entryTime:x.entry_candle_open_time,exitTime:x.exit_candle_close_time,
   exitReason:x.exit_reason||null,stopPrice:Number(x.stop_price),targetPrice:Number(x.target_price)
  }))};
}
