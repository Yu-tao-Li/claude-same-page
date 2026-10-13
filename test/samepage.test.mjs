import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'claude-samepage.mjs');
function sandbox() {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'samepage-test-'));
  const workspace = path.join(dir, 'workspace with spaces');
  fs.mkdirSync(workspace);
  const env = { ...process.env, CSP_HOME: path.join(dir, 'state'), CSP_CLAUDE_BIN: process.execPath };
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN',
    'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'ANTHROPIC_BASE_URL']) delete env[key];
  const call = (...args) => spawnSync(process.execPath, [bin, ...args], { env, cwd: workspace, encoding: 'utf8' });
  assert.equal(call('init', '--workspace', workspace).status, 0);
  const state = () => JSON.parse(fs.readFileSync(path.join(env.CSP_HOME, 'config.json'), 'utf8'));
  return { dir, workspace, env, call, state };
}
const snapshot = dir => fs.readdirSync(dir).map(name => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);

test('profiles share the exact transcript/memory files and leave credentials separate', () => {
  const box = sandbox();
  assert.equal(box.call('add', 'personal').status, 0);
  assert.equal(box.call('add', 'work').status, 0);
  const state = box.state();
  const a = state.profiles.personal.configDir;
  const b = state.profiles.work.configDir;
  fs.writeFileSync(path.join(a, '.credentials.json'), '{"fixture":"personal"}');
  fs.writeFileSync(path.join(b, '.credentials.json'), '{"fixture":"work"}');
  const project = path.join(a, 'projects', 'synthetic-project');
  // Create fixture directories at the canonical target. Writes/readback below
  // exercise both profile links; recursive mkdir through a junction differs
  // between Windows filesystem APIs.
  fs.mkdirSync(path.join(state.sharedProjects, 'synthetic-project', 'memory'), { recursive: true });
  fs.writeFileSync(path.join(project, 'session.jsonl'), '{"type":"user","fixture":true}\n');
  fs.writeFileSync(path.join(project, 'memory', 'MEMORY.md'), 'Use synthetic fixtures.');
  assert.equal(fs.readFileSync(path.join(b, 'projects', 'synthetic-project', 'memory', 'MEMORY.md'), 'utf8'), 'Use synthetic fixtures.');
  fs.appendFileSync(path.join(b, 'projects', 'synthetic-project', 'session.jsonl'), '{"type":"assistant","fixture":true}\n');
  assert.equal(fs.readFileSync(path.join(project, 'session.jsonl'), 'utf8').split('\n').filter(Boolean).length, 2);
  assert.notEqual(fs.readFileSync(path.join(a, '.credentials.json'), 'utf8'), fs.readFileSync(path.join(b, '.credentials.json'), 'utf8'));
});

test('existing populated projects are refused without changing any file', () => {
  const box = sandbox();
  const profile = path.join(box.dir, 'existing');
  fs.mkdirSync(path.join(profile, 'projects'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'projects', 'keep.txt'), 'precious fixture');
  const before = snapshot(path.join(profile, 'projects'));
  const result = box.call('add', 'work', '--config', profile);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /preserved/);
  assert.deepEqual(snapshot(path.join(profile, 'projects')), before);
  assert.deepEqual(box.state().profiles, {});
});

test('adopt a canonical projects directory and an existing shared link', () => {
  const box = sandbox();
  const primary = path.join(box.dir, 'primary');
  const second = path.join(box.dir, 'second');
  const projects = path.join(primary, 'projects');
  fs.mkdirSync(projects, { recursive: true });
  fs.mkdirSync(second);
  fs.writeFileSync(path.join(projects, 'keep.txt'), 'unchanged');
  fs.symlinkSync(projects, path.join(second, 'projects'), process.platform === 'win32' ? 'junction' : 'dir');
  const adoptedEnv = { ...box.env, CSP_HOME: path.join(box.dir, 'adopt-state') };
  const call = (...args) => spawnSync(process.execPath, [bin, ...args], { env: adoptedEnv, encoding: 'utf8' });
  assert.equal(call('init', '--shared-projects', projects).status, 0);
  assert.equal(call('add', 'one', '--config', primary).status, 0);
  assert.equal(call('add', 'two', '--config', second).status, 0);
  assert.equal(fs.readFileSync(path.join(projects, 'keep.txt'), 'utf8'), 'unchanged');
});

test('argument boundaries, child environment, workspace and exit status survive launch', () => {
  const box = sandbox();
  box.call('add', 'one');
  const probe = path.join(box.dir, 'probe.mjs');
  fs.writeFileSync(probe, 'console.log(JSON.stringify({cwd:process.cwd(), config:process.env.CLAUDE_CONFIG_DIR, args:process.argv.slice(2)})); process.exit(7);');
  const weird = 'a b "quoted" & echo unsafe | $(nope) %PATH% 中文';
  const result = box.call('run', 'one', '--', probe, weird, '--model', 'synthetic');
  assert.equal(result.status, 7);
  const row = JSON.parse(result.stdout);
  assert.deepEqual(row.args, [weird, '--model', 'synthetic']);
  assert.equal(row.cwd, box.workspace);
  assert.equal(row.config, box.state().profiles.one.configDir);
  assert.equal(fs.existsSync(path.join(box.state().sharedProjects, '.samepage-run.lock')), false);
});

test('auth overrides fail before starting Claude and never print their values', () => {
  const box = sandbox();
  box.call('add', 'one');
  box.env.ANTHROPIC_API_KEY = 'synthetic-secret-do-not-print';
  const result = box.call('run', 'one', '--', '--version');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ANTHROPIC_API_KEY/);
  assert.doesNotMatch(result.stderr, /synthetic-secret-do-not-print/);
});

test('tampered links and duplicate canonical profile roots are refused', () => {
  const box = sandbox();
  box.call('add', 'one');
  const config = box.state().profiles.one.configDir;
  assert.equal(box.call('add', 'two', '--config', config).status, 1);
  const link = path.join(config, 'projects');
  // This is a temporary fixture junction created by this test, never user data.
  fs.unlinkSync(link);
  fs.mkdirSync(link);
  const result = box.call('run', 'one', '--', '--version');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /link changed/);
});

test('default selection and malformed commands fail predictably', () => {
  const box = sandbox();
  box.call('add', 'one'); box.call('add', 'two');
  assert.equal(box.call('use', 'two').status, 0);
  assert.equal(box.state().defaultProfile, 'two');
  assert.equal(box.call('run', '--model', 'test').status, 1);
  assert.equal(box.call('add', '__proto__').status, 1);
  assert.equal(box.call('use', 'absent').status, 1);
  assert.equal(box.call('init').status, 1);
});

test('a live writer blocks launch/configuration and cannot be unlocked', async () => {
  const box = sandbox(); box.call('add', 'one');
  const probe = path.join(box.dir, 'wait.mjs');
  const ready = path.join(box.dir, 'ready');
  fs.writeFileSync(probe, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(ready)}, 'ready'); setTimeout(()=>{}, 2500);`);
  const child = spawn(process.execPath, [bin, 'run', 'one', '--', probe], { env: box.env, cwd: box.workspace, stdio: 'pipe' });
  const exited = new Promise(resolve => child.once('exit', resolve));
  const started = Date.now();
  while (!fs.existsSync(ready) && Date.now() - started < 5000) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(fs.existsSync(ready), 'fixture child started');
  assert.equal(box.call('run', 'one', '--', '--version').status, 1);
  assert.equal(box.call('add', 'two').status, 1);
  assert.equal(box.call('unlock', '--stale').status, 1);
  assert.equal(await exited, 0);
  assert.equal(box.call('run', 'one', '--', '--version').status, 0);
});

test('cross-registry launches share the same physical writer lock', () => {
  const box = sandbox(); box.call('add', 'one');
  const lock = path.join(box.state().sharedProjects, '.samepage-run.lock');
  fs.writeFileSync(lock, JSON.stringify({ host: os.hostname(), pid: process.pid, nonce: 'synthetic' }));
  const otherEnv = { ...box.env, CSP_HOME: path.join(box.dir, 'other-state') };
  const initResult = spawnSync(process.execPath, [bin, 'init', '--shared-projects', box.state().sharedProjects], { env: otherEnv, encoding: 'utf8' });
  assert.equal(initResult.status, 0);
  const addResult = spawnSync(process.execPath, [bin, 'add', 'two'], { env: otherEnv, encoding: 'utf8' });
  assert.equal(addResult.status, 1);
  assert.equal(fs.existsSync(lock), true);
});

test('resume and continue forward the intended Claude flags', async () => {
  const { main } = await import('../src/cli.mjs');
  assert.equal(typeof main, 'function');
  const box = sandbox(); box.call('add', 'one');
  // Node interprets these unknown Claude flags and prints them, proving dispatch.
  assert.match(box.call('continue', 'one').stderr, /--continue/);
  assert.match(box.call('resume', 'one', 'synthetic-session').stderr, /--resume/);
  assert.equal(fs.existsSync(path.join(box.state().sharedProjects, '.samepage-run.lock')), false);
});

test('stale recovery preserves live children, foreign hosts, and incomplete launches', async () => {
  const { unlockStale } = await import('../src/store.mjs');
  const box = sandbox();
  const file = path.join(box.dir, 'synthetic.lock');
  const cases = [
    { host: 'synthetic-other-host', pid: 99999999 },
    { host: os.hostname(), pid: 99999999, childPid: process.pid },
    { host: os.hostname(), pid: 99999999, childPid: null, launching: true }
  ];
  for (const record of cases) {
    const original = JSON.stringify(record);
    fs.writeFileSync(file, original);
    assert.throws(() => unlockStale(file));
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  }
  const probe = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  assert.equal(probe.status, 0);
  fs.writeFileSync(file, JSON.stringify({ host: os.hostname(), pid: probe.pid, launching: false }));
  unlockStale(file);
  assert.equal(fs.existsSync(file), false);
});

test('doctor never parses malformed credential files', () => {
  const box = sandbox(); box.call('add', 'one');
  fs.writeFileSync(path.join(box.state().profiles.one.configDir, '.credentials.json'), 'invalid-json synthetic-private-content');
  const result = box.call('doctor', '--json');
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).ok, true);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private-content/);
});

test('profiles and workspaces cannot be embedded in the shared store', () => {
  const box = sandbox();
  const result = box.call('add', 'nested', '--config', path.join(box.state().sharedProjects, 'bad-profile'));
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(path.join(box.state().sharedProjects, 'bad-profile')), false);
});
