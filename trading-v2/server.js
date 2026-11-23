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
function getForwardStudy(){
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
    return {ok:true,...report,source:history.source,from:history.from,to:history.to,pages:history.pages};
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
  historicalPersistence:'memory_cache_only',...forwardStudy};
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
else if(path==='/api/walk-forward')data=getForwardStudy();
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
