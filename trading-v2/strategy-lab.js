// Research-only backtester. This module never sends orders and never changes the paper engine.
// Split is chronological: candidates are evaluated separately on 70% training and 30% held-out candles.
// Entry occurs at the *next* candle open, after indicators were known at previous candle close.

export const LAB_CANDIDATES=Object.freeze([
 {id:'baseline',label:'EMA 9/21 + RSI 50–70',fast:9,slow:21,rsiMin:50,rsiMax:70,atrMultiplier:2},
 {id:'slower',label:'EMA 12/26 + RSI 50–70',fast:12,slow:26,rsiMin:50,rsiMax:70,atrMultiplier:2},
 {id:'selective',label:'EMA 9/21 + RSI 55–65',fast:9,slow:21,rsiMin:55,rsiMax:65,atrMultiplier:2.5}
]);
const FEE_RATE=.001, SLIPPAGE_RATE=.0005, STARTING_CASH=10000;
const fix=n=>Math.round((n+Number.EPSILON)*100)/100;

// Single forward pass with the same EMA/RSI/ATR smoothing rules as engine.js.
// Signals at index i depend ONLY on information through index i-1.
function buildSignals(candles,cfg){
 const signals=Array(candles.length).fill(null);
 let quick=0,slow=0,quickSum=0,slowSum=0,rsiGain=0,rsiLoss=0,atrValue=0,atrSum=0;
 for(let i=0;i<candles.length;i++){
  const bar=candles[i],price=bar.close;
  if(i<cfg.fast)quickSum+=price;
  if(i===cfg.fast-1)quick=quickSum/cfg.fast;
  else if(i>=cfg.fast)quick+=(price-quick)*2/(cfg.fast+1);
  if(i<cfg.slow)slowSum+=price;
  if(i===cfg.slow-1)slow=slowSum/cfg.slow;
  else if(i>=cfg.slow)slow+=(price-slow)*2/(cfg.slow+1);
  if(i>0){
   const delta=price-candles[i-1].close;
   const gain=Math.max(0,delta),loss=Math.max(0,-delta);
   if(i<=14){rsiGain+=gain;rsiLoss+=loss;if(i===14){rsiGain/=14;rsiLoss/=14;}}
   else{rsiGain=(rsiGain*13+gain)/14;rsiLoss=(rsiLoss*13+loss)/14;}
   const trueRange=Math.max(bar.high-bar.low,Math.abs(bar.high-candles[i-1].close),Math.abs(bar.low-candles[i-1].close));
   if(i<=14){atrSum+=trueRange;if(i===14)atrValue=atrSum/14;}
   else atrValue=(atrValue*13+trueRange)/14;
  }
  if(i<39||i+1>=candles.length)continue;
  const rsiStrength=rsiLoss===0?(rsiGain===0?50:100):100-100/(1+rsiGain/rsiLoss);
  if(quick>slow&&rsiStrength>=cfg.rsiMin&&rsiStrength<=cfg.rsiMax&&Number.isFinite(atrValue))
   signals[i+1]={last:price,stopDistance:Math.max(atrValue*cfg.atrMultiplier,price*.002)};
 }
 return signals;
}
function runSegment(candles,from,to,cfg,signals,{feeRate=FEE_RATE,slippageRate=SLIPPAGE_RATE,cooldownBars=0}={}){
 let cash=STARTING_CASH,position=null,peak=STARTING_CASH,maxDrawdown=0;
 let wins=0,losses=0,profit=0,loss=0,closed=0,entries=0;
 let lastExitIndex=-1000000,cooldownSkippedSignals=0;
 const equityAt=price=>cash+(position?position.qty*price:0);
 function exit(fillPrice,candleIndex){
  const proceeds=position.qty*fillPrice;
  const pnl=proceeds-proceeds*feeRate-position.cost;
  cash+=proceeds*(1-feeRate);
  closed++;
  if(pnl>0){wins++;profit+=pnl;}else if(pnl<0){losses++;loss+=-pnl;}
  position=null;
  lastExitIndex=candleIndex;
 }
 for(let i=from;i<to;i++){
  const bar=candles[i];
  if(position){
    const stopHit=bar.low<=position.stop;
    const targetHit=bar.high>=position.target;
    if(stopHit||targetHit){
      // Conservative when stop and target are touched in the same candle: stop wins.
      const base=stopHit?Math.min(position.stop,bar.open):position.target;
      exit(base*(1-slippageRate),i);
    }
  } else {
    const signal=signals[i];
    if(signal){
      if(i-lastExitIndex<=cooldownBars){cooldownSkippedSignals++;continue;}
      const entry=bar.open*(1+slippageRate);
      const stop=signal.last-signal.stopDistance;
      const stopDistance=entry-stop;
      const capital=equityAt(bar.open);
      if(stop>0&&stopDistance>0&&Number.isFinite(stopDistance)){
       const qty=Math.min((capital*.01)/(stopDistance+entry*(feeRate*2+slippageRate)),
         (capital*.5)/entry,cash/(entry*(1+feeRate)));
       if(Number.isFinite(qty)&&qty*entry>=10){
        const cost=qty*entry*(1+feeRate);
        cash-=cost;entries++;
        position={qty,cost,stop,target:entry+2*stopDistance};
        // Position may hit stop/target in its entry candle (no look-ahead).
        const stopHit=bar.low<=stop,targetHit=bar.high>=position.target;
        if(stopHit||targetHit){
          const base=stopHit?Math.min(stop,bar.open):position.target;
          exit(base*(1-slippageRate),i);
        }
       }
      }
    }
  }
  const marked=equityAt(bar.close);
  peak=Math.max(peak,marked);
  maxDrawdown=Math.max(maxDrawdown,peak>0?(peak-marked)/peak*100:0);
 }
 if(position)exit(candles[to-1].close*(1-slippageRate),to-1); // Forced segment-end close, including fees.
 const net=cash-STARTING_CASH;
 return {startingCash:STARTING_CASH,endingCash:fix(cash),netPnl:fix(net),
  returnPct:fix(net/STARTING_CASH*100),closedTrades:closed,entries,cooldownSkippedSignals,
  winRate:closed?fix(100*wins/closed):null,avgWin:wins?fix(profit/wins):null,
  avgLoss:losses?fix(loss/losses):null,profitFactor:loss>0?fix(profit/loss):null,
  maxDrawdownPct:fix(maxDrawdown)};
}

export function runStrategyLab(candles,{symbol='BTCUSDT',costModel={feeRate:FEE_RATE,slippageRate:SLIPPAGE_RATE}}={}){
 const {feeRate,slippageRate,cooldownBars=0}=costModel;
 if(!Number.isInteger(cooldownBars)||cooldownBars<0||cooldownBars>144)throw Error('Invalid research cooldown');
 if(!Number.isFinite(feeRate)||!Number.isFinite(slippageRate)||feeRate<0||feeRate>.01||slippageRate<0||slippageRate>.01)throw Error('Invalid research-only cost model');
 if(!Array.isArray(candles)||candles.length<180||candles.length>3500)throw Error('Research requires 180–3500 closed candles');
 for(let i=0;i<candles.length;i++){
  const c=candles[i];
  if(!c||![c.open,c.high,c.low,c.close,c.closeTime].every(Number.isFinite)||
   c.open<=0||c.close<=0||c.low<=0||c.high<c.low||c.open>c.high||c.close<c.low||c.close>c.high||
   (i>0&&(c.closeTime<=candles[i-1].closeTime||c.closeTime-candles[i-1].closeTime!==300000)))
   throw Error('Research candles must be valid consecutive closed 5m candles');
 }
 const split=Math.round(candles.length*.7);
 const candidates=LAB_CANDIDATES.map(candidate=>{
  const signals=buildSignals(candles,candidate);
  const train=runSegment(candles,40,split,candidate,signals,costModel);
  const test=runSegment(candles,split,candles.length,candidate,signals,costModel);
  return {id:candidate.id,label:candidate.label,train,test,
   holdoutEvidence:test.closedTrades>=30&&(candles.at(-1).closeTime-candles[split].closeTime)>=7*24*60*60*1000?'preliminary':'insufficient',
   promotionEligible:false};
 });
 return {symbol,mode:'RESEARCH_ONLY',source:'binance_public_spot',
  candles:candles.length,interval:'5m',trainCandles:split,testCandles:candles.length-split,
  shortWindowWarning:'Historical window under multiple market regimes; results are not strategy validation',
  trainEndsAt:new Date(candles[split-1].closeTime).toISOString(),
  testStartsAt:new Date(candles[split].time??candles[split].closeTime-299999).toISOString(),
  testedParameters:LAB_CANDIDATES.length,feeRate,slippageRate,
  executionAssumption:'next_candle_open;stop_first_if_ambiguous',
  notLiveFills:true,autoPromotionEnabled:false,orderExecutionEnabled:false,
  tradeStrategyChanged:false,candidates};
}
