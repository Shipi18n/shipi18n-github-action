// Runs the shipped artifact (dist/index.js) the way the runner does: inputs as INPUT_*
// env vars, outputs via $GITHUB_OUTPUT. Run directly, action.yml defaults are not
// applied, so every input the check reads is passed explicitly.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist', 'index.js');

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipi18n-action-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

function run(localesDir, extra = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shipi18n-run-'));
  const outputFile = path.join(work, 'output');
  const sarif = path.join(work, 'out.sarif');
  fs.writeFileSync(outputFile, '');
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    GITHUB_OUTPUT: outputFile,
    'INPUT_MODE': 'check',
    'INPUT_LOCALES': localesDir,
    'INPUT_SOURCE-LANGUAGE': 'en',
    'INPUT_FAIL-ON': 'error',
    'INPUT_SARIF-FILE': sarif,
    ...extra,
  };
  const res = spawnSync(process.execPath, [DIST], { env, encoding: 'utf8', timeout: 60000 });
  // $GITHUB_OUTPUT uses the heredoc form: name<<DELIM\nvalue\nDELIM
  const outputs = {};
  const lines = fs.readFileSync(outputFile, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^([^<]+)<<(.+)$/.exec(lines[i]);
    if (m) {
      outputs[m[1]] = lines[i + 1];
      i += 2;
    }
  }
  return { status: res.status, stdout: res.stdout + res.stderr, outputs, sarif: fs.existsSync(sarif) ? fs.readFileSync(sarif, 'utf8') : '' };
}

beforeAll(() => {
  if (!fs.existsSync(DIST)) throw new Error('dist/index.js missing — run `npm run build` first');
});

test('a clean tree passes with 0 errors', () => {
  const r = run(tree({ 'en.json': '{"a":"Hello {{name}}","b":"Goodbye"}', 'es.json': '{"a":"Hola {{name}}","b":"Adiós"}' }));
  expect(r.status).toBe(0);
  expect(r.outputs.errors).toBe('0');
});

test('a dropped placeholder and a missing key fail, with both in the SARIF', () => {
  const r = run(tree({ 'en.json': '{"a":"Hello {{name}}","b":"Goodbye"}', 'es.json': '{"a":"Hola"}' }));
  expect(r.status).toBe(1);
  expect(r.outputs.errors).toBe('2');
  expect(r.sarif).toContain('placeholder-missing');
  expect(r.sarif).toContain('docs/rules/missing-key');
});

test('fail-on none reports but does not fail', () => {
  const r = run(tree({ 'en.json': '{"a":"Hello {{name}}"}', 'es.json': '{"a":"Hola"}' }), { 'INPUT_FAIL-ON': 'none' });
  expect(r.status).toBe(0);
  expect(r.outputs.errors).toBe('1');
});

test('the bundled core is current: a key written twice is a duplicate-key error (core >= 2.16.0)', () => {
  const r = run(tree({ 'en.json': '{"a":"A","b":"B"}', 'de.json': '{"a":"Ä","b":"Be","a":"Ah"}' }));
  expect(r.status).toBe(1);
  expect(r.sarif).toContain('duplicate-key');
});
