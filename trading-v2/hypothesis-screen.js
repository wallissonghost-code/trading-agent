// Exploratory, descriptive what-if entry screens for EXISTING closed reference trades.
// No re-execution, no unrealized fills, no future prices for entry features.
// Excluded trade P&L is not realizable savings; this is deliberately NOT a strategy backtest.
const SYMBOLS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
const BAR=300000;
const round=(v,d=2)=>Math.round(v*10**d)/10**d;
export const SCREEN_HYPOTHESES=Object.freeze([
 {key:'atr_at_least_025',label:'ATR no sinal ≥ 0,25%',description:'Volatilidade mínima já observada na entrada'},
 {key:'momentum_6_positive',label:'Seis candles anteriores em alta',description:'Movimento curto positivo antes do sinal'},
 {key:'atr_and_momentum',label:'ATR ≥ 0,25% e seis candles em alta',description:'Combinação de duas condições anteriores'}
]);
export function comparePreSignalHypotheses({trades=[],observations=[],partialTrades=false,partialObservations=false}={}){
 if(!Array.isArray(trades)||!Array.isArray(observations))throw Error('Invalid exploratory inputs');
 const candles=new Map();
 for(const row of observations){
  const t=Number(row?.candle_close_time);
  if(!SYMBOLS.includes(row?.symbol)||!Number.isSafeInteger(t)||(t+1)%BAR!==0)continue;
  const key=row.symbol+':'+t;
  if(!candles.has(key))candles.set(key,row);
 }
 const bySymbol=Object.fromEntries(SYMBOLS.map(symbol=>{
  // One frozen reference scenario per market. Other scenarios duplicate trade events.
  const tradesBySignal=new Map();
  for(const t of trades){
   const stamp=Number(t?.signal_candle_close_time);
   if(t?.symbol!==symbol||t?.scenario!=='reference'||t?.status!=='CLOSED'||
    t.realized_pnl_usd===null||!Number.isFinite(Number(t.realized_pnl_usd))||
    !Number.isSafeInteger(stamp)||!Number.isSafeInteger(Number(t.exit_candle_close_time)))continue;
   // Conservatively mark duplicate entries as ambiguous instead of double counting.
   const list=tradesBySignal.get(stamp)||[];
   list.push(t);tradesBySignal.set(stamp,list);
  }
  const entries=[...tradesBySignal.entries()].flatMap(([stamp,rows])=>{
   if(rows.length!==1)return [];
   const past=Array.from({length:7},(_,i)=>candles.get(symbol+':'+(stamp-(6-i)*BAR)));
   const signal=past.at(-1);
   const price=Number(signal?.candle_close),atr=Number(signal?.atr14);
   const atrPct=signal&&Number.isFinite(price)&&price>0&&Number.isFinite(atr)&&atr>0?atr/price*100:null;
   const c0=Number(past[0]?.candle_close),c6=Number(signal?.candle_close);
   const momentum=past.every(Boolean)&&Number.isFinite(c0)&&c0>0&&Number.isFinite(c6)&&c6>0?
    (c6/c0-1)*100:null;
   return [{stamp,pnl:Number(rows[0].realized_pnl_usd),atrPct,momentum}];
  });
  const scenarios=SCREEN_HYPOTHESES.map(item=>{
   const evaluated=entries.filter(x=>item.key==='atr_at_least_025'?x.atrPct!==null:
    item.key==='momentum_6_positive'?x.momentum!==null:x.atrPct!==null&&x.momentum!==null);
   const satisfies=x=>item.key==='atr_at_least_025'?x.atrPct>=0.25:
    item.key==='momentum_6_positive'?x.momentum>0:x.atrPct>=0.25&&x.momentum>0;
   const kept=evaluated.filter(satisfies),excluded=evaluated.filter(x=>!satisfies(x));
   const aggregate=xs=>({count:xs.length,losses:xs.filter(x=>x.pnl<0).length,
    positive:xs.filter(x=>x.pnl>0).length,observedNetPnlUsd:round(xs.reduce((n,x)=>n+x.pnl,0))});
   return {key:item.key,label:item.label,description:item.description,
    evaluated:evaluated.length,unknownContext:entries.length-evaluated.length,
    kept:aggregate(kept),excluded:aggregate(excluded),
    improvementProven:false,forwardValidated:false};
  });
  return [symbol,{closedReferenceTrades:entries.length,
   ambiguousDuplicateSignals:[...tradesBySignal.values()].filter(x=>x.length!==1).length,
   scenarios}];
 }));
 return {ok:true,mode:'EXPLORATORY_PRE_SIGNAL_SCREENS',scope:'CLOSED_REFERENCE_SCENARIO_ONLY',
  bySymbol,closedReferenceTrades:Object.values(bySymbol).reduce((a,x)=>a+x.closedReferenceTrades,0),
  hypotheses:SCREEN_HYPOTHESES.map(({key,label,description})=>({key,label,description})),
  partialTrades:Boolean(partialTrades),partialObservations:Boolean(partialObservations),
  interpretation:'SOMENTE estudo retrospectivo das operações prospectivas já encerradas: manter/excluir não é replay do motor e o P&L excluído não equivale a lucro economizado. Amostra pequena, períodos sobrepostos, nenhum efeito causal comprovado. Exigir validação futura independente antes de adotar qualquer regra.',
  strategyParametersChanged:false,autoPromotionEnabled:false,realOrdersEnabled:false,approved:false};
}
