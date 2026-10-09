const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function harness() {
  const calls = [];
  const context = { exports: {}, Headers, fetch: async (...args) => { calls.push(args); return { status: 200 }; } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/clerkSessionFetch.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { request: context.exports.fetchWithClerkSession, calls };
}
test('current verified session replaces cached identity header', async () => {
  const { request, calls } = harness();
  await request(async () => 'current-test-session', '/fake', { headers: { Authorization: 'Bearer stale-test-session', 'Content-Type': 'application/json' }, method: 'PUT', body: '{}' });
  assert.equal(calls[0][1].headers.get('Authorization'), 'Bearer current-test-session');
  assert.equal(calls[0][1].headers.get('Content-Type'), 'application/json');
  assert.equal(calls[0][1].method, 'PUT');
});
test('signed-out session cannot issue an organization request', async () => {
  const { request, calls } = harness();
  await assert.rejects(request(async () => null, '/fake'));
  assert.equal(calls.length, 0);
});
test('failed session verification never falls back to cached headers', async () => {
  const { request, calls } = harness();
  await assert.rejects(request(async () => { throw new Error('unavailable'); }, '/fake', { headers: { Authorization: 'Bearer old-test-session' } }));
  assert.equal(calls.length, 0);
});
