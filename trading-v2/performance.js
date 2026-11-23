// Pure analytical summaries for PAPER trading only. No strategy mutations or live orders.
export function performance(trades=[],startingCash=10000){
 const sells=trades.filter(t=>t?.side==='SELL'&&Number.isFinite(Number(t.realizedPnl)));
 const wins=sells.filter(t=>Number(t.realizedPnl)>0);
 const losses=sells.filter(t=>Number(t.realizedPnl)<0);
 const sum=arr=>arr.reduce((total,x)=>total+Number(x.realizedPnl),0);
 const profit=sum(wins),loss=-sum(losses),net=sum(sells);
 const round=(n)=>Math.round(n*100)/100;
 const chron=[...sells].sort((a,b)=>Number(a.candleCloseTime||Date.parse(a.time)||0)-Number(b.candleCloseTime||Date.parse(b.time)||0));
 let equity=startingCash;
 const curve=[{time:null,equity:startingCash}];
 for(const sell of chron){equity+=Number(sell.realizedPnl);curve.push({time:sell.time||null,equity:round(equity)});}
 const summary=group=>({closed:group.length,wins:group.filter(t=>Number(t.realizedPnl)>0).length,losses:group.filter(t=>Number(t.realizedPnl)<0).length,netPnl:round(sum(group)),winRate:group.length?round(group.filter(t=>Number(t.realizedPnl)>0).length/group.length*100):null});
 const bySymbol=Object.fromEntries(['BTCUSDT','ETHUSDT','SOLUSDT'].map(symbol=>[symbol,summary(sells.filter(t=>t.symbol===symbol))]));
 return {mode:'PAPER_ONLY',basis:'realized_trades_only',closed:sells.length,winRate:sells.length?round(wins.length/sells.length*100):null,averageWin:wins.length?round(profit/wins.length):null,averageLoss:losses.length?round(loss/losses.length):null,profitFactor:loss>0?round(profit/loss):null,netPnl:round(net),curve,bySymbol,partialHistory:false,learningMode:'observation_only',newsTradingEnabled:false};
}
