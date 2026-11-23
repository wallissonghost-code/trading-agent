// Research-only backtester. This module never sends orders and never changes the paper engine.
// Split is chronological: candidates are evaluated separately on 70% training and 30% held-out candles.
// Entry occurs at the *next* candle open, after indicators were known at previous candle close.
import {ema,rsi,atr} from './engine.js';

export const LAB_CANDIDATES=Object.freeze([
 {id:'baseline',label:'EMA 9/21 + RSI 50–70',fast:9,slow:21,rsiMin:50,rsiMax:70,atrMultiplier:2},
 {id:'slower',label:'EMA 12/26 + RSI 50–70',fast:12,slow:26,rsiMin:50,rsiMax:70,atrMultiplier:2},
 {id:'selective',label:'EMA 9/21 + RSI 55–65',fast:9,slow:21,rsiMin:55,rsiMax:65,atrMultiplier:2.5}
]);
const FEE_RATE=.001, SLIPPAGE_RATE=.0005, STARTING_CASH=10000;
const fix=n=>Math.round((n+Number.EPSILON)*100)/100;

function eligible(candles,index,cfg){
 const history=candles.slice(0,index);
 if(history.length<40)return null;
 const closes=history.map(c=>c.close);
 const quick=ema(closes,cfg.fast),slow=ema(closes,cfg.slow);
 const strength=rsi(closes),vol=atr(history);
 if(![quick,slow,strength,vol].every(Number.isFinite))return null;
 if(quick<=slow||strength<cfg.rsiMin||strength>cfg.rsiMax)return null;
 const last=history.at(-1).close;
 return {last,stopDistance:Math.max(vol*cfg.atrMultiplier,last*.002)};
}
function runSegment(candles,from,to,cfg){
 let cash=STARTING_CASH,position=null,peak=STARTING_CASH,maxDrawdown=0;
 let wins=0,losses=0,profit=0,loss=0,closed=0,entries=0;
 const equityAt=price=>cash+(position?position.qty*price:0);
 function exit(fillPrice){
  const proceeds=position.qty*fillPrice;
  const pnl=proceeds-proceeds*FEE_RATE-position.cost;
  cash+=proceeds*(1-FEE_RATE);
  closed++;
  if(pnl>0){wins++;profit+=pnl;}else if(pnl<0){losses++;loss+=-pnl;}
  position=null;
 }
 for(let i=from;i<to;i++){
  const bar=candles[i];
  if(position){
    const stopHit=bar.low<=position.stop;
    const targetHit=bar.high>=position.target;
    if(stopHit||targetHit){
      // Conservative when stop and target are touched in the same candle: stop wins.
      const base=stopHit?Math.min(position.stop,bar.open):position.target;
      exit(base*(1-SLIPPAGE_RATE));
    }
  } else {
    const signal=eligible(candles,i,cfg);
    if(signal){
      const entry=bar.open*(1+SLIPPAGE_RATE);
      const stop=signal.last-signal.stopDistance;
      const stopDistance=entry-stop;
      const capital=equityAt(bar.open);
      if(stop>0&&stopDistance>0&&Number.isFinite(stopDistance)){
       const qty=Math.min((capital*.01)/(stopDistance+entry*(FEE_RATE*2+SLIPPAGE_RATE)),
         (capital*.5)/entry,cash/(entry*(1+FEE_RATE)));
       if(Number.isFinite(qty)&&qty*entry>=10){
        const cost=qty*entry*(1+FEE_RATE);
        cash-=cost;entries++;
        position={qty,cost,stop,target:entry+2*stopDistance};
        // Position may hit stop/target in its entry candle (no look-ahead).
        const stopHit=bar.low<=stop,targetHit=bar.high>=position.target;
        if(stopHit||targetHit){
          const base=stopHit?Math.min(stop,bar.open):position.target;
          exit(base*(1-SLIPPAGE_RATE));
        }
       }
      }
    }
  }
  const marked=equityAt(bar.close);
  peak=Math.max(peak,marked);
  maxDrawdown=Math.max(maxDrawdown,peak>0?(peak-marked)/peak*100:0);
 }
 if(position)exit(candles[to-1].close*(1-SLIPPAGE_RATE)); // Forced segment-end close, including fees.
 const net=cash-STARTING_CASH;
 return {startingCash:STARTING_CASH,endingCash:fix(cash),netPnl:fix(net),
  returnPct:fix(net/STARTING_CASH*100),closedTrades:closed,entries,
  winRate:closed?fix(100*wins/closed):null,avgWin:wins?fix(profit/wins):null,
  avgLoss:losses?fix(loss/losses):null,profitFactor:loss>0?fix(profit/loss):null,
  maxDrawdownPct:fix(maxDrawdown)};
}

export function runStrategyLab(candles,{symbol='BTCUSDT'}={}){
 if(!Array.isArray(candles)||candles.length<180||candles.length>1000)throw Error('Research requires 180–1000 closed candles');
 for(let i=0;i<candles.length;i++){
  const c=candles[i];
  if(!c||![c.open,c.high,c.low,c.close,c.closeTime].every(Number.isFinite)||
   c.open<=0||c.close<=0||c.low<=0||c.high<c.low||c.open>c.high||c.close<c.low||c.close>c.high||
   (i>0&&(c.closeTime<=candles[i-1].closeTime||c.closeTime-candles[i-1].closeTime!==300000)))
   throw Error('Research candles must be valid consecutive closed 5m candles');
 }
 const split=Math.floor(candles.length*.7);
 const candidates=LAB_CANDIDATES.map(candidate=>{
  const train=runSegment(candles,40,split,candidate);
  const test=runSegment(candles,split,candles.length,candidate);
  return {id:candidate.id,label:candidate.label,train,test,
   holdoutEvidence:test.closedTrades>=30?'preliminary':'insufficient',
   promotionEligible:false};
 });
 return {symbol,mode:'RESEARCH_ONLY',source:'binance_public_spot',
  candles:candles.length,interval:'5m',trainCandles:split,testCandles:candles.length-split,
  trainEndsAt:new Date(candles[split-1].closeTime).toISOString(),
  testStartsAt:new Date(candles[split].time??candles[split].closeTime-299999).toISOString(),
  testedParameters:LAB_CANDIDATES.length,feeRate:FEE_RATE,slippageRate:SLIPPAGE_RATE,
  executionAssumption:'next_candle_open;stop_first_if_ambiguous',
  notLiveFills:true,autoPromotionEnabled:false,orderExecutionEnabled:false,
  tradeStrategyChanged:false,candidates};
}
