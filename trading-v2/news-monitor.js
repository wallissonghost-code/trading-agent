// Read-only RSS headlines, not a classifier or trade signal.
// Fetches fixed official publisher feeds without third-party API keys.
const FEEDS=Object.freeze([
 {source:'CoinDesk',feed:'https://www.coindesk.com/arc/outboundfeeds/rss/',domain:'coindesk.com'},
 {source:'Cointelegraph',feed:'https://cointelegraph.com/rss',domain:'cointelegraph.com'},
 {source:'Federal Reserve',feed:'https://www.federalreserve.gov/feeds/press_monetary.xml',domain:'federalreserve.gov'}
]);
const decode=(text='')=>String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
 .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
 .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)))
 .replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
const tag=(block,name)=>{const pattern=new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i');return decode(block.match(pattern)?.[1]||'');};
export function parseHeadlines(xml,{source,domain,fetchedAt=new Date().toISOString()}){
 if(typeof xml!=='string'||xml.length>1500000||!xml.includes('<'))throw Error('Invalid RSS document');
 if(!['CoinDesk','Cointelegraph','Federal Reserve'].includes(source))throw Error('Unknown news publisher');
 const items=xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)||[];
 const records=[];
 for(const item of items.slice(0,30)){
  const title=tag(item,'title').slice(0,350),link=tag(item,'link');
  const date=tag(item,'pubDate')||tag(item,'published')||tag(item,'dc:date');
  if(!title||!link||!date)continue;
  let url;
  try{url=new URL(link);}catch{continue;}
  if(url.protocol!=='https:'||!(url.hostname===domain||url.hostname.endsWith('.'+domain)))continue;
  url.hash='';url.search='';
  const timestamp=Date.parse(date),now=Date.parse(fetchedAt);
  if(!Number.isFinite(timestamp)||!Number.isFinite(now)||timestamp>now+300000||timestamp<now-14*86400000)continue;
  const low=title.toLowerCase();
  const relatedSymbols=[];
  if(/\bbitcoin\b|\bbtc\b/i.test(low))relatedSymbols.push('BTCUSDT');
  if(/\bethereum\b|\bether\b|\beth\b/i.test(low))relatedSymbols.push('ETHUSDT');
  if(/\bsolana\b|\bsol\b/i.test(low))relatedSymbols.push('SOLUSDT');
  const macro=/\bfed\b|\bfomc\b|\binterest rate\b|\binflation\b|\bmonetary policy\b|\brate cut\b|\brate hike\b/i.test(low);
  const category=source==='Federal Reserve'||macro?'MACRO':relatedSymbols.length?'ASSET':'GENERAL_CRYPTO';
  if(category==='GENERAL_CRYPTO'&&source==='Federal Reserve')continue;
  records.push({source,url:url.toString(),title,publishedAt:new Date(timestamp).toISOString(),
   fetchedAt:new Date(now).toISOString(),relatedSymbols,category,tradeSignal:false});
 }
 return [...new Map(records.map(r=>[r.source+':'+r.url,r])).values()];
}
export async function fetchNewsHeadlines({fetchFn=fetch,now=()=>new Date().toISOString()}={}){
 const fetchedAt=now();
 const sources=await Promise.all(FEEDS.map(async config=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6500);
  try{
   const response=await fetchFn(config.feed,{signal:controller.signal,headers:{accept:'application/rss+xml, application/xml, text/xml'}});
   if(!response.ok)throw Error('Feed HTTP '+response.status);
   const type=response.headers?.get?.('content-type')||'';
   if(type&&/text\/html/i.test(type))throw Error('Not an RSS response');
   const body=await response.text();
   return {source:config.source,ok:true,items:parseHeadlines(body,{source:config.source,domain:config.domain,fetchedAt})};
  }catch(error){return {source:config.source,ok:false,error:'Fonte temporariamente indisponível',items:[]};}
  finally{clearTimeout(timer);}
 }));
 const unique=[...new Map(sources.flatMap(s=>s.items).map(x=>[x.source+':'+x.url,x])).values()];
 unique.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 return {sourceStatus:sources.map(({source,ok,error})=>({source,ok,error:error||null})),
  fetchedAt,news:unique.slice(0,45),mode:'NEWS_RESEARCH_ONLY',newsTradingEnabled:false};
}
