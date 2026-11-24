import http from 'node:http';
import { analyze, generateMockCandles } from './engine.js';
import { SYMBOLS, getKlines } from './market.js';
import { createPaperRunner } from './paper.js';
import { summarizePaperAgents } from './agent-diagnostics.js';
import { summarizeGapReconciliation } from './gap-reconciliation.js';
import { buildGapReviewPlan } from './gap-review-plan.js';
import { authorizeReviewRequest } from './admin-access.js';
import { createSupabaseStore } from './supabase-store.js';
import { performance } from './performance.js';
import { summarizeSignalOutcomes } from './signal-evaluation.js';
import { runStrategyLab } from './strategy-lab.js';
import { getMultiweekHistory } from './historical-market.js';
import { runWalkForward } from './walk-forward.js';
import { diagnoseStrategyLosses } from './loss-diagnostics.js';
import { compareCooldowns } from './cooldown-research.js';
import { compareEntryFilters } from './entry-filter-research.js';
import { buildForwardObservation, summarizeForwardStudy, verifyFrozenForwardConfig, buildShadowObservation, verifyShadowStudy, summarizeShadowTrades } from './forward-study.js';
import { summarizeMonitoring } from './monitor-health.js';
import { reviewShadowStops } from './stop-review.js';
import { comparePreSignalHypotheses } from './hypothesis-screen.js';
import { buildScreenObservation, verifyScreenStudy, summarizeScreenStudy } from './prospective-screens.js';
import { explainResearchRisk } from './research-risk.js';
import { summarizeObservedCoverage, buildObservedTimeline } from './monitor-coverage.js';
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
   for(const row of saved){const item=row?.report;if(item?.ok && item.lossDiagnostics?.candidates?.length===3 && item.cooldownResearch?.candidates?.length===3 && item.entryFilterResearch?.scenarios?.length===4 && SYMBOLS.includes(item.symbol) && !latest.has(item.symbol))latest.set(item.symbol,item);}
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
    const lossDiagnostics=diagnoseStrategyLosses(history.candles,{symbol});
    const cooldownResearch=compareCooldowns(history.candles,{symbol});
    const entryFilterResearch=compareEntryFilters(history.candles,{symbol});
    const result={ok:true,...report,lossDiagnostics,cooldownResearch,entryFilterResearch,source:history.source,from:history.from,to:history.to,pages:history.pages,
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
// Frozen prospective research: one latest closed candle per market, collected ONLY after
// the freeze timestamp. DB scores a signal only from its first full future candle.
// Never call the paper execution engine or Binance order endpoints from this worker.
let forwardConfig=null,shadowConfig=null,screenConfig=null,forwardCollectionPromise=null,forwardLastRun=0;
let forwardCaptureState={lastCheckedAt:null,newObservations:0,sources:[],error:null};
async function runForwardCapture(){
 if(!paperStore?.getFrozenForwardStudy||!paperStore?.insertForwardObservation)
  return {ok:false,reason:'Private prospective archive not configured'};
 if(forwardCollectionPromise)return forwardCollectionPromise;
 if(Date.now()-forwardLastRun<60000)return {ok:true,cached:true};
 forwardLastRun=Date.now();
 forwardCollectionPromise=(async()=>{
  if(!forwardConfig){
   const frozen=await paperStore.getFrozenForwardStudy();
   verifyFrozenForwardConfig(frozen);
   forwardConfig=frozen;
  }
  if(!shadowConfig&&paperStore?.getFrozenShadowStudy){
   const frozen=await paperStore.getFrozenShadowStudy();
   verifyShadowStudy(frozen);
   shadowConfig=frozen;
  }
  if(!screenConfig&&paperStore?.getFrozenScreenStudy){
   const frozen=await paperStore.getFrozenScreenStudy();
   verifyScreenStudy(frozen);
   screenConfig=frozen;
  }
  const captured=await Promise.all(SYMBOLS.map(async symbol=>{
   try{
    const market=await getKlines(symbol,{limit:100});
    const snapshot=buildForwardObservation(market.candles,{symbol,studyStartedAt:forwardConfig.started_at});
    if(snapshot.status!=='ready')return {symbol,status:snapshot.status};
    const inserted=await paperStore.insertForwardObservation(snapshot);
    let shadowStatus='not_configured';
    if(shadowConfig&&paperStore?.insertShadowObservation){
     const parallel=buildShadowObservation(market.candles,{symbol,studyStartedAt:shadowConfig.started_at});
     if(parallel.status==='ready'){
       const stored=await paperStore.insertShadowObservation(parallel);
       shadowStatus=stored?'recorded':'already_recorded';
     }else shadowStatus=parallel.status;
    }
    let screenStatus='not_configured';
    if(screenConfig&&paperStore?.insertScreenObservation){
     // New experiment is independent: failure never rewrites the existing studies.
     try{
      const candidate=buildScreenObservation(market.candles,{symbol,
       studyStartedAt:screenConfig.started_at});
      if(candidate.status==='ready'){
       const added=await paperStore.insertScreenObservation(candidate);
       screenStatus=added?'recorded':'already_recorded';
      }else screenStatus=candidate.status;
     }catch(error){
      screenStatus='error';
      console.error('Prospective screen collection:',symbol,
       String(error.message||error).slice(0,140));
     }
    }
    return {symbol,status:inserted?'recorded':'already_recorded',shadowStatus,screenStatus};
   }catch(err){
    console.error('Prospective study:',symbol,String(err.message||err).slice(0,150));
    return {symbol,status:'error'};
   }
  }));
  forwardCaptureState={lastCheckedAt:new Date().toISOString(),newObservations:captured.filter(x=>x.status==='recorded').length,
   sources:captured,error:null};
  return {ok:captured.some(x=>x.status!=='error'),sources:captured};
 })();
 try{return await forwardCollectionPromise;}
 catch(error){
  forwardCaptureState={...forwardCaptureState,error:'A coleta prospectiva não está disponível'};
  console.error('Forward study setup failed:',String(error.message||error).slice(0,130));
  return {ok:false,reason:'Cannot initialize frozen study'};
 }finally{forwardCollectionPromise=null;}
}
async function getForwardSnapshot(){
 if(!paperStore?.getFrozenForwardStudy||!paperStore?.listForwardOutcomes)
  return {ok:false,mode:'PROSPECTIVE_OBSERVATION',error:'Supabase não configurado'};
 // Initiate collection but don't block mobile clients on the public market feeds.
 void runForwardCapture();
 try{
  if(!forwardConfig){
   const frozen=await paperStore.getFrozenForwardStudy();
   verifyFrozenForwardConfig(frozen);
   forwardConfig=frozen;
  }
  const [observations,outcomes]=await Promise.all([
   paperStore.listForwardObservations({limit:360}),
   paperStore.listForwardOutcomes({limit:900})
  ]);
  return {ok:true,...summarizeForwardStudy({study:forwardConfig,observations,outcomes}),
   collected:forwardCaptureState,latestObservationsPartial:observations.length===360,
   latestOutcomesPartial:outcomes.length===900,source:'supabase'};
 }catch(error){
  console.error('Prospective read failed:',String(error.message||error).slice(0,140));
  return {ok:false,mode:'PROSPECTIVE_OBSERVATION',error:'Estudo futuro temporariamente indisponível',
   autoPromotionEnabled:false,realOrdersEnabled:false};
 }
}
// Persist meaningful research-health transitions, not missing-trade counts.
// The free Render process cannot report incidents while the process is sleeping.
let monitoringSyncPromise=null;
async function syncMonitoringIncidents(){
 if(!paperStore?.recordMonitoringTransitions||!paperStore?.listShadowObservations)
  return {ok:false,reason:'Persistence unavailable'};
 if(monitoringSyncPromise)return monitoringSyncPromise;
 monitoringSyncPromise=(async()=>{
  const observations=await paperStore.listShadowObservations({limit:360});
  const summary=summarizeMonitoring({observations,capture:forwardCaptureState,
   serviceStartedAt:new Date(boot).toISOString()});
  return paperStore.recordMonitoringTransitions(summary.symbols);
 })();
 try{return await monitoringSyncPromise;}
 catch(err){
  console.error('Monitoring incident persistence:',String(err.message||err).slice(0,160));
  return {ok:false,error:'Monitor incidents write unavailable'};
 }finally{monitoringSyncPromise=null;}
}
// Informational signal diagnostics; not connected to the paper engine.
let researchRiskCache=null,researchRiskUntil=0,researchRiskPromise=null;
async function getResearchRiskDiagnostics(){
 if(researchRiskCache&&Date.now()<researchRiskUntil)return researchRiskCache;
 if(researchRiskPromise)return researchRiskPromise;
 researchRiskPromise=(async()=>{
  const results=await Promise.all(SYMBOLS.map(async symbol=>{
   try{
    const data=await getKlines(symbol,{limit:110});
    return {ok:true,...explainResearchRisk(data.candles,{symbol})};
   }catch(error){
    console.error('Risk diagnostics:',symbol,String(error.message||error).slice(0,120));
    return {ok:false,symbol,error:'Indicadores indisponíveis',dataFresh:false};
   }
  }));
  const report={ok:true,mode:'EXPLANATORY_RESEARCH_ONLY',generatedAt:new Date().toISOString(),
   results,successfulMarkets:results.filter(x=>x.ok).length,
   realOrdersEnabled:false,autoPromotionEnabled:false,
   notice:'Indicators are descriptive, not trading approvals. Frozen studies and paper portfolio are unchanged.'};
  researchRiskCache=report;researchRiskUntil=Date.now()+60000;
  return report;
 })();
 try{return await researchRiskPromise;}finally{researchRiskPromise=null;}
}
async function getMonitoringTimeline(){
 if(!paperStore?.listTimelineObservations||!paperStore?.listMonitoringEvents)
  return {ok:false,mode:'OBSERVED_24H_TIMELINE',error:'Linha do tempo não configurada'};
 try{
  const now=Date.now(),lastClose=Math.floor(now/300000)*300000-1;
  const start=lastClose-24*60*60*1000+300000;
  const [observations,events]=await Promise.all([
   paperStore.listTimelineObservations({since:start,limit:1000}),
   paperStore.listMonitoringEvents({limit:100})
  ]);
  return buildObservedTimeline({observations,events,now,
   partial:observations.length>=1000});
 }catch(error){
  console.error('Timeline query failed:',String(error.message||error).slice(0,140));
  return {ok:false,mode:'OBSERVED_24H_TIMELINE',
   error:'Linha do tempo de observações indisponível',
   orderExecutionEnabled:false};
 }
}
async function getMonitoringCoverage(){
 if(!paperStore?.listShadowObservations||!paperStore?.listMonitoringEvents||!paperStore?.listMonitoringStates)
  return {ok:false,mode:'OBSERVED_CANDLE_COVERAGE',error:'Resumo de coleta não configurado'};
 try{
  const [observations,events,states]=await Promise.all([
   paperStore.listShadowObservations({limit:360}),
   paperStore.listMonitoringEvents({limit:100}),
   paperStore.listMonitoringStates()
  ]);
  return summarizeObservedCoverage({observations,events,states,now:Date.now(),
   partial:observations.length===360});
 }catch(error){
  console.error('Observed coverage report unavailable:',String(error.message||error).slice(0,130));
  return {ok:false,mode:'OBSERVED_CANDLE_COVERAGE',
   error:'Resumo de disponibilidade observada temporariamente indisponível',
   orderExecutionEnabled:false};
 }
}
async function getMonitoringAlerts(){
 if(!paperStore?.listMonitoringEvents||!paperStore?.listMonitoringStates)
  return {ok:false,error:'Histórico de incidentes não configurado',mode:'READ_ONLY_RESEARCH_ALERTS'};
 try{
  const [events,states]=await Promise.all([
   paperStore.listMonitoringEvents({limit:45}),
   paperStore.listMonitoringStates()
  ]);
  return {ok:true,mode:'READ_ONLY_RESEARCH_ALERTS',events,states,
   scope:'COLLECTOR_WHILE_SERVICE_AWAKE',
   caveat:'O servidor gratuito não identifica o instante exato de quedas ocorridas enquanto está suspenso. Eventos são registrados na próxima checagem disponível.',
   orderExecutionEnabled:false,autoPromotionEnabled:false};
 }catch(err){
  console.error('Monitoring event history unavailable:',String(err.message||err).slice(0,160));
  return {ok:false,mode:'READ_ONLY_RESEARCH_ALERTS',error:'Histórico de incidentes temporariamente indisponível'};
 }
}
async function getMonitoringHealth(){
 if(!paperStore?.listShadowObservations)
  return {ok:false,error:'Monitoramento de pesquisa não configurado',mode:'READ_ONLY_RESEARCH_HEALTH'};
 try{
  const observations=await paperStore.listShadowObservations({limit:360});
  return summarizeMonitoring({observations,capture:forwardCaptureState,serviceStartedAt:new Date(boot).toISOString()});
 }catch(err){
  console.error('Research health query failed:',String(err.message||err).slice(0,140));
  return {ok:false,mode:'READ_ONLY_RESEARCH_HEALTH',status:'ERROR',
   error:'Falha ao consultar última coleta',orderExecutionEnabled:false};
 }
}
async function getProspectiveScreenReport(){
 if(!paperStore?.getFrozenScreenStudy||!paperStore?.listScreenObservations||!paperStore?.listScreenOutcomes)
  return {ok:false,mode:'FROZEN_PROSPECTIVE_NEXT_BAR',error:'Estudo prospectivo não configurado'};
 void runForwardCapture();
 try{
  if(!screenConfig){
   const frozen=await paperStore.getFrozenScreenStudy();verifyScreenStudy(frozen);screenConfig=frozen;
  }
  const [observations,outcomes]=await Promise.all([
   paperStore.listScreenObservations({limit:600}),paperStore.listScreenOutcomes({limit:900})
  ]);
  return {...summarizeScreenStudy({study:screenConfig,observations,outcomes}),
   partialObservations:observations.length>=600,partialOutcomes:outcomes.length>=900};
 }catch(error){
  console.error('Screen prospective report unavailable:',String(error.message||error).slice(0,130));
  return {ok:false,mode:'FROZEN_PROSPECTIVE_NEXT_BAR',
   error:'Validação prospectiva temporariamente indisponível',
   realOrdersEnabled:false,autoPromotionEnabled:false};
 }
}
async function getHypothesisReport(){
 if(!paperStore?.listShadowTrades||!paperStore?.listStopReviewObservations)
  return {ok:false,mode:'EXPLORATORY_PRE_SIGNAL_SCREENS',error:'Pesquisa privada indisponível'};
 try{
  const [trades,observations]=await Promise.all([
   paperStore.listShadowTrades({limit:500}),
   paperStore.listStopReviewObservations({limit:600})
  ]);
  return comparePreSignalHypotheses({trades,observations,
   partialTrades:trades.length>=500,partialObservations:observations.length>=600});
 }catch(error){
  console.error('Exploratory screen report unavailable:',String(error.message||error).slice(0,130));
  return {ok:false,mode:'EXPLORATORY_PRE_SIGNAL_SCREENS',
   error:'Estudo exploratório temporariamente indisponível',
   realOrdersEnabled:false,autoPromotionEnabled:false};
 }
}
async function getStopReviewReport(){
 if(!paperStore?.listShadowTrades||!paperStore?.listStopReviewObservations)
  return {ok:false,mode:'FROZEN_SHADOW_STOP_AUDIT',error:'Pesquisa privada indisponível'};
 try{
  const [trades,observations]=await Promise.all([
   paperStore.listShadowTrades({limit:500}),
   paperStore.listStopReviewObservations({limit:600})
  ]);
  return reviewShadowStops({trades,observations,
   partialTrades:trades.length>=500,partialObservations:observations.length>=600});
 }catch(error){
  console.error('Shadow stop audit unavailable:',String(error.message||error).slice(0,130));
  return {ok:false,mode:'FROZEN_SHADOW_STOP_AUDIT',
   error:'Auditoria de perdas temporariamente indisponível',
   realOrdersEnabled:false,autoPromotionEnabled:false};
 }
}
async function getShadowTradeReport(){
 if(!paperStore?.getFrozenShadowStudy||!paperStore?.listShadowTrades)
  return {ok:false,mode:'FROZEN_PROSPECTIVE_SHADOW_TRADES',error:'Supabase não configurado'};
 // Collect recent public candles without blocking requests for a report.
 void runForwardCapture();
 try{
  if(!shadowConfig){
   const frozen=await paperStore.getFrozenShadowStudy();
   verifyShadowStudy(frozen);
   shadowConfig=frozen;
  }
  const [trades,observations]=await Promise.all([
   paperStore.listShadowTrades({limit:500}),
   paperStore.listShadowObservations({limit:360})
  ]);
  return summarizeShadowTrades({study:shadowConfig,trades,observations});
 }catch(error){
  console.error('Prospective full trades read error:',String(error.message||error).slice(0,140));
  return {ok:false,mode:'FROZEN_PROSPECTIVE_SHADOW_TRADES',
   error:'Ainda não foi possível consultar operações experimentais',
   orderExecutionEnabled:false,autoPromotionEnabled:false};
 }
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
else if(path==='/api/agent-diagnostics')data=summarizePaperAgents({...paper.status(),ready:paperInitError===null&&paper.status().ready});
else if(path==='/api/gap-reconciliation'||path==='/api/admin/gap-review'){
 const restricted=path==='/api/admin/gap-review';
 if(restricted){
  const access=authorizeReviewRequest(req.headers.authorization);
  if(!access.authorized){
   const status=access.reason==='NOT_CONFIGURED'?503:401;
   res.writeHead(status,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff',
    'referrer-policy':'no-referrer'});
   return res.end(req.method==='HEAD'?undefined:JSON.stringify({
    ok:false,code:access.reason,message:'Revisão administrativa restrita; acesso indisponível'}));
  }
 }
 // Public audit is read-only; detailed administrative dossiers require server-side authorization.
 // Only fetch public OHLC for locked virtual positions; neither route mutates paper state.
 const state=paper.status(),marketBySymbol={},errorsBySymbol={};
 const locked=SYMBOLS.filter(symbol=>state.gapLocks?.[symbol]===true);
 await Promise.all(locked.map(async symbol=>{
  try{
   const result=await getKlines(symbol,{limit:1000});
   marketBySymbol[symbol]=result.candles;
  }catch(error){
   errorsBySymbol[symbol]=true;
   console.warn('Gap audit feed unavailable:',symbol,String(error.message||error).slice(0,80));
  }
 }));
 const audit=summarizeGapReconciliation(state,{marketBySymbol,errorsBySymbol});
 data=restricted?{...audit,administrativeReview:buildGapReviewPlan(audit,state)}:audit;
}

else if(path==='/api/performance'){
  try{
    const recent=paperStore?.listTrades?await paperStore.listTrades({limit:100}):paper.status().trades||[];
    const summary=performance(recent,paper.status().startingCash||10000);
    data={ok:true,...summary,partialHistory:recent.length===100,historyLimit:100};
  }catch(err){data={ok:false,error:'Estatísticas indisponíveis',mode:'PAPER_ONLY'};console.error('Performance read error:',String(err.message||err).slice(0,130));}
}
else if(path==='/api/research-risk')data=await getResearchRiskDiagnostics();
else if(path==='/api/monitor-timeline')data=await getMonitoringTimeline();
else if(path==='/api/monitor-coverage')data=await getMonitoringCoverage();
else if(path==='/api/monitor-alerts')data=await getMonitoringAlerts();
else if(path==='/api/monitor-health')data=await getMonitoringHealth();
else if(path==='/api/prospective-screens')data=await getProspectiveScreenReport();
else if(path==='/api/hypothesis-screen')data=await getHypothesisReport();
else if(path==='/api/stop-review')data=await getStopReviewReport();
else if(path==='/api/shadow-trades')data=await getShadowTradeReport();
else if(path==='/api/forward-study')data=await getForwardSnapshot();
else if(path==='/api/entry-filter-research'){
  try{
   const rows=paperStore?.listResearchReports?await paperStore.listResearchReports({limit:15}):[];
   const latest=new Map();
   for(const row of rows){
    const study=row.report;
    if(SYMBOLS.includes(study?.symbol)&&study.entryFilterResearch&&!latest.has(study.symbol)){
      latest.set(study.symbol,{...study.entryFilterResearch,completedAt:row.completed_at});
    }
   }
   data={ok:true,mode:'RESEARCH_ONLY',experiment:'ENTRY_FILTERS_V1',
    results:SYMBOLS.map(symbol=>latest.has(symbol)?
     {ok:true,symbol,...latest.get(symbol)}:
     {ok:false,symbol,reason:'Aguardando estudo atualizado no Supabase'}),
    autoPromotionEnabled:false,orderExecutionEnabled:false,newsTradingEnabled:false};
  }catch(error){
   console.error('Entry filter research read failed:',String(error.message||error).slice(0,140));
   data={ok:false,mode:'RESEARCH_ONLY',error:'Resultados de filtros indisponíveis',results:[]};
  }
}
else if(path==='/api/cooldown-research'){
  try{
   const rows=paperStore?.listResearchReports?await paperStore.listResearchReports({limit:15}):[];
   const latest=new Map();
   for(const row of rows){
    const r=row.report;
    if(SYMBOLS.includes(r?.symbol)&&r.cooldownResearch&&!latest.has(r.symbol))latest.set(r.symbol,r);
   }
   data={ok:true,mode:'RESEARCH_ONLY',experiment:'COOLDOWN_SENSITIVITY_V1',
     results:SYMBOLS.map(symbol=>latest.has(symbol)?
       {ok:true,symbol,...latest.get(symbol).cooldownResearch}:
       {ok:false,symbol,reason:'Aguardando estudo atualizado'}),
     autoPromotionEnabled:false,orderExecutionEnabled:false};
  }catch(error){
   console.error('Cooldown research query failed:',String(error.message||error).slice(0,120));
   data={ok:false,mode:'RESEARCH_ONLY',error:'Estudo temporariamente indisponível'};
  }
}
else if(path==='/api/loss-diagnostics'){
  try{
   const rows=paperStore?.listResearchReports?await paperStore.listResearchReports({limit:15}):[];
   const latest=new Map();
   for(const row of rows){
    const r=row.report;
    if(SYMBOLS.includes(r?.symbol)&&!latest.has(r.symbol))latest.set(r.symbol,r);
   }
   data={ok:true,mode:'RESEARCH_DIAGNOSTICS',source:'supabase_archived_studies',
    generatedAt:new Date().toISOString(),results:SYMBOLS.map(symbol=>{
     const study=latest.get(symbol);
     return study?.lossDiagnostics?{ok:true,symbol,...study.lossDiagnostics}:
      {ok:false,symbol,reason:'Aguardando novo estudo histórico com diagnóstico'};
    }),newsTradingEnabled:false,autoPromotionEnabled:false,orderExecutionEnabled:false};
  }catch(error){
    console.error('Loss diagnostics query failed:',String(error.message||error).slice(0,120));
    data={ok:false,mode:'RESEARCH_DIAGNOSTICS',error:'Diagnóstico temporariamente indisponível'};
  }
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
setTimeout(()=>void runForwardCapture(),45000).unref();
setTimeout(()=>void syncMonitoringIncidents(),60000).unref();
setInterval(()=>void syncMonitoringIncidents(),90000).unref();
setInterval(()=>void runForwardCapture(),90000).unref();
setTimeout(()=>getNewsResearch().catch(err=>console.error('Scheduled news collection:',err.message)),30000).unref();
setTimeout(()=>void getForwardStudy().catch(err=>console.error('Scheduled walk-forward research:',err.message)),25000).unref();
setInterval(()=>void getForwardStudy().catch(err=>console.error('Scheduled walk-forward research:',err.message)),4*60*60*1000).unref();
setInterval(()=>{
 void getNewsResearch().catch(err=>console.error('Scheduled news collection:',err.message));
 getNewsImpactStatus();
},20*60*1000).unref();
