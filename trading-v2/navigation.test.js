import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const keys=['painel','operacoes','estrategias','noticias','auditoria'];
test('mobile navigation exposes five named accessible tabs and one initially visible panel',()=>{
 for(const key of keys){
  assert.match(html,new RegExp('id="tab-'+key+'"[^>]*role="tab"'));
  assert.match(html,new RegExp('id="view-'+key+'"[^>]*role="tabpanel"'));
 }
 const panels=[...html.matchAll(/<div id="view-([^"]+)" class="workspace-view"[^>]*>/g)];
 assert.equal(panels.length,5);
 assert.deepEqual(panels.map(x=>x[1]),keys);
 assert.equal(panels.filter(x=>!x[0].includes(' hidden')).length,1);
 assert.ok(!panels[0][0].includes(' hidden'));
});
test('all original sections and financial controls remain in the appropriate workspace',()=>{
 const before=html.slice(0,html.indexOf('<script>'));
 const views=Object.fromEntries(keys.map((key,i)=>{
  const first=before.indexOf('id="view-'+key+'"');
  const next=i+1<keys.length?before.indexOf('id="view-'+keys[i+1]+'"'):before.indexOf('<p class="disclaimer">');
  return [key,before.slice(first,next)];
 }));
 assert.match(views.painel,/id="office"/);
 assert.match(views.painel,/id="paperMetrics"/);
 assert.match(views.operacoes,/id="ledgerRows"/);
 assert.match(views.operacoes,/id="performanceMetrics"/);
 assert.match(views.operacoes,/id="decisionsRows"/);
 assert.match(views.estrategias,/id="strategyLabResults"/);
 assert.match(views.estrategias,/id="entryFilterResults"/);
 assert.match(views.noticias,/id="newsResearchRows"/);
 assert.match(views.noticias,/id="newsImpactMetrics"/);
 assert.match(views.auditoria,/id="researchAuditResults"/);
 assert.match(views.auditoria,/id="lossDiagnosticsResults"/);
 assert.equal((before.match(/<section\b/g)||[]).length,18);
});
test('tab navigation uses URL hashes, no external dependencies, and no eager research requests',()=>{
 const code=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new Function(code));
 assert.match(code,/window\.addEventListener\('hashchange'/);
 assert.match(code,/location\.hash=key/);
 assert.match(code,/if\(selected==='estrategias'\)/);
 assert.ok(!code.includes('renderRobots(null);sync();refreshTradeHistory();'));
 assert.match(html,/\.workspace-view\[hidden\]\{display:none!important\}/);
});

test('prospective complete-trade cockpit stays inside Strategies tab and loads on demand',()=>{
 const strategies=html.slice(html.indexOf('id="view-estrategias"'),html.indexOf('id="view-noticias"'));
 const panel=html.slice(html.indexOf('id="view-painel"'),html.indexOf('id="view-operacoes"'));
 assert.match(strategies,/id="shadowTradeStatus"/);
 assert.match(strategies,/id="shadowTradeMarkets"/);
 assert.match(strategies,/id="shadowTradeHistory"/);
 assert.match(strategies,/id="refreshShadowTrades"/);
 assert.doesNotMatch(panel,/id="shadowTradeStatus"/);
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(script,/fetch\('\/api\/shadow-trades'/);
 assert.match(script,/if\(selected==='estrategias'\)\{\s*void refreshShadowTrades\(\)/);
 assert.doesNotThrow(()=>new Function(script));
});

test('robot health cards remain in main mobile dashboard and never trigger exchange trades',()=>{
 const panel=html.slice(html.indexOf('id="view-painel"'),html.indexOf('id="view-operacoes"'));
 assert.match(panel,/id="monitorHealthStatus"/);
 assert.match(panel,/id="monitorHealthRobots"/);
 assert.match(panel,/id="refreshMonitorHealth"/);
 const code=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(code,/fetch\('\/api\/monitor-health'/);
 assert.match(code,/NO_ELIGIBLE_SIGNALS:'Sem sinal elegível/);
 assert.match(code,/if\(selected==='painel'\)\{void sync\(\);void refreshMonitorHealth\(\);\}/);
 assert.doesNotThrow(()=>new Function(code));
});
