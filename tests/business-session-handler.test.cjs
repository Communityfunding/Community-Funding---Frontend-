const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness() {
  const effects = [], requests = [];
  let finishSync;
  const syncing = new Promise(resolve => { finishSync = resolve; });
  const mockRequire = name => {
    if (name === 'react') return { useState: v => [typeof v === 'function' ? v() : v, () => {}], useEffect: cb => effects.push(cb), useRef: v => ({ current: v }), useCallback: fn => fn };
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
    if (name === 'next/navigation') return { useParams: () => ({ id: 'fixture-org' }), useSearchParams: () => ({ get: () => null }) };
    if (name === '@clerk/nextjs') return { useUser: () => ({ isLoaded: true, user: { id: 'current-personal' } }) };
    if (name === '@/lib/backendToken') return { syncClerkToBackendToken: () => syncing, getVerifiedBackendToken: async () => 'isolated-native-proof' };
    if (name === '@/lib/clerkSessionFetch') return { fetchWithClerkSession: async (getToken, url) => { requests.push({ url, hasProof: !!await getToken() }); return { status: 403, ok: false }; } };
    if (name === '@/lib/businessUsername') return { defaultBusinessUsername: () => 'test_fixture' };
    return { __esModule: true, default: () => null };
  };
  const context = { exports: {}, require: mockRequire, process: { env: {} }, localStorage: { getItem: () => null } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/business/[id]/page.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  context.exports.default();
  return { effects, requests, finishSync };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('actual organization page waits for verified onboarding sync before membership request', async () => {
  const h = harness();
  h.effects[0]();
  await tick();
  assert.equal(h.requests.length, 0);
  h.finishSync(true);
  await tick();
  assert.equal(h.requests.length, 1);
  assert.match(h.requests[0].url, /organizations\/fixture-org\/my-role$/);
  assert.equal(h.requests[0].hasProof, true);
});
test('actual organization page sends no request if verification sync fails', async () => {
  const h = harness();
  h.effects[0]();
  h.finishSync(false);
  await tick();
  assert.equal(h.requests.length, 0);
});
