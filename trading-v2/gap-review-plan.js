// Administrative case preparation for paper-only gaps. No mutation authority.
import {createHash} from 'node:crypto';
import {SYMBOLS} from './market.js';

const evidenceString=e=>JSON.stringify(e);
const sha=e=>createHash('sha256').update(evidenceString(e)).digest('hex');
export const GAP_REVIEW_ACTIONS=Object.freeze([
 'VERIFY_MARKET_EVIDENCE','REVIEW_SIMULATED_POSITION','DOCUMENT_AMBIGUITY'
]);
export function buildGapReviewCase(report,{position=null,gap=null,decision=null}={}){
 if(!SYMBOLS.includes(report?.symbol))throw Error('Unsupported gap review symbol');
 const locked=report.locked===true;
 const evidence={
  schema:1,symbol:report.symbol,locked,position:position?{
   entry:position.entry,stop:position.stop,take:position.take,quantity:position.quantity,
   cost:position.cost,openedAt:position.openedAt??null,entryCandle:position.entryCandle??null}:null,
  gap:gap?{previousCandleCloseTime:gap.previousCandleCloseTime??null,
   resumedCandleCloseTime:gap.resumedCandleCloseTime??null,
   missedCandles:gap.missedCandles??null,detectedAt:gap.detectedAt??null}:null,
  decision:decision?{reason:decision.reason??null,candleCloseTime:decision.candleCloseTime??null}:null,
  audit:{status:report.status,historyComplete:report.historyComplete===true,
   candlesExpected:report.candlesExpected??null,candlesAvailable:report.candlesAvailable??null,
   candlesMissing:report.candlesMissing??null,
   firstPossibleTrigger:report.firstPossibleTrigger??null,confidence:report.confidence??null}
 };
 const fingerprint=sha(evidence);
 const ambiguous=report.firstPossibleTrigger?.classification==='BOTH_IN_SAME_CANDLE';
 const required=locked?[
  'Preservar snapshot imutável de carteira e histórico paper',
  'Validar origem e continuidade dos candles OHLC',
  'Registrar incerteza sobre ordem intravela e preços executáveis',
  'Obter decisão humana separada, autenticada e auditada antes de qualquer mudança'
 ]:[];
 const state=!locked?'NO_ACTIVE_CASE':
  !report.historyComplete?'EVIDENCE_INCOMPLETE':
  ambiguous?'AMBIGUOUS_MANUAL_REVIEW':'MANUAL_REVIEW_READY';
 return {schema:1,symbol:report.symbol,caseId:'paper-gap-'+report.symbol.toLowerCase()+'-'+fingerprint.slice(0,16),
  evidenceSha256:fingerprint,mode:'PAPER_ONLY',state,locked,
  evidence,requiredSteps:required,
  suggestedActions:locked?[...GAP_REVIEW_ACTIONS]:[],
  // Deliberately no authorization or mutation endpoint: this is only a plan.
  canApproveInApp:false,canUnlock:false,canSettle:false,
  authorization:'NOT_CONFIGURED',reviewer:null,approvedAt:null,
  reason:!locked?'Nenhuma posição paper bloqueada neste ativo.':
   !report.historyComplete?'Histórico insuficiente; nenhuma liberação permitida.':
   ambiguous?'OHLC ambíguo; evidência incapaz de determinar sequência intravela.':
   'Evidências organizadas para revisão humana, sem autorização de alterar carteira.',
  notice:'ID identifica somente este pacote de evidências; se o estado mudar, o ID também muda.'};
}
export function buildGapReviewPlan(report,paper){
 if(report?.mode!=='PAPER_ONLY'||!Array.isArray(report.symbols))
  throw Error('Invalid paper reconciliation report');
 const cases=report.symbols.map(item=>buildGapReviewCase(item,{
  position:paper?.positions?.find?.(p=>p.symbol===item.symbol)||null,
  gap:paper?.dataGaps?.[item.symbol]||null,
  decision:paper?.lastDecisions?.[item.symbol]||null
 }));
 return {ok:true,mode:'PAPER_ONLY',readOnly:true,automaticExecution:false,
  manualMutationsEnabled:false,realOrdersEnabled:false,
  lockedCount:cases.filter(c=>c.locked).length,cases,
  instructions:'Dossiês são apenas propostas de revisão. Não existe endpoint de aprovação, desbloqueio ou liquidação.'};
}
