import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePaperAgents,AGENT_STATES} from './agent-diagnostics.js';
const now=Date.parse('2026-11-24T12:00:00Z');
const base=()=>({ready:true,dataSource:'binance_public_spot',lastCandle:{BTCUSDT:now-60000,ETHUSDT:now-60000,SOLUSDT:now-60000},
 lastDecisions:Object.fromEntries(['BTCUSDT','ETHUSDT','SOLUSDT'].map(symbol=>[symbol,{symbol,observedAt:new Date(now-50000).toISOString(),reason:'NO_NEW_ENTRY',action:'WAIT'}])),
 lastError:{},positions:[],agentPnl:{}});
const state=(paper,symbol='ETHUSDT',config={})=>summarizePaperAgents(paper,{now,...config}).agents.find(a=>a.symbol===symbol);
test('healthy no-signal does not impersonate an error or executed order',()=>{
 const v=state(base());assert.equal(v.state,'AGUARDANDO_SINAL');assert.equal(v.positionOpen,false);assert.equal(v.simulated,true);
});
test('paper position is shown as simulated operation, not exchange execution',()=>{
 const p=base();p.positions=[{symbol:'ETHUSDT',entry:3500}];
 assert.equal(state(p).state,'OPERANDO');assert.equal(summarizePaperAgents(p,{now}).realOrdersEnabled,false);
});
test('old candle is stale even if the last decision looks healthy',()=>{
 const p=base();p.lastCandle.ETHUSDT=now-3600000;
 assert.equal(state(p).state,'COLETA_ATRASADA');
});
test('source collection errors take priority over an open position',()=>{
 const p=base();p.positions=[{symbol:'ETHUSDT'}];p.lastError.ETHUSDT='timeout';
 const x=state(p);assert.equal(x.state,'ERRO');assert.equal(x.errorPresent,true);assert.doesNotMatch(x.reason,/timeout/);
});
test('lack of decision or observation is not mistaken for no signal',()=>{
 const p=base();delete p.lastCandle.ETHUSDT;delete p.lastDecisions.ETHUSDT;
 assert.equal(state(p).state,'SEM_DADOS');
});
test('storage failure is an error and paused flag overrides it',()=>{
 const p=base();p.storageError='unsafe filesystem path';
 assert.equal(state(p).state,'ERRO');assert.equal(state(p,'ETHUSDT',{pausedSymbols:['ETHUSDT']}).state,'PAUSADO');
});
test('pnl is never fabricated when unavailable',()=>{
 const p=base(),x=state(p);assert.equal(x.realizedPnl,null);assert.equal(x.unrealizedPnl,null);
});
test('supports all symbols with stable identifiers and finite timestamps',()=>{
 const list=summarizePaperAgents(base(),{now}).agents;
 assert.deepEqual(list.map(x=>x.name),['ALPHA','NOVA','ORION']);
 assert.ok(list.every(x=>AGENT_STATES.includes(x.state)&&x.lastCandleCloseAt?.endsWith('Z')));
});


test('aggregate health turns stale when any agent stops receiving candles',()=>{
 const p=base();p.lastCandle.ETHUSDT=now-60*60000;
 const report=summarizePaperAgents(p,{now});
 assert.equal(report.collectionHealth,'STALE');
 assert.equal(report.allCurrent,false);
 assert.ok(report.lastCandleCloseAt?.endsWith('Z'));
 assert.equal(report.realOrdersEnabled,false);
});
test('aggregate health is current only when all three agents are fresh',()=>{
 const report=summarizePaperAgents(base(),{now});
 assert.equal(report.collectionHealth,'CURRENT');
 assert.equal(report.allCurrent,true);
});
test('aggregate health does not mistake missing observations for healthy trading',()=>{
 const p=base();delete p.lastCandle.BTCUSDT;
 assert.equal(summarizePaperAgents(p,{now}).collectionHealth,'INSUFFICIENT_DATA');
 p.lastError.ETHUSDT='timeout';
 assert.equal(summarizePaperAgents(p,{now}).collectionHealth,'ERROR');
});


test('persisted gap quarantine is distinct from ordinary trading and survives into diagnostics',()=>{
 const p=base();
 p.positions=[{symbol:'BTCUSDT',entry:100}];
 p.dataGaps={BTCUSDT:{missedCandles:9,detectedAt:new Date(now-20000).toISOString(),
   previousCandleCloseTime:now-3100000,resumedCandleCloseTime:now-60000}};
 p.gapLocks={BTCUSDT:true};
 const report=summarizePaperAgents(p,{now});
 const btc=report.agents[0];
 assert.equal(btc.state,'LACUNA_HISTORICA');
 assert.equal(btc.gapLocked,true);
 assert.equal(btc.lastGap.missedCandles,9);
 assert.equal(report.collectionHealth,'GAP_LOCK');
 assert.equal(report.allCurrent,false);
 assert.equal(report.realOrdersEnabled,false);
});
test('stale feed still shows a historical gap quarantine, not a healthy status',()=>{
 const p=base();
 p.lastCandle.SOLUSDT=now-3600000;
 p.gapLocks={SOLUSDT:true};
 const report=summarizePaperAgents(p,{now});
 assert.equal(report.collectionHealth,'STALE');
 assert.equal(report.agents[2].state,'COLETA_ATRASADA');
 assert.equal(report.agents[2].gapLocked,true);
});
