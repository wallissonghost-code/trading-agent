// Derive observable paper-agent states from persisted runner facts, never from decorative mock robots.
import { SYMBOLS } from './market.js';

export const AGENT_STATES=Object.freeze([
 'OPERANDO','AGUARDANDO_SINAL','AGUARDANDO_CANDLE','COLETA_ATRASADA',
 'AVALIACAO_PENDENTE','ERRO','SEM_DADOS','PAUSADO'
]);
const NAMES={BTCUSDT:'ALPHA',ETHUSDT:'NOVA',SOLUSDT:'ORION'};
const reasonLabels={
 NO_NEW_ENTRY:'Aguardando oportunidade de entrada',
 EMA_TREND_NOT_BULLISH:'Tendência EMA ainda não favorece compra',
 RSI_OUTSIDE_BUY_RANGE:'RSI fora da faixa configurada para compra',
 POSITION_OPEN:'Posição simulada aberta; acompanhando stop e alvo',
 PORTFOLIO_DRAWDOWN_LOCK:'Limite de perda da carteira bloqueia novas entradas',
 CAPITAL_OR_RISK_LIMIT:'Capital ou limite de risco impede a entrada',
 PORTFOLIO_EXPOSURE_LIMIT:'Carteira atingiu o limite de exposição de 50%; aguardando espaço',
 MAX_OPEN_POSITIONS:'Quantidade máxima de posições abertas',
 EMA_RSI_WATCH_LONG:'Entrada simulada registrada',
 STOP_LOSS:'Stop de simulação executado',
 TAKE_PROFIT:'Alvo de simulação executado'
};
const iso=(n)=>Number.isFinite(n)?new Date(n).toISOString():null;
const safeDate=(v)=>{if(v===undefined||v===null||v==='')return null;const n=typeof v==='number'?v:Date.parse(v);return Number.isFinite(n)?n:null;};
export function summarizePaperAgents(paper,{now=Date.now(),staleAfterMs=20*60*1000,pausedSymbols=[]}={}){
 if(!Number.isFinite(now)||!Number.isFinite(staleAfterMs)||staleAfterMs<=0)throw Error('Invalid diagnostics clock');
 const paused=new Set(pausedSymbols);
 const results=SYMBOLS.map(symbol=>{
  const decision=paper?.lastDecisions?.[symbol]||null;
  const position=paper?.positions?.find?.(p=>p.symbol===symbol)||null;
  const closeTime=safeDate(paper?.lastCandle?.[symbol]);
  const decisionTime=safeDate(decision?.observedAt);
  const ageMs=closeTime===null?null:Math.max(0,now-closeTime);
  const fault=paper?.lastError?.[symbol]||null;
  const persistedFailure=paper?.storageError||null;
  const initialized=paper?.ready===true;
  let state,reason;
  if(paused.has(symbol)){state='PAUSADO';reason='Agente pausado pelo operador';}
  else if(!initialized||persistedFailure||fault){
   state='ERRO';
   reason=!initialized?'Execução de simulação indisponível':persistedFailure?'Falha de persistência da simulação':'Falha na coleta ou avaliação do mercado';
  }else if(closeTime===null||!decision){
   state='SEM_DADOS';reason='Ainda não há decisão persistida para este mercado';
  }else if(closeTime>now+60000||ageMs>staleAfterMs){
   state='COLETA_ATRASADA';reason='Último candle processado está fora da janela esperada';
  }else if(position){
   state='OPERANDO';reason='Posição simulada aberta; acompanhando stop e alvo';
  }else{
   state='AGUARDANDO_SINAL';reason=reasonLabels[decision.reason]||'Sem operação simulada aberta; aguardando condições';
  }
  return {id:symbol.toLowerCase(),name:NAMES[symbol],symbol,state,reason,
   reasonCode:decision?.reason||null,lastDecisionAt:iso(decisionTime),
   lastCandleCloseAt:iso(closeTime),ageSeconds:ageMs===null?null:Math.floor(ageMs/1000),
   lastAction:decision?.action||null,positionOpen:Boolean(position),simulated:true,
   realizedPnl:paper?.agentPnl?.[symbol]?.realizedPnl??null,
   unrealizedPnl:paper?.agentPnl?.[symbol]?.unrealizedPnl??null,
   errorPresent:Boolean(fault||persistedFailure),dataSource:paper?.dataSource||'unavailable'};
 });
 const anyError=results.some(x=>x.state==='ERRO');
 const anyStale=results.some(x=>x.state==='COLETA_ATRASADA');
 const anyMissing=results.some(x=>x.state==='SEM_DADOS');
 const health=anyError?'ERROR':anyStale?'STALE':anyMissing?'INSUFFICIENT_DATA':results.every(x=>['OPERANDO','AGUARDANDO_SINAL'].includes(x.state))?'CURRENT':'PARTIAL';
 const latestCandleMs=Math.max(...results.map(x=>safeDate(x.lastCandleCloseAt)??-1));
 return {ok:paper?.ready===true&&!paper?.storageError,mode:'PAPER_ONLY',
  collectionHealth:health,allCurrent:health==='CURRENT',
  lastCandleCloseAt:latestCandleMs>=0?iso(latestCandleMs):null,
  generatedAt:iso(now),staleAfterSeconds:staleAfterMs/1000,
  realOrdersEnabled:false,source:'paper_runner_snapshot',agents:results,
  note:'AGUARDANDO_CANDLE e AVALIACAO_PENDENTE pertencem ao estudo prospectivo, não à execução paper; consultar /api/prospective-screens.'};
}
