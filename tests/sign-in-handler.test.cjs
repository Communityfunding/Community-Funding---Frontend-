const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(attempt, { loaded = true, verification = null, verifyError = null } = {}) {
  const states = ['qa@example.invalid', 'fictional-test-password', false, false, '', false, verification, '123456', false];
  const calls = { create: 0, prepare: 0, verify: 0, activate: 0, navigate: 0 };
  let index = 0;
  const signIn = {
    create: async () => { calls.create++; return attempt; },
    prepareSecondFactor: async params => { calls.prepare++; calls.strategy = params.strategy; },
    attemptSecondFactor: async () => { calls.verify++; if (verifyError) throw verifyError; return attempt; },
  };
  const jsx = (type, props) => ({ type, props });
  const flow = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/signInFlow.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, flow);
  const context = { exports: {}, require: name => {
    if (name === 'react') return { useState: () => { const slot = index++; return [states[slot], value => { states[slot] = value; }]; } };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@clerk/nextjs') return { SignIn: 'SecureSignIn', useSignIn: () => ({ isLoaded: loaded, signIn, setActive: async () => { calls.activate++; } }) };
    if (name === '@/lib/signInFlow') return flow.exports;
    if (name === 'next/navigation') return { useRouter: () => ({ replace: () => { calls.navigate++; }, refresh: () => {} }) };
    if (name === 'next/link' || name === 'next/image') return { default: name };
    throw new Error(`Unexpected import ${name}`);
  }};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/sign-in/[[...sign-in]]/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context);
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of [].concat(node.props?.children || [])) { const result = find(child, predicate); if (result) return result; }
    return null;
  }
  function render() { index = 0; return context.exports.default(); }
  return { calls, states, render, submit: async () => find(render(), n => n.type === 'form').props.onSubmit({ preventDefault() {} }) };
}

test('password flow requiring email verification prepares code and does not activate a session', async () => {
  const h = harness({ status: 'needs_second_factor', supportedSecondFactors: [{ strategy: 'email_code', emailAddressId: 'fictional-email-id' }] });
  await h.submit();
  assert.equal(h.calls.prepare, 1);
  assert.equal(h.states[6], 'email_code');
  assert.equal(h.states[1], '');
  assert.equal(h.calls.activate, 0);
  assert.equal(h.calls.navigate, 0);
});
test('completed verification activates only the provider-created test session', async () => {
  const h = harness({ status: 'complete', createdSessionId: 'mock-session', supportedSecondFactors: [] }, { verification: 'email_code' });
  await h.submit();
  assert.equal(h.calls.create, 0);
  assert.equal(h.calls.verify, 1);
  assert.equal(h.calls.activate, 1);
  assert.equal(h.calls.navigate, 1);
  assert.equal(h.states[7], '');
});
test('invalid verification displays error and never authenticates', async () => {
  const h = harness(null, { verification: 'email_code', verifyError: { errors: [{ message: 'Invalid code' }] } });
  await h.submit();
  assert.equal(h.states[4], 'Invalid code');
  assert.equal(h.calls.activate, 0);
  assert.equal(h.states[5], false);
});
test('unloaded authentication is visibly reported without request', async () => {
  const h = harness(null, { loaded: false });
  await h.submit();
  assert.match(h.states[4], /still loading/);
  assert.equal(h.calls.create, 0);
});
test('unsupported verification goes to secure provider UI without session activation', async () => {
  const h = harness({ status: 'needs_second_factor', supportedSecondFactors: [{ strategy: 'phone_code' }] });
  await h.submit();
  assert.equal(h.states[8], true);
  assert.equal(h.calls.activate, 0);
});
test('complete response without session cannot activate or silently succeed', async () => {
  const h = harness({ status: 'complete', createdSessionId: null, supportedSecondFactors: [] });
  await h.submit();
  assert.equal(h.calls.activate, 0);
  assert.match(h.states[4], /additional step/);
  assert.equal(h.states[8], true);
});
