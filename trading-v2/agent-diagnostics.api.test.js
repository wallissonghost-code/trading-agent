import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const nap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('HTTP diagnostics remains read-only, per-agent and separately identifiable from mock feed', {timeout:20000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'trading-diagnostics-api-'));
 const port=21000+Math.floor(Math.random()*20000);
 const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,PORT:String(port),PAPER_STATE_PATH:join(dir,'paper.json'),
   SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',ADMIN_REVIEW_TOKEN:''},
  stdio:'ignore'
 });
 try{
  const url='http://127.0.0.1:'+port;
  let ready=false;
  for(let attempt=0;attempt<70;attempt++){
   if(child.exitCode!==null)throw Error('API server exited: '+child.exitCode);
   try{
    const response=await fetch(url+'/health',{signal:AbortSignal.timeout(800)});
    if(response.ok){ready=true;break;}
   }catch{}
   await nap(100);
  }
  assert.equal(ready,true,'API must start before its HTTP status can be validated');
  const [diagnosticsResponse,mockResponse,paperResponse,reconciliationResponse,evidenceResponse]=await Promise.all([
   fetch(url+'/api/agent-diagnostics'),fetch(url+'/api/status'),fetch(url+'/api/paper'),fetch(url+'/api/gap-reconciliation'),fetch(url+'/api/paper-evidence')
  ]);
  assert.equal(diagnosticsResponse.status,200);
  assert.equal(mockResponse.status,200);
  assert.equal(paperResponse.status,200);
  assert.equal(reconciliationResponse.status,200);
  assert.equal(evidenceResponse.status,200);
  const [d,m,p,g,evidence]=await Promise.all([diagnosticsResponse.json(),mockResponse.json(),paperResponse.json(),reconciliationResponse.json(),evidenceResponse.json()]);
  assert.equal(d.mode,'PAPER_ONLY');
  assert.equal(d.realOrdersEnabled,false);
  assert.equal(d.source,'paper_runner_snapshot');
  assert.deepEqual(d.agents.map(a=>a.symbol),['BTCUSDT','ETHUSDT','SOLUSDT']);
  assert.ok(d.agents.every(a=>a.simulated===true&&typeof a.reason==='string'));
  assert.equal(m.dataSource,'synthetic');
  assert.equal(p.mode,'PAPER_ONLY');
  assert.equal(p.executionEnabled,false);
  assert.equal(evidence.mode,'PAPER_EVIDENCE_DIAGNOSTICS');
  assert.equal(evidence.realOrdersEnabled,false);
  assert.equal(evidence.noAutoHostingUpgrade,true);
  assert.equal(evidence.results.length,3);
  assert.ok(evidence.results.every(x=>x.readyForLiveTrading===false));
  assert.equal(g.mode,'PAPER_ONLY');
  assert.equal(g.lockedCount,0);
  assert.equal(g.automaticUnlockEnabled,false);
  assert.equal(g.automaticFillsEnabled,false);
  assert.equal(Object.hasOwn(g,'administrativeReview'),false);
  const adminResponse=await fetch(url+'/api/admin/gap-review');
  assert.equal(adminResponse.status,503);
  const adminUnavailable=await adminResponse.json();
  assert.equal(adminUnavailable.code,'NOT_CONFIGURED');
  assert.equal((await fetch(url+'/api/admin/audit-log')).status,503);
  assert.equal((await fetch(url+'/api/admin/gap-review',{method:'POST'})).status,405);
  assert.deepEqual(g.symbols.map(x=>x.status),['NO_QUARANTINE','NO_QUARANTINE','NO_QUARANTINE']);
 }finally{
  child.kill('SIGTERM');
  await rm(dir,{force:true,recursive:true});
 }
});


test('protected dossier route requires admin token and never exposes secret in response', {timeout:20000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'trading-admin-review-'));
 const port=21000+Math.floor(Math.random()*20000);
 const secret='local-integration-only-review-secret-2026-012345678901';
 const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,PORT:String(port),PAPER_STATE_PATH:join(dir,'paper.json'),
   SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',
   ADMIN_REVIEW_TOKEN:secret},
  stdio:'ignore'
 });
 try{
  const url='http://127.0.0.1:'+port;
  let ready=false;
  for(let attempt=0;attempt<75;attempt++){
   if(child.exitCode!==null)throw Error('Protected API exited unexpectedly');
   try{const response=await fetch(url+'/health',{signal:AbortSignal.timeout(900)});
    if(response.ok){ready=true;break;}}catch{}
   await nap(100);
  }
  assert.equal(ready,true);
  const unauthorized=await fetch(url+'/api/admin/gap-review');
  assert.equal(unauthorized.status,401);
  const incorrect=await fetch(url+'/api/admin/gap-review',{headers:{authorization:'Bearer '+'x'.repeat(40)}});
  assert.equal(incorrect.status,401);
  const authorized=await fetch(url+'/api/admin/gap-review',{headers:{authorization:'Bearer '+secret}});
  assert.equal(authorized.status,503); // Fail closed without durable Supabase audit storage.
  const raw=await authorized.text();
  assert.equal(raw.includes(secret),false);
  const report=JSON.parse(raw);
  assert.equal(report.code,'AUDIT_UNAVAILABLE');
  const auditAccess=await fetch(url+'/api/admin/audit-log',{headers:{authorization:'Bearer '+secret}});
  assert.equal(auditAccess.status,503);
  assert.equal((await auditAccess.json()).code,'AUDIT_UNAVAILABLE');
  const publicReport=await (await fetch(url+'/api/gap-reconciliation')).json();
  assert.equal(Object.hasOwn(publicReport,'administrativeReview'),false);
 }finally{
  child.kill('SIGTERM');
  await rm(dir,{recursive:true,force:true});
 }
});
