import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { analyze } from './engine.js';
import { SYMBOLS, getKlines } from './market.js';

const round=(x,n=8)=>Number(x.toFixed(n));
const fee=0.001;
const maxPositions=2;
const maxExposure=0.5;
export const createAccount=()=>({schema:1,startingCash:10000,cash:10000,realizedPnl:0,positions:{},trades:[],lastCandle:{},lastError:{},updatedAt:null});
export function snapshot(account, quotes={}){
  const positions=Object.values(account.positions).map(p=>({...p,markPrice:quotes[p.symbol]||p.entry,unrealizedPnl:round(((quotes[p.symbol]||p.entry)-p.entry)*p.quantity - p.entry*p.quantity*fee - (quotes[p.symbol]||p.entry)*p.quantity*fee,2)}));
  const equity=account.cash+positions.reduce((sum,p)=>sum+p.quantity*p.markPrice,0);
  return {mode:'PAPER_ONLY',currency:'USDT',cash:round(account.cash,2),equity:round(equity,2),realizedPnl:round(account.realizedPnl,2),unrealizedPnl:round(positions.reduce((x,p)=>x+p.unrealizedPnl,0),2),positions,trades:account.trades.slice(0,30),lastCandle:account.lastCandle,lastError:account.lastError,updatedAt:account.updatedAt,dataSource:'binance_public_spot',executionEnabled:false,persistence:'local_ephemeral'};
}
export function processCandle(account,symbol,candles,{now=new Date().toISOString()}={}){
  if(!SYMBOLS.includes(symbol))throw new Error('Unsupported pair');
  if(!Array.isArray(candles)||candles.length<35)throw new Error('Insufficient candles');
  const c=candles.at(-1);
  if(!Number.isFinite(c.close)||c.close<=0||!Number.isFinite(c.closeTime))throw new Error('Invalid candle');
  if(account.lastCandle[symbol]!==undefined&&c.closeTime<=account.lastCandle[symbol])return {processed:false,reason:'already_processed'};
  const signal=analyze(candles,account.cash);
  if(!signal.ok)throw new Error(signal.reason);
  // Single close per symbol avoids replay after restart. This is paper execution at a closed candle price,
  // NOT a realizable historical fill. Intrabar stop/take uses conservative stop-first assumption.
  const position=account.positions[symbol];
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
      account.trades.unshift({symbol,side:'SELL',reason:stopped?'STOP_LOSS':'TAKE_PROFIT',price:fill,quantity:position.quantity,fee:round(sellFee,8),realizedPnl:round(pnl,2),time:now,candleCloseTime:c.closeTime,simulated:true});
      delete account.positions[symbol];
    }
  }else if(signal.classification==='watch_long'&&Object.keys(account.positions).length<maxPositions){
    // Other pairs have different price scales; use their recorded entry notionals, never this symbol's price.
    const exposure=Object.values(account.positions).reduce((s,p)=>s+p.quantity*p.entry,0);
    const equity=account.cash+exposure;
    const drawdown=(account.startingCash-equity)/account.startingCash;
    if(drawdown>=0.05){account.lastCandle[symbol]=c.closeTime;account.updatedAt=now;return {processed:true,reason:'portfolio_drawdown_lock'};}
    const stop=signal.exampleStop;
    const riskBudget=Math.max(0,0.01*equity);
    const riskPerUnit=(c.close-stop)+2*fee*c.close;
    const exposureBudget=Math.max(0,maxExposure*equity-exposure);
    const cashBudget=account.cash;
    const quantity=Math.max(0,Math.min(riskBudget/riskPerUnit,exposureBudget/c.close,cashBudget/(c.close*(1+fee))));
    const notional=quantity*c.close;
    if(Number.isFinite(quantity)&&quantity>0&&notional>=10&&stop>0&&stop<c.close){
      const cost=notional*(1+fee);
      account.cash=round(account.cash-cost,8);
      account.positions[symbol]={symbol,entry:c.close,stop:round(stop),take:round(c.close+2*(c.close-stop)),quantity:round(quantity),cost:round(cost),openedAt:now,entryCandle:c.closeTime};
      account.trades.unshift({symbol,side:'BUY',reason:'EMA_RSI_WATCH_LONG',price:c.close,quantity:round(quantity),fee:round(notional*fee,8),realizedPnl:null,time:now,candleCloseTime:c.closeTime,simulated:true});
    }
  }
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
            const last=candles.at(-1);quotes[symbol]=last.close;
            const before=account.lastCandle[symbol];
            const checkpoint=structuredClone(account);
            processCandle(account,symbol,candles,{now:clock().toISOString()});
            if(account.lastCandle[symbol]!==before){
              try{await persistence.save(account);}
              catch(error){account=checkpoint;storageFault=String(error.message||error).slice(0,160);throw error;}
            }
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
