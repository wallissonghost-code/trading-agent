import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseStore} from './supabase-store.js';
test('refuses malformed or non-TLS Supabase origins',()=>{
 assert.throws(()=>createSupabaseStore({url:'http://wrong.example',key:'secret'}),/Invalid Supabase host/);
});
test('loads empty account and saves state with server credentials',async()=>{
 let saved=null,calls=0;
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'test-server-secret',fetchFn:async(url,opts)=>{
 calls++;
 assert.equal(opts.headers.apikey,'test-server-secret');
 if(opts.method==='GET')return {ok:true,text:async()=>saved?JSON.stringify([{state:saved}]):'[]'};
 saved=JSON.parse(opts.body).state;
 return {ok:true,text:async()=>JSON.stringify([{state:saved}])};
 }});
 const start=await store.load();
 assert.equal(start.cash,10000);
 start.cash=8500;
 await store.save(start);
 assert.equal((await store.load()).cash,8500);
 assert.equal(calls,3);
});
test('network failure fails closed rather than resetting state',async()=>{
 const store=createSupabaseStore({url:'https://example.supabase.co',key:'test-secret',fetchFn:async()=>({ok:false,status:503,text:async()=>'unavailable'})});
 await assert.rejects(()=>store.load(),/HTTP 503/);
});
