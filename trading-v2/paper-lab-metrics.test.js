import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePaperState} from './paper-lab-metrics.js';
const trade=(symbol,side,realizedPnl,time,fee=.01)=>({symbol,side,realizedPnl,time,fee,simulated:true});
test('counts only closed paper exits; excludes unrealized entries',()=>{
 const data={startingCash:10000,realizedPnl:1,realizedBySymbol:{BTCUSDT:1},positions:{BTCUSDT:{quantity:1}},
 trades:[
  trade('BTCUSDT','SELL',-1,'2026-11-26T11:00:00Z'),
  trade('BTCUSDT','BUY',null,'2026-11-26T10:00:00Z'),
  trade('BTCUSDT','SELL',2,'2026-11-26T09:00:00Z'),
  {...trade('ETHUSDT','SELL',100,'2026-11-26T10:00:00Z'),simulated:false}
 ]};
 const x=summarizePaperState(data);
 const btc=x.robots.find(r=>r.symbol==='BTCUSDT');
 assert.equal(btc.closedTrades,2);
 assert.equal(btc.winRatePct,50);
 assert.equal(btc.expectancyPerClose,.5);
 assert.equal(btc.profitFactor,2);
 assert.equal(btc.realizedFromExitEvents,1);
 assert.equal(btc.maxRealizedOnlyDrawdown,1);
 assert.equal(btc.openPosition,true);
 assert.equal(x.totals.closeEvents,2);
 assert.equal(x.orderExecutionEnabled,false);
});
test('no trades produces null ratios rather than fake zeros',()=>{
 const x=summarizePaperState({trades:[]}).robots[0];
 assert.equal(x.winRatePct,null);
 assert.equal(x.profitFactor,null);
 assert.equal(x.assessment,'INSUFFICIENT_SAMPLE');
});
test('reconciliation reports differences without altering portfolio state',()=>{
 const state={trades:[trade('SOLUSDT','SELL',-.14,'2026-11-26T12:00:00Z')],realizedBySymbol:{SOLUSDT:-.141412}};
 const original=JSON.stringify(state);
 const result=summarizePaperState(state).robots[2];
 assert.equal(result.reconciliationDelta,-.0014);
 assert.equal(JSON.stringify(state),original);
});
