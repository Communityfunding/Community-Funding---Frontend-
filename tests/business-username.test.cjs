const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/businessUsername.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const generate = context.exports.defaultBusinessUsername;
const id = 'b2b3edf3-5482-4b5e-afed-18822b0ac9ec';
test('UUID default fits exact 30-character profile schema', () => {
  const username = generate(id);
  assert.equal(username.length, 30);
  assert.match(username, /^[a-z_]+$/);
});
test('UUID formatting/case produces the same default', () => assert.equal(generate(id), generate(id.replaceAll('-', '').toUpperCase())));
test('different business identifiers produce distinct defaults', () => assert.notEqual(generate(id), generate('a2b3edf3-5482-4b5e-afed-18822b0ac9ec')));
test('malformed identifier is rejected rather than used as a username', () => {
  for (const invalid of ['', 'other-account', 'user_fake', '123']) assert.throws(() => generate(invalid));
});
