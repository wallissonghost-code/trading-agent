import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateHeadlineImpact,summarizeHeadlineImpacts} from './news-impact.js';
const BAR=300000,start=1800000000000;
const candles=(count=40)=>Array.from({length:count},(_,i)=>({time:start+i*BAR,closeTime:start+(i+1)*BAR-1,open:100,close:100+i*.1}));
const news=(firstSeenAt)=>({source:'CoinDesk',url:'https://www.coindesk.com/markets/example',title:'Bitcoin update',publishedAt:new Date(start-600000).toISOString(),fetchedAt:new Date(firstSeenAt).toISOString(),firstSeenAt:new Date(firstSeenAt).toISOString(),relatedSymbols:['BTCUSDT'],category:'ASSET'});
test('one-hour study starts strictly after first observation and uses fully completed candle',()=>{
 const rows=candles();
 const item=news(start+BAR+80000);
 const x=evaluateHeadlineImpact(item,rows,{symbol:'BTCUSDT',now:start+40*BAR});
 assert.equal(x.status,'evaluated');
 assert.equal(x.baselineCandleOpenTime,start+2*BAR);
 assert.equal(x.outcomeCandleCloseTime,start+14*BAR-1);
 assert.equal(x.signalGenerated,false);
 assert.equal(x.causalAttribution,false);
 assert.equal(x.returnPct,1.3);
});
test('does not use a future candle or timestamp of publication to anticipate movement',()=>{
 const rows=candles();
 const n=news(start+BAR+80000);
 assert.equal(evaluateHeadlineImpact(n,rows,{symbol:'BTCUSDT',now:start+13*BAR}).status,'pending');
 const delayed={...n,firstSeenAt:new Date(start+50*BAR).toISOString()};
 assert.equal(evaluateHeadlineImpact(delayed,rows,{symbol:'BTCUSDT',now:start+50*BAR}).status,'outside_window');
});
test('ignores unrelated headlines, missing candles, and fabricates no performance claims',()=>{
 const rows=candles();
 assert.equal(evaluateHeadlineImpact(news(start+BAR),rows,{symbol:'ETHUSDT',now:start+40*BAR}).status,'unrelated');
 const hole=rows.filter((_,i)=>i!==8);
 assert.equal(evaluateHeadlineImpact(news(start+BAR),hole,{symbol:'BTCUSDT',now:start+40*BAR}).status,'invalid_history');
 const summary=summarizeHeadlineImpacts([]);
 assert.equal(summary.overall.averagePostObservationReturnPct,null);
 assert.equal(summary.overall.sufficientEvidence,false);
});
