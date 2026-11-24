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
 assert.equal((before.match(/<section\b/g)||[]).length,19); // 18 original sections + new monitoring panel
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
 assert.match(code,/if\(selected==='painel'\)\{void sync\(\);void refreshMonitorHealth\(\);void refreshMonitorAlerts\(\);void refreshMonitorCoverage\(\);void refreshMonitorTimeline\(\);\}/);
 assert.doesNotThrow(()=>new Function(code));
});

test('incident timeline is collapsed inside main panel and is a separate read-only fetch',()=>{
 const panel=html.slice(html.indexOf('id="view-painel"'),html.indexOf('id="view-operacoes"'));
 assert.match(panel,/id="monitorAlertsPanel"/);
 assert.match(panel,/id="monitorAlertsRows"/);
 assert.match(panel,/id="refreshMonitorAlerts"/);
 const code=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(code,/fetch\('\/api\/monitor-alerts'/);
 assert.match(code,/if\(activeWorkspace==='painel'&&\$\('monitorAlertsPanel'\)\.open\)/);
 assert.doesNotThrow(()=>new Function(code));
});

test('coverage measurement is collapsed and explicitly does not report server uptime',()=>{
 const panel=html.slice(html.indexOf('id="view-painel"'),html.indexOf('id="view-operacoes"'));
 assert.match(panel,/id="monitorCoveragePanel"/);
 assert.match(panel,/id="monitorCoverageRows"/);
 assert.match(panel,/id="refreshMonitorCoverage"/);
 assert.match(panel,/não estima a disponibilidade real/);
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(script,/fetch\('\/api\/monitor-coverage'/);
 assert.match(script,/if\(activeWorkspace==='painel'&&\$\('monitorCoveragePanel'\)\.open\)/);
 assert.doesNotThrow(()=>new Function(script));
});

test('24 hour timeline is collapsed and updates only when Panel is shown',()=>{
 const panel=html.slice(html.indexOf('id="view-painel"'),html.indexOf('id="view-operacoes"'));
 assert.match(panel,/id="monitorTimelinePanel"/);
 assert.match(panel,/id="monitorTimelineRows"/);
 assert.match(panel,/id="refreshMonitorTimeline"/);
 const code=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(code,/fetch\('\/api\/monitor-timeline'/);
 assert.match(code,/if\(activeWorkspace==='painel'&&\$\('monitorTimelinePanel'\)\.open\)/);
 assert.doesNotThrow(()=>new Function(code));
});

test('read-only rule and risk explanation is collapsed in Strategies and does not navigate to trading orders',()=>{
 const strategies=html.slice(html.indexOf('id="view-estrategias"'),html.indexOf('id="view-noticias"'));
 assert.match(strategies,/id="researchRiskPanel"/);
 assert.match(strategies,/id="researchRiskResults"/);
 assert.match(strategies,/id="refreshResearchRisk"/);
 assert.match(strategies,/sem alterar as regras congeladas nem enviar ordens/);
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(script,/fetch\('\/api\/research-risk'/);
 assert.match(script,/\$\('researchRiskPanel'\)\.addEventListener\('toggle'/);
 assert.doesNotThrow(()=>new Function(script));
});

test('NOVA paper decision diagnostics are derived from persisted per-symbol decisions',()=>{
 const panel=html.slice(html.indexOf('id="view-painel"'),html.indexOf('id="view-operacoes"'));
 assert.match(panel,/id="paperAgentDecisionPanel"/);
 assert.match(panel,/id="paperAgentDecisions"/);
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(script,/const decisions=p\?\.lastDecisions\|\|\{\}/);
 assert.match(script,/NOVA • ETH/);
 assert.match(script,/EMA_TREND_NOT_BULLISH/);
 assert.match(script,/RSI_OUTSIDE_BUY_RANGE/);
 assert.doesNotThrow(()=>new Function(script));
});

test('new losses audit remains collapsed, read-only and isolated in Strategies tab',()=>{
 const strategies=html.slice(html.indexOf('id="view-estrategias"'),html.indexOf('id="view-noticias"'));
 assert.match(strategies,/id="stopReviewPanel"/);
 assert.match(strategies,/id="stopReviewResults"/);
 assert.match(strategies,/id="refreshStopReview"/);
 assert.match(strategies,/Nenhuma estratégia aprovada/);
 const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(js,/fetch\('\/api\/stop-review'/);
 assert.match(js,/\$\('stopReviewPanel'\)\.addEventListener\('toggle'/);
 assert.doesNotThrow(()=>new Function(js));
});

test('hypothesis research stays collapsed and never offers live strategy activation',()=>{
 const view=html.slice(html.indexOf('id="view-estrategias"'),html.indexOf('id="view-noticias"'));
 assert.match(view,/id="hypothesisScreenPanel"/);
 assert.match(view,/id="hypothesisScreenResults"/);
 assert.match(view,/id="refreshHypothesisScreen"/);
 assert.match(view,/não dinheiro que teria sido economizado/);
 const script=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(script,/fetch\('\/api\/hypothesis-screen'/);
 assert.match(script,/\$\('hypothesisScreenPanel'\)\.addEventListener\('toggle'/);
 assert.doesNotThrow(()=>new Function(script));
});

test('new frozen prospective study is read-only, collapsed and distinct from historical screens',()=>{
 const view=html.slice(html.indexOf('id="view-estrategias"'),html.indexOf('id="view-noticias"'));
 assert.match(view,/id="prospectiveScreenPanel"/);
 assert.match(view,/id="prospectiveScreenResults"/);
 assert.match(view,/id="refreshProspectiveScreens"/);
 assert.match(view,/após o início do estudo/);
 const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.match(js,/fetch\('\/api\/prospective-screens'/);
 assert.match(js,/\$\('prospectiveScreenPanel'\)\.addEventListener\('toggle'/);
 assert.doesNotThrow(()=>new Function(js));
});
