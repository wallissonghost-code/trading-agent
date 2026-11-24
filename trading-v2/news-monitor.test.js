import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHeadlines,fetchNewsHeadlines} from './news-monitor.js';
const day='2026-11-23T21:00:00Z';
const item=(title,url,date='Mon, 23 Nov 2026 20:00:00 GMT')=>'<item><title><![CDATA['+title+']]></title><link>'+url.replace(/&/g,'&amp;')+'</link><pubDate>'+date+'</pubDate></item>';
test('RSS headlines have publisher, UTC timestamp and named asset relevance, without a trade signal',()=>{
 const xml='<rss><channel>'+item('Bitcoin and Ethereum rise','https://www.coindesk.com/markets/story/')+'</channel></rss>';
 const r=parseHeadlines(xml,{source:'CoinDesk',domain:'coindesk.com',fetchedAt:day});
 assert.equal(r.length,1);assert.deepEqual(r[0].relatedSymbols,['BTCUSDT','ETHUSDT']);
 assert.equal(r[0].tradeSignal,false);
 assert.equal(r[0].publishedAt,'2026-11-23T20:00:00.000Z');
});
test('rejects impersonated publishers, missing timestamps and future announcements',()=>{
 const xml='<rss><channel>'+item('Bitcoin','https://coindesk.com.attacker.example/fake')+
 item('Ethereum','https://www.coindesk.com/future','Tue, 24 Nov 2026 20:00:00 GMT')+
 item('Solana','http://www.coindesk.com/unsafe')+'</channel></rss>';
 assert.equal(parseHeadlines(xml,{source:'CoinDesk',domain:'coindesk.com',fetchedAt:day}).length,0);
});
test('partial feed failures do not fabricate news and leave execution disabled',async()=>{
 const response=await fetchNewsHeadlines({now:()=>day,fetchFn:async url=>{
  if(url.includes('cointelegraph'))throw Error('offline');
  return {ok:true,headers:{get:()=> 'application/rss+xml'},text:async()=>'<rss><channel>'+item('Fed monetary policy','https://www.federalreserve.gov/newsevents/pressreleases/test.htm')+'</channel></rss>'};
 }});
 assert.equal(response.sourceStatus.length,3);
 assert.equal(response.newsTradingEnabled,false);
 assert.ok(response.sourceStatus.some(x=>!x.ok));
 assert.ok(response.news.every(x=>x.tradeSignal===false));
});
