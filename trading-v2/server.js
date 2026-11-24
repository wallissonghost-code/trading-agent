import http from 'node:http';
import { analyze, generateMockCandles } from './engine.js';
import { SYMBOLS, getKlines } from './market.js';
import { createPaperRunner } from './paper.js';
import { createSupabaseStore } from './supabase-store.js';
import { performance } from './performance.js';
import { summarizeSignalOutcomes } from './signal-evaluation.js';
import { runStrategyLab } from './strategy-lab.js';
import { getMultiweekHistory } from './historical-market.js';
import { runWalkForward } from './walk-forward.js';
import { auditWalkForwardReports } from './research-audit.js';
import { fetchNewsHeadlines } from './news-monitor.js';
import { evaluateHeadlineImpact, summarizeHeadlineImpacts } from './news-impact.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const PORT = Number(process.env.PORT || 3000);
const ROOT = dirname(fileURLToPath(import.meta.url));
const boot = Date.now();
const remoteConfigured=Boolean(process.env.SUPABASE_URL&&(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY));
const paperStore=remoteConfigured?createSupabaseStore():null;
console.log('Paper storage selected:',remoteConfigured?'supabase':'local_ephemeral');
const paper=createPaperRunner({path:process.env.PAPER_STATE_PATH||'/tmp/trading-agent-paper.json',store:paperStore});
let paperInitError=null;
async function startPaper(){
 try{await paper.init();console.log('Paper storage initialized:',paper.status().persistence);await paper.runOnce();setInterval(()=>paper.runOnce().catch(err=>console.error('paper cycle error:',err.message)),60000).unref();}
 catch(err){paperInitError=String(err.message||err).slice(0,180);console.error('Paper runner halted:',paperInitError);}
}
void startPaper();
const agents = [
{id:'alpha',name:'ALPHA',symbol:'BTCUSDT',strategy:'EMA 9/21',simulatedPnl:0,status:'monitoring'},
{id:'nova',name:'NOVA',symbol:'ETHUSDT',strategy:'RSI + ATR',simulatedPnl:0,status:'monitoring'},
{id:'orion',name:'ORION',symbol:'SOLUSDT',strategy:'Trend Filter',simulatedPnl:0,status:'monitoring'}];
const prices={BTCUSDT:92000,ETHUSDT:3200,SOLUSDT:145};
const history=[];
let lastUpdate=new Date().toISOString(),step=0;
setInterval(()=>{
step++;
for(const agent of agents){
prices[agent.symbol]=Math.round(prices[agent.symbol]*(1+(Math.random()-.5)*.003)*100)/100;
agent.simulatedPnl=Math.round((agent.simulatedPnl+(Math.random()-.51)*9)*100)/100;
}
const agent=agents[step%agents.length];
history.unshift({agent:agent.name,symbol:agent.symbol,simulatedPnl:agent.simulatedPnl,time:new Date().toISOString(),source:'mock'});
history.splice(20);
lastUpdate=new Date().toISOString();
},3000).unref();
const payload=()=>{const pnl=Math.round(agents.reduce((s,a)=>s+a.simulatedPnl,0)*100)/100;return {ok:true,version:'2.0.0-preview',mode:'SIMULATION_ONLY',connectedToBinance:false,orderExecutionEnabled:false,dataSource:'synthetic',timestamp:lastUpdate,capital:10000+pnl,pnl,agents,prices,history}};
// Share one bounded, read-only study across viewers; avoid multiplying Binance requests.
let strategyLabCache=null,strategyLabPromise=null;
async function getStrategyLabReport(){
 if(strategyLabCache&&Date.now()-strategyLabCache.timestamp<300000)return strategyLabCache.value;
 if(strategyLabPromise)return strategyLabPromise;
 strategyLabPromise=(async()=>{
  const results=await Promise.all(SYMBOLS.map(async symbol=>{
   try{
    const market=await getKlines(symbol,{limit:500});
    return {ok:true,...runStrategyLab(market.candles,{symbol})};
   }catch(err){
    console.error('Strategy lab market error:',symbol,String(err.message||err).slice(0,110));
    return {ok:false,symbol,error:'Dados históricos temporariamente indisponíveis'};
   }
  }));
  const report={ok:results.every(r=>r.ok),mode:'RESEARCH_ONLY',
    autoPromotionEnabled:false,orderExecutionEnabled:false,newsTradingEnabled:false,
    generatedAt:new Date().toISOString(),results};
  if(report.ok)strategyLabCache={timestamp:Date.now(),value:report};
  return report;
 })();
 try{return await strategyLabPromise;}
 finally{strategyLabPromise=null;}
}
// Multiweek studies are low-priority, on-demand, cached, read-only jobs.
// Return immediately to mobile clients; data collection continues in the Node service.
let forwardStudy={status:'idle',generatedAt:null,startedAt:null,completed:0,total:SYMBOLS.length,results:[]};
let forwardStudyStartedAt=0;
let forwardRestoreAttempted=false;
async function getForwardStudy(){
 if(!forwardRestoreAttempted && paperStore?.listResearchReports){
  forwardRestoreAttempted=true;
  try{
   const saved=await paperStore.listResearchReports({limit:12});
   const latest=new Map();
   for(const row of saved){const item=row?.report;if(item?.ok && SYMBOLS.includes(item.symbol) && !latest.has(item.symbol))latest.set(item.symbol,item);}
   if(latest.size===SYMBOLS.length && saved[0]?.completed_at){
    const timestamp=Date.parse(saved[0].completed_at);
    if(Number.isFinite(timestamp)&&Date.now()-timestamp<30*60*1000){
     forwardStudyStartedAt=timestamp;
     forwardStudy={status:'ready',startedAt:saved[0].completed_at,generatedAt:saved[0].completed_at,
       completed:SYMBOLS.length,total:SYMBOLS.length,results:SYMBOLS.map(symbol=>latest.get(symbol))};
    }
   }
  }catch(err){console.error('Research restore unavailable:',String(err.message||err).slice(0,120));}
 }

 const stamp=Date.now();
 const age=stamp-forwardStudyStartedAt;
 const shouldStart=forwardStudy.status==='idle'||
  (forwardStudy.status==='ready'&&age>30*60*1000)||
  (forwardStudy.status==='error'&&age>5*60*1000);
 if(shouldStart){
  forwardStudyStartedAt=stamp;
  forwardStudy={status:'running',startedAt:new Date(stamp).toISOString(),generatedAt:null,
    completed:0,total:SYMBOLS.length,results:[]};
  void Promise.all(SYMBOLS.map(async symbol=>{
   try{
    const history=await getMultiweekHistory(symbol);
    const report=runWalkForward(history.candles,{symbol});
    const result={ok:true,...report,source:history.source,from:history.from,to:history.to,pages:history.pages,
       persisted:false};
    if(paperStore?.saveResearchReport){
      try{await paperStore.saveResearchReport(result);result.persisted=true;}
      catch(error){console.error('Research persistence failed:',symbol,String(error.message||error).slice(0,120));result.persistenceError=true;}
    }
    return result;
   }catch(e){
    console.error('Walk-forward historical study:',symbol,String(e.message||e).slice(0,140));
    return {ok:false,symbol,error:'Histórico completo indisponível ou com intervalo faltante'};
   }finally{
    forwardStudy.completed++;
   }
  })).then(results=>{
   forwardStudy={...forwardStudy,status:'ready',generatedAt:new Date().toISOString(),results};
  }).catch(error=>{
   console.error('Walk-forward study failed:',String(error.message||error).slice(0,120));
   forwardStudy={...forwardStudy,status:'error',error:'Falha ao processar pesquisa histórica'};
  });
 }
 return {ok:forwardStudy.status!=='error',mode:'RESEARCH_ONLY',
  autoPromotionEnabled:false,orderExecutionEnabled:false,newsTradingEnabled:false,
  historicalPersistence:forwardStudy.results.some(x=>x?.persisted)?'supabase_partial_or_full':'memory_only',...forwardStudy};
}
// News is observational, rate limited and never consulted by execution rules.
let newsCache={status:'idle',news:[],sourceStatus:[],persisted:false,fetchedAt:null};
let newsRefreshAt=0,newsPromise=null;
async function getNewsResearch(){
 if(newsPromise)return newsPromise;
 if(newsCache.status==='ready'&&Date.now()-newsRefreshAt<10*60*1000)return {
   ok:true,mode:'NEWS_RESEARCH_ONLY',newsTradingEnabled:false,...newsCache};
 newsPromise=(async()=>{
  try{
   const feed=await fetchNewsHeadlines();
   console.log('News feed audit:',JSON.stringify({items:feed.news.length,sources:feed.sourceStatus.map(({source,ok})=>({source,ok}))}));
   let news=feed.news,persisted=false;
   if(paperStore?.saveNews && news.length){
    try{await paperStore.saveNews(news);persisted=true;}
    catch(err){console.error('News archive write error:',String(err.message||err).slice(0,110));}
   }
   if(paperStore?.listNews){
    try{
     const saved=await paperStore.listNews({limit:30});
     if(saved.length)news=saved;
    }catch(err){console.error('News archive read unavailable:',String(err.message||err).slice(0,110));}
   }
   console.log('News archive audit:',JSON.stringify({headlines:news.length,persisted}));
   newsCache={status:'ready',news,sourceStatus:feed.sourceStatus,persisted,fetchedAt:feed.fetchedAt};
   newsRefreshAt=Date.now();
   return {ok:true,mode:'NEWS_RESEARCH_ONLY',newsTradingEnabled:false,...newsCache};
  }catch(err){
   console.error('News monitor error:',String(err.message||err).slice(0,110));
   return {ok:false,mode:'NEWS_RESEARCH_ONLY',newsTradingEnabled:false,
    news:newsCache.news,sourceStatus:newsCache.sourceStatus,error:'Não foi possível atualizar notícias'};
  }
 })();
 try{return await newsPromise;}
 finally{newsPromise=null;}
}
// Demand-driven, read-only outcome study. It never feeds paper trading decisions.
let impactState={status:'idle',completed:0,total:3,generatedAt:null,results:[],pending:0};
let impactLastRun=0,impactJob=null;
function getNewsImpactStatus(){
 if((impactState.status==='idle'||impactState.status==='ready'&&Date.now()-impactLastRun>20*60*1000||
     impactState.status==='error'&&Date.now()-impactLastRun>5*60*1000)&&!impactJob){
   impactLastRun=Date.now();
   impactState={status:'running',completed:0,total:3,generatedAt:null,results:[],pending:0};
   impactJob=(async()=>{
    const context=await getNewsResearch();
    const archived=paperStore?.listNews?await paperStore.listNews({limit:50}):context.news||[];
    const studies=await Promise.all(SYMBOLS.map(async symbol=>{
     try{
      const recent=await getKlines(symbol,{limit:1000});
      const selected=archived.filter(n=>n.relatedSymbols?.includes(symbol)||n.category==='MACRO');
      const results=selected.map(n=>evaluateHeadlineImpact(n,recent.candles,{symbol})).filter(x=>x.status==='evaluated');
      const pending=selected.filter(n=>{
       const seen=Date.parse(n.firstSeenAt||n.fetchedAt);
       return Number.isFinite(seen)&&Date.now()-seen<70*60000;
      }).length;
      if(results.length&&paperStore?.saveNewsOutcomes)await paperStore.saveNewsOutcomes(results);
      return {symbol,ok:true,evaluated:results.length,pending};
     }catch(error){
      console.error('News impact research failed:',symbol,String(error.message||error).slice(0,125));
      return {symbol,ok:false,evaluated:0,pending:0};
     }finally{impactState.completed++;}
    }));
    const recorded=paperStore?.listNewsOutcomes?await paperStore.listNewsOutcomes({limit:150}):[];
    impactState={status:'ready',completed:3,total:3,
      generatedAt:new Date().toISOString(),results:studies,pending:studies.reduce((n,r)=>n+r.pending,0),
      ...summarizeHeadlineImpacts(recorded),persistent:Boolean(paperStore?.listNewsOutcomes),
      newsSources:context.sourceStatus||[]};
   })().catch(error=>{
    console.error('News impact aggregation error:',String(error.message||error).slice(0,130));
    impactState={status:'error',completed:impactState.completed,total:3,
      error:'Falha ao validar resultados após a observação',results:[],pending:0};
   }).finally(()=>{impactJob=null;});
 }
 return {ok:impactState.status!=='error',mode:'NEWS_RESEARCH_ONLY',newsTradingEnabled:false,
  autoPromotionEnabled:false,orderExecutionEnabled:false,...impactState};
}
const server=http.createServer(async(req,res)=>{
const path=new URL(req.url||'/', 'http://localhost').pathname;
if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'allow':'GET, HEAD'});return res.end();}
const robotAssetNames=new Set(['alpha.jpg','nova.jpg','orion.jpg','alpha-portrait.jpg','nova-portrait.jpg','orion-portrait.jpg']);
if(path.startsWith('/assets/')){
 const filename=path.slice('/assets/'.length);
 if(!robotAssetNames.has(filename)){res.writeHead(404);return res.end('Not found');}
 try{
  const image=await readFile(join(ROOT,'assets',filename));
  res.writeHead(200,{'content-type':'image/jpeg','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'});
  return res.end(req.method==='HEAD'?undefined:image);
 }catch{res.writeHead(404);return res.end('Asset missing');}
}
if(path==='/'||path==='/index.html'){
try{const html=await readFile(join(ROOT,'index.html'));res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'});return res.end(req.method==='HEAD'?undefined:html);}
catch{res.writeHead(500);return res.end('Preview unavailable');}}
let data;
if(path==='/health')data={ok:true,name:'trading-agent',mode:'SIMULATION_ONLY',uptimeSeconds:Math.floor((Date.now()-boot)/1000)};
else if(path==='/api/status')data=payload();
else if(path==='/api/agents')data={ok:true,simulated:true,agents};
else if(path==='/api/market')data={ok:true,dataSource:'synthetic',prices};
else if(path==='/api/paper')data={ok:paperInitError===null, ...paper.status(),error:paperInitError};
else if(path==='/api/performance'){
  try{
    const recent=paperStore?.listTrades?await paperStore.listTrades({limit:100}):paper.status().trades||[];
    const summary=performance(recent,paper.status().startingCash||10000);
    data={ok:true,...summary,partialHistory:recent.length===100,historyLimit:100};
  }catch(err){data={ok:false,error:'Estatísticas indisponíveis',mode:'PAPER_ONLY'};console.error('Performance read error:',String(err.message||err).slice(0,130));}
}
else if(path==='/api/research-audit'){
  try{
    const rows=paperStore?.listResearchReports?await paperStore.listResearchReports({limit:15}):[];
    data={ok:true,...auditWalkForwardReports(rows)};
  }catch(error){
    console.error('Research audit query failed:',String(error.message||error).slice(0,140));
    data={ok:false,mode:'RESEARCH_AUDIT',error:'Auditoria temporariamente indisponível',approved:0};
  }
}
else if(path==='/api/walk-forward')data=await getForwardStudy();
else if(path==='/api/news-research')data=await getNewsResearch();
else if(path==='/api/news-impact')data=getNewsImpactStatus();
else if(path==='/api/strategy-lab'){
  data=await getStrategyLabReport();
}
else if(path==='/api/signal-evaluation'){
  try{
    const latest=paperStore?.listSignalOutcomes?await paperStore.listSignalOutcomes({limit:250}):[];
    data={ok:true,...summarizeSignalOutcomes(latest),source:paperStore?'supabase':'unavailable',sampleLimit:250,partialHistory:latest.length===250};
  }catch(err){data={ok:false,error:'Avaliação de sinais indisponível',mode:'OBSERVATION_ONLY'};console.error('Signal evaluation read failed:',String(err.message||err).slice(0,120));}
}
else if(path==='/api/decisions'){
  try{
    const items=paperStore?.listDecisions?await paperStore.listDecisions({limit:30}):[];
    data={ok:true,mode:'PAPER_ONLY',source:paperStore?.listDecisions?'supabase':'not_configured',decisions:items,learningEnabled:false,newsTradingEnabled:false};
  }catch(err){data={ok:false,decisions:[],error:'Diário de decisões indisponível'};console.error('Decision journal read failed:',String(err.message||err).slice(0,120));}
}
else if(path==='/api/trade-history'){
  try{
    const recent=paperStore?.listTrades?await paperStore.listTrades({limit:50}):paper.status().trades||[];
    data={ok:true,mode:'PAPER_ONLY',persistent:Boolean(paperStore?.listTrades),trades:recent};
  }catch(err){data={ok:false,mode:'PAPER_ONLY',trades:[],error:'Não foi possível consultar o histórico permanente'};console.error('Paper ledger read failed:',String(err.message||err).slice(0,130));}
}
else if(path==='/api/analysis')data={ok:true,mode:'SIMULATION_ONLY',dataSource:'synthetic',reports:agents.map(a=>({agent:a.name,symbol:a.symbol,...analyze(generateMockCandles(prices[a.symbol]),10000)}))};
else if(path==='/api/market-live'||path==='/api/analysis-live'){
  const results=await Promise.all(SYMBOLS.map(async(symbol)=>{
    try{
      const result=await getKlines(symbol);
      const latest=result.candles.at(-1);
      const item={ok:true,symbol,price:latest.close,lastClosedAt:result.lastClosedAt,dataSource:result.dataSource,cached:result.cached,interval:result.interval};
      return path==='/api/analysis-live'?{...item,analysis:analyze(result.candles,10000)}:item;
    }catch(e){return {ok:false,symbol,error:String(e.message||e).slice(0,120)};}
  }));
  data={ok:results.every(r=>r.ok),mode:'READ_ONLY',orderExecutionEnabled:false,dataSource:'binance_public_spot',retrievedAt:new Date().toISOString(),results};
}
else{res.writeHead(404);return res.end('Not found');}
res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
res.end(req.method==='HEAD'?undefined:JSON.stringify(data));
});
server.listen(PORT,'0.0.0.0',()=>console.log('trading-agent preview on '+PORT));
// Best effort collection while a free-tier service is awake; Render can suspend idle instances.
// Read-only research cannot change the paper runner or execute exchange orders.
setTimeout(()=>getNewsResearch().catch(err=>console.error('Scheduled news collection:',err.message)),30000).unref();
setTimeout(()=>void getForwardStudy().catch(err=>console.error('Scheduled walk-forward research:',err.message)),25000).unref();
setInterval(()=>void getForwardStudy().catch(err=>console.error('Scheduled walk-forward research:',err.message)),4*60*60*1000).unref();
setInterval(()=>{
 void getNewsResearch().catch(err=>console.error('Scheduled news collection:',err.message));
 getNewsImpactStatus();
},20*60*1000).unref();
