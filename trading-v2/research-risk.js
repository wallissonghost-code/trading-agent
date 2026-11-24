// Read-only explanation of the FROZEN prospective long-only research rules.
// Not a trade signal, investment recommendation, strategy activation, or order.
import {ema,rsi,atr} from './engine.js';
import {FILTER_SCENARIOS} from './entry-filter-research.js';
const BAR_MS=300000;
const round=(n,d=4)=>Number(n.toFixed(d));
export function explainResearchRisk(candles,{symbol='BTCUSDT',now=Date.now()}={}){
 if(!['BTCUSDT','ETHUSDT','SOLUSDT'].includes(symbol))throw Error('Unsupported research symbol');
 if(!Array.isArray(candles)||candles.length<40)throw Error('Insufficient market history');
 for(let i=0;i<candles.length;i++){
  const c=candles[i];
  if(!c||![c.time,c.closeTime,c.open,c.high,c.low,c.close].every(Number.isFinite)||
   c.closeTime!==c.time+BAR_MS-1||c.open<=0||c.low<=0||c.high<c.low||
   c.open>c.high||c.open<c.low||c.close>c.high||c.close<c.low||
   (i&&c.time!==candles[i-1].time+BAR_MS))
   throw Error('Invalid or gapped market candles');
 }
 const last=candles.at(-1),age=now-last.closeTime;
 const fresh=age>=0&&age<=11*60*1000;
 const closes=candles.map(c=>c.close);
 const ema9=ema(closes,9),ema21=ema(closes,21),rsi14=rsi(closes,14),atr14=atr(candles,14);
 if(![ema9,ema21,rsi14,atr14].every(Number.isFinite)||atr14<=0)throw Error('Incomplete market indicators');
 let trendBars=0;
 for(let offset=0;offset<20;offset++){
  const known=closes.slice(0,-offset||undefined);
  if(known.length<35||ema(known,9)<=ema(known,21))break;
  trendBars++;
 }
 const spread=(ema9-ema21)/last.close*100,atrPct=atr14/last.close*100;
 const bullish=ema9>ema21,withinRsi=rsi14>=55&&rsi14<=65;
 const scenarios=FILTER_SCENARIOS.map(x=>{
  const f=x.filters;
  const conditions=[
   {key:'ema',pass:bullish,observed:round(spread),required:'EMA9 acima da EMA21'},
   {key:'rsi',pass:withinRsi,observed:round(rsi14,2),required:'RSI entre 55 e 65'},
   {key:'trendPersistence',pass:trendBars>=f.minTrendBars,observed:trendBars,minimum:f.minTrendBars},
   {key:'emaSpread',pass:spread>=f.minEmaSpreadPct,observed:round(spread),minimum:f.minEmaSpreadPct,unit:'%'},
   {key:'atrVolatility',pass:atrPct>=f.minAtrPct,observed:round(atrPct),minimum:f.minAtrPct,unit:'%'}
  ];
  const ready=conditions.every(v=>v.pass)&&fresh;
  return {key:x.key,label:x.label,marketConditionsMet:conditions.every(v=>v.pass),
   eligibleForResearch:fresh&&conditions.every(v=>v.pass),
   decision:!fresh?'DATA_STALE':ready?'RULES_MET':'WAIT',
   blockedBy:conditions.filter(v=>!v.pass).map(v=>v.key),conditions};
 });
 // Theoretical next-open sizing assumes close as an entry proxy. NOT executable.
 const slip=.0005,fee=.001;
 const entry=last.close*(1+slip),stop=last.close-Math.max(atr14*2.5,last.close*.002);
 const perUnitRisk=entry-stop;
 const allowedRisk=100,allowedNotional=5000;
 const quantity=stop>0&&perUnitRisk>0?
   Math.min(allowedRisk/(perUnitRisk+entry*(2*fee+2*slip)),allowedNotional/entry):0;
 const target=entry+2*perUnitRisk;
 const exitStopFill=Math.min(entry,stop)*(1-slip);
 const exitTargetFill=target*(1-slip);
 const loss=quantity>0?quantity*(exitStopFill*(1-fee)-entry*(1+fee)):null;
 const win=quantity>0?quantity*(exitTargetFill*(1-fee)-entry*(1+fee)):null;
 return {symbol,mode:'EXPLANATORY_RESEARCH_ONLY',candleClosedAt:new Date(last.closeTime).toISOString(),
  source:'public_closed_candles',dataFresh:fresh,ageSeconds:Math.max(0,Math.floor(age/1000)),
  indicators:{price:round(last.close,5),ema9:round(ema9,5),ema21:round(ema21,5),
   rsi14:round(rsi14,2),atr14:round(atr14,5),atrPercent:round(atrPct),emaSpreadPercent:round(spread),
   bullishTrendBars:trendBars},
  scenarios,riskProxy:{virtualCapitalUsd:10000,notionalLimitUsd:5000,riskBudgetUsd:100,
   indicativeEntry:round(entry,5),indicativeStop:round(stop,5),indicativeTarget:round(target,5),
   indicativeQuantity:round(quantity,8),estimatedStopPnLUsd:loss===null?null:round(loss,2),
   estimatedTargetPnLUsd:win===null?null:round(win,2),
   costs:{feeBpsPerSide:10,slippageBpsPerSide:5},
   caveat:'Close-price proxy, not a future fill. Gaps can make actual modeled stop losses exceed this estimate.'},
  conclusion:!fresh?'Preço/candle desatualizado: não interpretar como sinal':
   scenarios.some(x=>x.eligibleForResearch)?'Condições históricas de pesquisa atendidas, sem ordem autorizada':
   'Aguardando confirmação das condições congeladas',
  decisionExecutionEnabled:false,realOrdersEnabled:false,autoPromotionEnabled:false};
}
