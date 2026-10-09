const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');

function harness() {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const sandbox = { exports:{}, process:{env:{}}, window:{Clerk:{user:{id:'qa'},session:{getToken:async()=> 'clerk-proof'}}}, localStorage:storage, atob:s=>Buffer.from(s,'base64').toString(), Date, fetch:null };
  sandbox.fetch = async () => ({ok:true,json:async()=>({access_token:'backend-proof'})});
  const source=ts.transpileModule(fs.readFileSync('lib/backendToken.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(source,sandbox);
  return { api:sandbox.exports, sandbox, storage };
}

test('logout removes both backend and admin identity caches',()=>{
  const {api,storage}=harness();
  for(const k of ['cf_backend_token','cf_synced_email','cf_synced_clerk_id','cf_site_admin']) storage.setItem(k,'old');
  api.clearBackendSession();
  for(const k of ['cf_backend_token','cf_synced_email','cf_synced_clerk_id','cf_site_admin']) assert.equal(storage.getItem(k),null);
});
test('an async bridge response cannot restore a logged-out session',async()=>{
  const {api,sandbox,storage}=harness();
  sandbox.fetch=async()=>{sandbox.window.Clerk.session=null;return {ok:true,json:async()=>({access_token:'stale'})};};
  assert.equal(await api.syncClerkToBackendToken({id:'qa'}),false);
  assert.equal(storage.getItem('cf_backend_token'),null);
});
test('verified response is bound to the same Clerk user',async()=>{
  const {api,storage}=harness();
  assert.equal(await api.syncClerkToBackendToken({id:'qa'}),true);
  assert.equal(storage.getItem('cf_synced_clerk_id'),'qa');
});
test('cached native token cannot authorize a signed-out visitor',async()=>{
  const {api,sandbox,storage}=harness();
  storage.setItem('cf_backend_token','old'); sandbox.window.Clerk.session=null;
  assert.equal(await api.ensureBackendSession({id:'qa'}),false);
  assert.equal(storage.getItem('cf_backend_token'),null);
});

test('native route token getter renews through verified Clerk bridge',async()=>{
  const {api,storage}=harness();
  storage.setItem('cf_backend_token','expired-test-cache');
  storage.setItem('cf_synced_clerk_id','qa');
  assert.equal(await api.getVerifiedBackendToken({id:'qa'}),'backend-proof');
  assert.equal(storage.getItem('cf_synced_clerk_id'),'qa');
});

test('native route token getter refuses mismatched live Clerk identity',async()=>{
  const {api,storage}=harness();
  storage.setItem('cf_backend_token','old');
  assert.equal(await api.getVerifiedBackendToken({id:'other'}),null);
  assert.equal(storage.getItem('cf_backend_token'),null);
});

test('native route token getter does not return late logout response',async()=>{
  const {api,sandbox}=harness();
  sandbox.fetch=async()=>{sandbox.window.Clerk.session=null;return {ok:true,json:async()=>({access_token:'late-test-response'})};};
  assert.equal(await api.getVerifiedBackendToken({id:'qa'}),null);
});
