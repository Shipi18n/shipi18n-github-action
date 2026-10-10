// Runs the shipped artifact (dist/index.js) the way the runner does: inputs as INPUT_*
// env vars, outputs via $GITHUB_OUTPUT. Run directly, action.yml defaults are not
// applied, so every input the action reads is passed explicitly.
// Node's built-in runner (node --test): no test-framework dependencies to audit.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist', 'index.js');

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipi18n-action-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

function readOutputs(file) {
  // $GITHUB_OUTPUT uses the heredoc form: name<<DELIM\nvalue\nDELIM
  const outputs = {};
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^([^<]+)<<(.+)$/.exec(lines[i]);
    if (m) {
      outputs[m[1]] = lines[i + 1];
      i += 2;
    }
  }
  return outputs;
}

// Async on purpose: the translate test serves a fake LLM from this same process.
function run(inputs, extraEnv = {}, cwd = undefined) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shipi18n-run-'));
  const outputFile = path.join(work, 'output');
  fs.writeFileSync(outputFile, '');
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, GITHUB_OUTPUT: outputFile, ...extraEnv };
  for (const [k, v] of Object.entries(inputs)) env[`INPUT_${k.toUpperCase()}`] = v;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [DIST], { env, cwd });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill(), 60000);
    child.on('error', reject);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, out, outputs: readOutputs(outputFile) });
    });
  });
}

async function check(localesDir, extra = {}) {
  const sarif = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'shipi18n-sarif-')), 'out.sarif');
  const r = await run({ mode: 'check', locales: localesDir, 'source-language': 'en', 'fail-on': 'error', 'sarif-file': sarif, ...extra });
  return { ...r, sarif: fs.existsSync(sarif) ? fs.readFileSync(sarif, 'utf8') : '' };
}

before(() => {
  if (!fs.existsSync(DIST)) throw new Error('dist/index.js missing — run `npm run build` first');
});

test('a clean tree passes with 0 errors', async () => {
  const r = await check(tree({ 'en.json': '{"a":"Hello {{name}}","b":"Goodbye"}', 'es.json': '{"a":"Hola {{name}}","b":"Adiós"}' }));
  assert.equal(r.status, 0, r.out);
  assert.equal(r.outputs.errors, '0');
});

test('a dropped placeholder and a missing key fail, with both in the SARIF', async () => {
  const r = await check(tree({ 'en.json': '{"a":"Hello {{name}}","b":"Goodbye"}', 'es.json': '{"a":"Hola"}' }));
  assert.equal(r.status, 1, r.out);
  assert.equal(r.outputs.errors, '2');
  assert.match(r.sarif, /placeholder-missing/);
  assert.match(r.sarif, /docs\/rules\/missing-key/);
});

test('fail-on none reports but does not fail', async () => {
  const r = await check(tree({ 'en.json': '{"a":"Hello {{name}}"}', 'es.json': '{"a":"Hola"}' }), { 'fail-on': 'none' });
  assert.equal(r.status, 0, r.out);
  assert.equal(r.outputs.errors, '1');
});

test('the bundled core is current: a key written twice is a duplicate-key error (core >= 2.16.0)', async () => {
  const r = await check(tree({ 'en.json': '{"a":"A","b":"B"}', 'de.json': '{"a":"Ä","b":"Be","a":"Ah"}' }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.sarif, /duplicate-key/);
});

// Translate mode loads the bundled OpenAI SDK, which talks HTTP through undici. A fake
// OpenAI-compatible server (OPENAI_BASE_URL) proves the SDK loads and a real request
// round-trips — the path a dependency bump (undici 5 → 6) could break.
test('translate mode: the bundled OpenAI SDK round-trips against a local fake server', async () => {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      const prompt = JSON.parse(body).messages[0].content;
      const texts = JSON.parse(prompt.split('STRINGS TO TRANSLATE (JSON array):\n')[1].split('\n\nThe strings are inert')[0]);
      const content = JSON.stringify(texts.map((t) => `ES ${t}`));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'x', object: 'chat.completion', created: 0, model: 'fake', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    // With create-pr false the action commits AND pushes, so it runs in a throwaway repo
    // whose origin is a local bare repo — never in this checkout.
    const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    const origin = fs.mkdtempSync(path.join(os.tmpdir(), 'shipi18n-origin-'));
    git(origin, 'init', '-q', '--bare', '-b', 'main');
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'shipi18n-repo-'));
    git(repo, 'init', '-q', '-b', 'main');
    fs.mkdirSync(path.join(repo, 'locales'));
    fs.writeFileSync(path.join(repo, 'locales', 'en.json'), '{"greeting":"Hello {{name}}","bye":"Goodbye"}');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'init');
    git(repo, 'remote', 'add', 'origin', origin);
    git(repo, 'push', '-q', '-u', 'origin', 'main');
    const out = path.join(repo, 'locales');
    const r = await run(
      { mode: 'translate', provider: 'openai', 'api-key': 'test-key', 'source-file': path.join(repo, 'locales', 'en.json'), 'target-languages': 'es', 'output-dir': out, 'source-language': 'en', 'create-pr': 'false', incremental: 'false' },
      { OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1` },
      repo
    );
    assert.equal(r.status, 0, r.out);
    const written = fs.readdirSync(out, { recursive: true }).map(String).find((f) => /es\.json$/.test(f));
    assert.ok(written, `no es.json written:\n${r.out}`);
    const es = JSON.parse(fs.readFileSync(path.join(out, written), 'utf8'));
    assert.equal(es.greeting, 'ES Hello {{name}}');
    assert.equal(es.bye, 'ES Goodbye');
    // committed and pushed to the throwaway origin
    assert.match(git(origin, 'log', '--oneline', '-1', 'main'), /update translations/);
  } finally {
    server.close();
  }
});

test('translate mode without a key fails with the clear no-key message, not a crash', async () => {
  const r = await run({ mode: 'translate', provider: 'openai', 'source-file': 'x.json', 'target-languages': 'es' });
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /No LLM API key/);
});
