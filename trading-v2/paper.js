import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { analyze } from './engine.js';
import { SYMBOLS, getKlines } from './market.js';

const round=(x,n=8)=>Number(x.toFixed(n));
const fee=0.001;
const maxPositions=2;
const maxExposure=0.5;
const candleIntervalMs=5*60*1000;
const minContinuousPaperCandles=35;
// A market feed can omit bars inside the indicator window even if its latest bar is fresh.
// Fail closed before touching the account: never infer EMA/RSI/stops from a broken window.
export function assertPaperCandleContinuity(candles,{required=minContinuousPaperCandles}={}){
 if(!Array.isArray(candles)||candles.length<required)throw Error('Insufficient candles');
 if(!Number.isInteger(required)||required<2)throw Error('Invalid continuity requirement');
 const window=candles.slice(-required);
 for(let i=0;i<window.length;i++){
  const c=window[i];
  if(!Number.isSafeInteger(c?.closeTime)||!Number.isSafeInteger(c?.time)||
     ![c.open,c.high,c.low,c.close].every(Number.isFinite)||
     c.low<=0||c.low>c.high||c.open<c.low||c.open>c.high||
     c.close<c.low||c.close>c.high||
     c.closeTime-c.time!==candleIntervalMs-1)
   throw Error('Invalid paper market candle');
  if(i>0&&(c.time-window[i-1].time!==candleIntervalMs||
             c.closeTime-window[i-1].closeTime!==candleIntervalMs))
   throw Error('Incomplete paper market candle window');
 }
 return true;
}
// Diagnostics only: this classifies why a paper order failed; it never changes sizing or limits.
export const classifyPaperEntryBlock=({exposureBudget,minNotional=10})=>
 Number.isFinite(exposureBudget)&&exposureBudget<minNotional?'PORTFOLIO_EXPOSURE_LIMIT':'CAPITAL_OR_RISK_LIMIT';
export const createAccount=()=>({schema:1,startingCash:10000,cash:10000,realizedPnl:0,realizedBySymbol:{},lastMarks:{},lastDecision:null,lastDecisions:{},positions:{},trades:[],lastCandle:{},lastError:{},dataGaps:{},gapLocks:{},updatedAt:null});
export function snapshot(account, quotes={}){
  const positions=Object.values(account.positions).map(p=>{const markPrice=quotes[p.symbol]||account.lastMarks?.[p.symbol]||p.entry;return {...p,markPrice,unrealizedPnl:round((markPrice-p.entry)*p.quantity - p.entry*p.quantity*fee - markPrice*p.quantity*fee,2)};});
  const equity=account.cash+positions.reduce((sum,p)=>sum+p.quantity*p.markPrice,0);
  const agentPnl=Object.fromEntries(SYMBOLS.map(symbol=>[symbol,{realizedPnl:round(account.realizedBySymbol?.[symbol]??account.trades.filter(t=>t.symbol===symbol&&t.side==='SELL').reduce((sum,t)=>sum+(t.realizedPnl||0),0),2),unrealizedPnl:round(positions.find(p=>p.symbol===symbol)?.unrealizedPnl||0,2)}]));
  return {mode:'PAPER_ONLY',currency:'USDT',startingCash:account.startingCash,agentPnl,cash:round(account.cash,2),equity:round(equity,2),realizedPnl:round(account.realizedPnl,2),unrealizedPnl:round(positions.reduce((x,p)=>x+p.unrealizedPnl,0),2),positions,trades:account.trades.slice(0,30),lastCandle:account.lastCandle,lastDecision:account.lastDecision,lastDecisions:account.lastDecisions||{},lastError:account.lastError,dataGaps:account.dataGaps||{},gapLocks:account.gapLocks||{},updatedAt:account.updatedAt,dataSource:'binance_public_spot',executionEnabled:false,persistence:'local_ephemeral'};
}
export function processCandle(account,symbol,candles,{now=new Date().toISOString()}={}){
  if(!SYMBOLS.includes(symbol))throw new Error('Unsupported pair');
  if(!Array.isArray(candles)||candles.length<35)throw new Error('Insufficient candles');
  const c=candles.at(-1);
  if(!Number.isFinite(c.close)||c.close<=0||!Number.isFinite(c.closeTime))throw new Error('Invalid candle');
  const age=Date.parse(now)-c.closeTime;
  if(!Number.isFinite(age)||age<0||age>20*60*1000)throw new Error('Stale or future market candle');
  if(account.lastCandle[symbol]!==undefined&&c.closeTime<=account.lastCandle[symbol])return {processed:false,reason:'already_processed'};
  assertPaperCandleContinuity(candles);
  account.dataGaps??={};
  account.gapLocks??={};
  account.lastDecisions??={};
  const previousClose=account.lastCandle[symbol];
  const missedCandles=Number.isFinite(previousClose)?Math.max(0,Math.floor((c.closeTime-previousClose)/300000)-1):0;
  // A suspended process cannot retroactively fill trades at historical candle prices.
  // Record the observed gap once, advance the cursor, and never place a virtual order on resumption.
  if(missedCandles>0){
    account.dataGaps[symbol]={detectedAt:now,previousCandleCloseTime:previousClose,
      resumedCandleCloseTime:c.closeTime,missedCandles,unreconciledPosition:Boolean(account.positions[symbol])};
    if(account.positions[symbol])account.gapLocks[symbol]=true;
  }
  if(missedCandles>0||account.gapLocks[symbol]){
    const locked=Boolean(account.gapLocks[symbol]);
    const decision={symbol,candleCloseTime:c.closeTime,observedAt:now,
      strategy:'EMA_RSI_V1',action:'WAIT',reason:locked?'DATA_GAP_POSITION_LOCK':'DATA_GAP_RESUMED',
      classification:'unknown',price:c.close,simulated:true,
      entryGates:{paperOnly:true,continuityVerified:false}};
    account.lastMarks??={};
    account.lastMarks[symbol]=c.close;
    account.lastDecision=decision;
    account.lastDecisions[symbol]=decision;
    account.lastCandle[symbol]=c.closeTime;
    account.updatedAt=now;
    return {processed:true,reason:decision.reason,missedCandles,locked};
  }
  account.lastMarks??={};
  account.lastMarks[symbol]=c.close;
  const signal=analyze(candles,account.cash);
  if(!signal.ok)throw new Error(signal.reason);
  // Single close per symbol avoids replay after restart. This is paper execution at a closed candle price,
  // NOT a realizable historical fill. Intrabar stop/take uses conservative stop-first assumption.
  const position=account.positions[symbol];
  const previousTradeCount=account.trades.length;
  account.lastDecisions??={};
  const decision={symbol,candleCloseTime:c.closeTime,observedAt:now,strategy:'EMA_RSI_V1',classification:signal.classification,price:c.close,
    rsi14:Number.isFinite(signal.rsi14)?signal.rsi14:null,ema9:Number.isFinite(signal.ema9)?signal.ema9:null,
    ema21:Number.isFinite(signal.ema21)?signal.ema21:null,atr14:Number.isFinite(signal.atr14)?signal.atr14:null,
    action:'WAIT',reason:'NO_NEW_ENTRY',simulated:true,
    entryGates:{emaBullish:signal.ema9>signal.ema21,
      rsiInBuyRange:signal.rsi14>=50&&signal.rsi14<=70,
      positionSlotsAvailable:Object.keys(account.positions).length<maxPositions,
      paperOnly:true}};
  // Explanations are observational. They do not change entry criteria.
  if(!position&&signal.classification!=='watch_long'){
    decision.reason=signal.ema9<=signal.ema21?'EMA_TREND_NOT_BULLISH':'RSI_OUTSIDE_BUY_RANGE';
  }
  if(position){
    const stopped=c.low<=position.stop;
    const targetHit=c.high>=position.take;
    if(stopped||targetHit){
      const fill=stopped?Math.min(position.stop,c.open):position.take;
      const proceeds=position.quantity*fill;
      const sellFee=proceeds*fee;
      account.cash=round(account.cash+proceeds-sellFee,8);
      const pnl=proceeds-sellFee-position.cost;
      account.realizedPnl=round(account.realizedPnl+pnl,8);
      account.realizedBySymbol??=Object.fromEntries(SYMBOLS.map(s=>[s,account.trades.filter(t=>t.symbol===s&&t.side==='SELL').reduce((sum,t)=>sum+(t.realizedPnl||0),0)]));
      account.realizedBySymbol[symbol]=round((account.realizedBySymbol[symbol]||0)+pnl,8);
      account.trades.unshift({symbol,side:'SELL',reason:stopped?'STOP_LOSS':'TAKE_PROFIT',price:fill,quantity:position.quantity,fee:round(sellFee,8),realizedPnl:round(pnl,2),time:now,candleCloseTime:c.closeTime,simulated:true});
      delete account.positions[symbol];
      decision.action='SELL';decision.reason=stopped?'STOP_LOSS':'TAKE_PROFIT';
    }else{decision.reason='POSITION_OPEN';}
  }else if(signal.classification==='watch_long'&&Object.keys(account.positions).length<maxPositions){
    // Other pairs have different price scales; use their recorded entry notionals, never this symbol's price.
    const exposure=Object.values(account.positions).reduce((s,p)=>s+p.quantity*p.entry,0);
    const equity=account.cash+Object.values(account.positions).reduce((s,p)=>s+p.quantity*(account.lastMarks[p.symbol]||p.entry),0);
    const drawdown=(account.startingCash-equity)/account.startingCash;
    if(drawdown>=0.05){decision.reason='PORTFOLIO_DRAWDOWN_LOCK';account.lastDecision=decision;account.lastDecisions[symbol]=decision;account.lastCandle[symbol]=c.closeTime;account.updatedAt=now;return {processed:true,reason:'portfolio_drawdown_lock'};}
    const stop=signal.exampleStop;
    const riskBudget=Math.max(0,0.01*equity);
    const riskPerUnit=(c.close-stop)+2*fee*c.close;
    const exposureBudget=Math.max(0,maxExposure*equity-exposure);
    // Report the frozen 50% exposure gate separately from free cash or stop-risk sizing.
    decision.entryGates.portfolioExposureAvailable=exposureBudget>=10;
    decision.entryGates.exposureRemainingUsdt=round(exposureBudget,2);
    const cashBudget=account.cash;
    const quantity=Math.max(0,Math.min(riskBudget/riskPerUnit,exposureBudget/c.close,cashBudget/(c.close*(1+fee))));
    const notional=quantity*c.close;
    if(Number.isFinite(quantity)&&quantity>0&&notional>=10&&stop>0&&stop<c.close){
      const cost=notional*(1+fee);
      account.cash=round(account.cash-cost,8);
      account.positions[symbol]={symbol,entry:c.close,stop:round(stop),take:round(c.close+2*(c.close-stop)),quantity:round(quantity),cost:round(cost),openedAt:now,entryCandle:c.closeTime};
      account.trades.unshift({symbol,side:'BUY',reason:'EMA_RSI_WATCH_LONG',price:c.close,quantity:round(quantity),fee:round(notional*fee,8),realizedPnl:null,time:now,candleCloseTime:c.closeTime,simulated:true});
      decision.action='BUY';decision.reason='EMA_RSI_WATCH_LONG';
    }else{
      decision.reason=classifyPaperEntryBlock({exposureBudget});
    }
  }else if(!position&&signal.classification==='watch_long'){
    decision.reason='MAX_OPEN_POSITIONS';
  }
  account.lastDecision=decision;
  account.lastDecisions[symbol]=decision;
  account.lastCandle[symbol]=c.closeTime;
  account.updatedAt=now;
  account.trades.splice(100);
  return {processed:true,classification:signal.classification};
}
export async function loadAccount(path){
  try{
    const data=JSON.parse(await readFile(path,'utf8'));
    if(data.schema!==1||!Number.isFinite(data.cash)||data.cash<0||!data.positions||!data.lastCandle||!Array.isArray(data.trades))throw Error('Invalid paper account state');
    return data;
  }catch(error){
    if(error.code==='ENOENT')return createAccount();
    throw error; // Fail closed: never silently reset corrupted trading history.
  }
}
export async function saveAccount(path,account){
  await mkdir(dirname(path),{recursive:true});
  const tmp=path+'.tmp';
  await writeFile(tmp,JSON.stringify(account),{mode:0o600});
  await rename(tmp,path);
}
export function createPaperRunner({path,store=null,fetchKlines=getKlines,clock=()=>new Date()}){
  const persistence=store||{kind:'local_ephemeral',load:()=>loadAccount(path),save:a=>saveAccount(path,a)};
  let account=null,busy=false,quotes={},storageFault=null;
  return {
    async init(){account=await persistence.load();return this.status();},
    status(){if(!account)return {ready:false,mode:'PAPER_ONLY',executionEnabled:false,persistence:persistence.kind};return {ready:!storageFault,...snapshot(account,quotes),persistence:persistence.kind,storageError:storageFault};},
    async runOnce(){
      if(!account)throw Error('Paper runner not initialized');
      if(storageFault)throw Error('Paper runner halted after persistence error: '+storageFault);
      if(busy)return {skipped:true,reason:'busy'};
      busy=true;
      try{
        for(const symbol of SYMBOLS){
          try{
            const {candles}=await fetchKlines(symbol);
            const last=candles.at(-1);
            // Never use unvalidated future/stale candles as price marks.
            const quoteAge=clock().getTime()-last.closeTime;
            if(!Number.isFinite(quoteAge)||quoteAge<0||quoteAge>20*60*1000)throw Error('Stale or future market candle');
            const before=account.lastCandle[symbol];
            const checkpoint=structuredClone(account);
            processCandle(account,symbol,candles,{now:clock().toISOString()});
            if(account.lastCandle[symbol]!==before){
              // Match each successfully persisted portfolio cursor to exactly one
              // processed 5m paper candle in the same Supabase transaction.
              const decision=account.lastDecisions[symbol];
              const journal={
                symbol,previousClose:Number.isSafeInteger(before)?before:null,
                candleCloseTime:account.lastCandle[symbol],action:decision.action,
                reason:decision.reason,observedAt:decision.observedAt
              };
              try{await persistence.save(account,{journal});}
              catch(error){account=checkpoint;storageFault=String(error.message||error).slice(0,160);throw error;}
            }
            // A market quote is visible only after a valid candle and any required durable save.
            quotes[symbol]=last.close;
            delete account.lastError[symbol];
          }catch(err){
            account.lastError[symbol]=String(err.message||err).slice(0,180);
            if(storageFault)break;
          }
        }
        return this.status();
      }finally{busy=false;}
    }
  };
}
