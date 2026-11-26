// Read-only laboratory metrics. Never modifies paper state or executes orders.
// Input is the persisted paper state JSON; trades are newest-first in today's engine.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const round=(x,d=4)=>Number.isFinite(x)?Number(x.toFixed(d)):null;
export function summarizePaperState(state){
  if(!state||!Array.isArray(state.trades))throw new TypeError('A persisted paper state with trades is required');
  const names=['BTCUSDT','ETHUSDT','SOLUSDT'];
  const all=state.trades.filter(t=>t&&t.simulated===true&&names.includes(t.symbol));
  const snapshot=Array.isArray(state.positions);
  const partialHistory=snapshot&&state.trades.length>=30;
  const results=names.map(symbol=>{
    const trades=all.filter(t=>t.symbol===symbol);
    const exits=trades.filter(t=>t.side==='SELL'&&finite(t.realizedPnl)).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
    const wins=exits.filter(t=>t.realizedPnl>0);
    const losses=exits.filter(t=>t.realizedPnl<0);
    const breakeven=exits.length-wins.length-losses.length;
    const grossProfit=wins.reduce((s,t)=>s+t.realizedPnl,0);
    const grossLoss=-losses.reduce((s,t)=>s+t.realizedPnl,0);
    const sum=exits.reduce((s,t)=>s+t.realizedPnl,0);
    let equity=0,peak=0,maxRealizedDrawdown=0;
    for(const t of exits){equity+=t.realizedPnl;peak=Math.max(peak,equity);maxRealizedDrawdown=Math.max(maxRealizedDrawdown,peak-equity);}
    const fees=trades.reduce((s,t)=>s+(finite(t.fee)?t.fee:0),0);
    const persisted=snapshot?state.agentPnl?.[symbol]?.realizedPnl:state.realizedBySymbol?.[symbol];
    return {
      symbol,entries:trades.filter(t=>t.side==='BUY').length,
      closedTrades:exits.length,wins:wins.length,losses:losses.length,breakeven,
      winRatePct:exits.length?round(wins.length/exits.length*100,2):null,
      avgWin:wins.length?round(grossProfit/wins.length):null,
      avgLoss:losses.length?round(grossLoss/losses.length):null,
      expectancyPerClose:exits.length?round(sum/exits.length):null,
      profitFactor:grossLoss>0?round(grossProfit/grossLoss):null,
      realizedFromExitEvents:round(sum),
      realizedFromPortfolio:finite(persisted)?round(persisted):null,
      reconciliationDelta:finite(persisted)?round(persisted-sum):null,
      recordedEventFees:round(fees),
      maxRealizedOnlyDrawdown:round(maxRealizedDrawdown),
      openPosition:snapshot?state.positions.some(p=>p.symbol===symbol):Boolean(state.positions?.[symbol]),
      lastExitTime:exits.at(-1)?.time??null,
      assessment:partialHistory?'PARTIAL_TRADE_HISTORY':exits.length<30?'INSUFFICIENT_SAMPLE':'REQUIRES_OUT_OF_SAMPLE_VALIDATION'
    };
  });
  return {
    mode:'PAPER_ANALYSIS_ONLY',source:snapshot?'RECENT_PAPER_API_SNAPSHOT':'PERSISTED_PAPER_STATE',
    partialHistory,scope:snapshot?'RECENT_EVENTS_ONLY':'PERSISTED_STATE_EVENTS',
    updatedAt:state.updatedAt??null,totals:{
      closeEvents:results.reduce((s,r)=>s+r.closedTrades,0),
      realizedPnl:finite(state.realizedPnl)?round(state.realizedPnl):null,
      initialCash:finite(state.startingCash)?state.startingCash:null
    },robots:results,
    limitations:[
      'Realized per-event PnL may be rounded; reconciliation differences must not be silently erased.',
      'Realized-only drawdown excludes open-position mark-to-market and is not portfolio max drawdown.',
      'Win rate, profit factor and expectancy are descriptive; they do not prove learning or profitability.',
      'Recorded event fees may already be included in realized PnL; never subtract them twice.',
      'The public paper endpoint returns at most 30 recent events; totals derived from it may be incomplete.',
      'At least 30 closes is a preliminary sample threshold, not an approval criterion.'
    ],autoPromotionEnabled:false,orderExecutionEnabled:false
  };
}
