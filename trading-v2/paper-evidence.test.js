import test from 'node:test';import assert from 'node:assert/strict';
import {summarizePaperEvidence} from './paper-evidence.js';
const NOW=1800000000000;
const last=NOW-5*60*1000;
const symbols=['BTCUSDT','ETHUSDT','SOLUSDT'];
const paper=()=>({ready:true,persistence:'supabase',positions:[],trades:[],
 lastCandle:Object.fromEntries(symbols.map(s=>[s,last])),
 lastError:{},gapLocks:{},dataGaps:{}});
const timeline=()=>({ok:true,bySymbol:Object.fromEntries(symbols.map(s=>[s,{recorded:288}]))});
const coverage=()=>({ok:true,bySymbol:Object.fromEntries(symbols.map(s=>[s,{recordedSlots:72}]))});
test('perfect shadow research coverage cannot authorize paper or live trading',()=>{
 const r=summarizePaperEvidence({paper:paper(),timeline:timeline(),coverage:coverage(),now:NOW});
 assert.equal(r.results[0].shadowCoverage24hPct,100);
 assert.equal(r.results[0].shadowCoverage6hPct,100);
 assert.equal(r.results[0].readyForLiveTrading,false);
 assert.equal(r.decision,'MORE_OBSERVATIONS_REQUIRED');
 assert.ok(r.results[0].reasons.includes('PAPER_CANDLE_JOURNAL_7D_UNAVAILABLE'));
 assert.equal(r.realOrdersEnabled,false);
 assert.equal(r.noAutoHostingUpgrade,true);
});
test('missing shadow 5m observations are unknown, never labelled proven service outages',()=>{
 const t=timeline();t.bySymbol.BTCUSDT.recorded=144;
 const c=coverage();c.bySymbol.BTCUSDT.recordedSlots=36;
 const r=summarizePaperEvidence({paper:paper(),timeline:t,coverage:c,now:NOW});
 assert.equal(r.results[0].shadowCoverage24hPct,50);
 assert.equal(r.results[0].shadowCoverage6hPct,50);
 assert.ok(r.results[0].reasons.includes('UNOBSERVED_SHADOW_24H_SLOTS'));
 assert.match(r.note,/não comprova queda/);
});
test('paper gaps, stale candles and missing persistent storage remain independently visible',()=>{
 const p=paper();p.persistence='local_ephemeral';
 p.gapLocks.BTCUSDT=true;p.dataGaps.BTCUSDT={missedCandles:4};
 p.lastCandle.ETHUSDT=NOW-45*60*1000;
 p.lastError.SOLUSDT='Feed unavailable';
 const r=summarizePaperEvidence({paper:p,timeline:timeline(),coverage:coverage(),now:NOW});
 assert.equal(r.results[0].paperGapLocked,true);
 assert.equal(r.results[0].latestKnownGapCandles,4);
 assert.ok(r.results[0].reasons.includes('PAPER_PERSISTENCE_NOT_CONFIRMED'));
 assert.ok(r.results[1].reasons.includes('LATEST_PAPER_CANDLE_STALE_OR_MISSING'));
 assert.ok(r.results[2].reasons.includes('PAPER_MARKET_ERROR'));
});
test('missing/partial independent feeds cannot be counted as zero reliable paper observations',()=>{
 const r=summarizePaperEvidence({paper:paper(),timeline:null,coverage:{ok:false},now:NOW});
 assert.equal(r.results[0].shadowObserved24hSlots,null);
 assert.equal(r.results[0].shadowCoverage6hPct,null);
 assert.ok(r.results[0].reasons.includes('SHADOW_COVERAGE_UNAVAILABLE'));
 const t=timeline();t.observationHistoryPartial=true;
 const r2=summarizePaperEvidence({paper:paper(),timeline:t,coverage:coverage(),now:NOW});
 assert.ok(r2.results[0].reasons.includes('SHADOW_HISTORY_QUERY_PARTIAL'));
});
test('recent paper trades are a capped sample, never a 7d verified backtest',()=>{
 const p=paper();p.trades=Array.from({length:30},(_,i)=>({symbol:i%2?'ETHUSDT':'BTCUSDT',simulated:true}));
 const r=summarizePaperEvidence({paper:p,timeline:timeline(),coverage:coverage(),now:NOW});
 assert.equal(r.samplePartial,true);
 assert.equal(r.results[0].recentPaperTradeRecords,15);
 assert.equal(r.results[1].recentPaperTradeRecords,15);
 assert.equal(r.results[0].readyForLiveTrading,false);
});
test('paper evidence summary is pure and never changes any persisted account state',()=>{
 const p=paper(),t=timeline(),c=coverage();
 const before=structuredClone({p,t,c});
 summarizePaperEvidence({paper:p,timeline:t,coverage:c,now:NOW});
 assert.deepEqual({p,t,c},before);
});
