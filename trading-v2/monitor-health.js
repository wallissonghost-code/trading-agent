// Read-only monitoring of research data. Never changes the paper engine.
// Three different concepts must not be conflated: data freshness, signal count,
// and execution/trade readiness.
export const MONITOR_SYMBOLS=Object.freeze(['BTCUSDT','ETHUSDT','SOLUSDT']);
export function summarizeMonitoring({observations=[],capture={},now=Date.now(),serviceStartedAt=null}={}){
 if(!Array.isArray(observations))throw Error('Invalid monitoring observations');
 const symbols=MONITOR_SYMBOLS.map(symbol=>{
  const rows=observations.filter(r=>r.symbol===symbol&&Number.isFinite(Number(r.candle_close_time)))
   .sort((a,b)=>Number(b.candle_close_time)-Number(a.candle_close_time));
  const last=rows[0];
  const candleAt=last?Number(last.candle_close_time):null;
  const receivedAt=last?Date.parse(last.observed_at):null;
  const ageSeconds=candleAt===null?null:Math.max(0,Math.floor((now-candleAt)/1000));
  const observedAgoSeconds=Number.isFinite(receivedAt)?Math.max(0,Math.floor((now-receivedAt)/1000)):null;
  const recent=ageSeconds!==null&&ageSeconds<=12*60&&
   observedAgoSeconds!==null&&observedAgoSeconds<=12*60;
  const gaps=rows.slice(0,49).filter((r,i)=>i>0&&
   Number(rows[i-1].candle_close_time)-Number(r.candle_close_time)!==300000).length;
  const cycle=capture.sources?.find(r=>r.symbol===symbol)||null;
  let status='AWAITING_COLLECTION';
  if(recent)status='MONITORING';
  else if(rows.length)status='STALE_DATA';
  if(cycle?.status==='error')status='COLLECTION_ERROR';
  const recentRows=rows.filter(r=>now-Number(r.candle_close_time)<=60*60*1000);
  const signalsLastHour=recentRows.reduce((sum,r)=>
   sum+(Object.values(r.signals||{}).some(v=>v===true)?1:0),0);
  const warnings=[];
  if(status==='STALE_DATA')warnings.push('Último candle registrado está atrasado');
  if(status==='COLLECTION_ERROR')warnings.push('Erro na última coleta deste ativo');
  if(status==='AWAITING_COLLECTION')warnings.push('Nenhum candle foi registrado ainda');
  if(gaps)warnings.push('Existem lacunas na amostra recente');
  // No signal is expected sometimes. Never infer the bot is broken from 0 trades.
  return {symbol,status,healthy:status==='MONITORING',lastCandleCloseTime:candleAt,
    lastObservedAt:Number.isFinite(receivedAt)?new Date(receivedAt).toISOString():null,
    ageSeconds,observedAgoSeconds,observationsInWindow:rows.length,
    gapsInLast50:gaps,signalsLastHour,
    signalState:status==='MONITORING'?(signalsLastHour?'SIGNALS_OBSERVED':'NO_ELIGIBLE_SIGNALS'):'UNKNOWN_DATA_NOT_CURRENT',
    latestCollectorStatus:cycle?.shadowStatus||cycle?.status||'unknown',
    warnings};
 });
 const anyBroken=symbols.some(s=>s.status==='COLLECTION_ERROR');
 const anyOld=symbols.some(s=>s.status==='STALE_DATA');
 const pending=symbols.some(s=>s.status==='AWAITING_COLLECTION');
 const status=anyBroken?'ERROR':anyOld?'DEGRADED':pending?'INITIALIZING':
  symbols.every(s=>s.healthy)?'HEALTHY':'DEGRADED';
 const started=Date.parse(serviceStartedAt);
 return {ok:true,mode:'READ_ONLY_RESEARCH_HEALTH',status,
  asOf:new Date(now).toISOString(),
  serviceUptimeSeconds:Number.isFinite(started)?Math.max(0,Math.floor((now-started)/1000)):null,
  lastCollectorCheckAt:capture.lastCheckedAt||null,
  captureError:capture.error||null,
  rules:{maxCandleAgeSeconds:720,expectedCandleIntervalSeconds:300,
    errorsAreNotEquivalentToNoSignal:true},
  symbols,orderExecutionEnabled:false,autoPromotionEnabled:false};
}
