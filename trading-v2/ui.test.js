import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');

test('inline dashboard JavaScript compiles and displays live agent profit',()=>{
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,'dashboard script must exist');
 assert.doesNotThrow(()=>new Script(match[1]));
 assert.match(match[1],/function renderRobots\(p\)/);
 assert.match(match[1],/agentPnl/);
 assert.ok(match[1].includes('class="agent-art"'));
});
test('all premium robot assets are valid local JPEG files',()=>{
 for(const name of ['alpha','nova','orion']){
  const bytes=readFileSync(new URL('./assets/'+name+'.jpg',import.meta.url));
  assert.ok(bytes.length>10000);
  assert.equal(bytes[0],0xff);
  assert.equal(bytes[1],0xd8);
  assert.ok(html.includes('/assets/'+name+'-portrait.jpg'));
 }
});
test('market cards and portfolio prevent mobile overlap',()=>{
 assert.match(html,/#liveMarket,#paperMetrics\{grid-template-columns:minmax\(0,1fr\)!important\}/);
 assert.match(html,/\.metric\{min-width:0;overflow:hidden\}/);
});

test('mobile displays full robot portraits above the live trade details',()=>{
 for(const name of ['alpha','nova','orion']){
  const file=readFileSync(new URL('./assets/'+name+'-portrait.jpg',import.meta.url));
  assert.ok(file.length>10000);
  assert.equal(file[0],0xff);
  assert.equal(file[1],0xd8);
  assert.ok(html.includes('/assets/'+name+'-portrait.jpg'));
 }
 assert.match(html,/\.agent-card\{grid-template-columns:minmax\(0,1fr\)!important\}/);
 assert.match(html,/\.agent-art img\{display:block!important/);
 assert.match(html,/object-fit:contain!important/);
});


test('robot room warns of stale collector and avoids claiming uninterrupted uptime',()=>{
 assert.match(html,/id="collectorWarning"/);
 assert.match(html,/role="status" aria-live="polite"/);
 assert.match(html,/Coleta atrasada:/);
 assert.match(html,/não há garantia de execução 24h/);
 assert.match(html,/collectionHealth==='CURRENT'/);
});


test('missed-candle quarantine is visibly distinct from an online robot',()=>{
 assert.match(html,/LACUNA \/ POSIÇÃO PROTEGIDA/);
 assert.match(html,/Lacuna histórica:/);
 assert.match(html,/PAPER TRADING/);
 assert.match(html,/DATA_GAP_POSITION_LOCK/);
 assert.match(html,/Posição paper preservada/);
});

test('gap reconciliation UI is informational and never offers unlock operations',()=>{
 assert.match(html,/id="gapReconciliationNote"/);
 assert.match(html,/Reconciliação somente leitura:/);
 assert.match(html,/Nenhuma ordem gerada e nenhuma posição desbloqueada/);
 assert.match(html,/api\/gap-reconciliation/);
 assert.match(html,/refreshGapReconciliation/);
});

test('public dashboard never exposes restricted administrative dossier IDs',()=>{
 assert.equal(html.includes('administrativeReview?.cases'),false);
 assert.equal(html.includes('review.caseId'),false);
 assert.match(html,/Dossiês detalhados restritos ao acesso administrativo/);
 assert.match(html,/Aprovação administrativa indisponível/);
 assert.match(html,/Nenhuma ordem gerada e nenhuma posição desbloqueada/);
});


test('paper test quality panel separates paper evidence from independent shadow research',()=>{
 assert.match(html,/id="paperEvidencePanel"/);
 assert.match(html,/id="paperEvidenceStatus"/);
 assert.match(html,/api\/paper-evidence/);
 assert.match(html,/PAPER_CANDLE_JOURNAL_7D_UNAVAILABLE/);
 assert.match(html,/Dados shadow são contexto, não uptime do Render/);
 assert.match(html,/sem liberação real/);
});
