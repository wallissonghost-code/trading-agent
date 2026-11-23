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
 assert.match(match[1],/src=\\"'\+r.art/);
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
