import fs from 'node:fs';
import path from 'node:path';
import { init, add, home, load, mutate, save, selectProfile, verifyProfile, runLockPath, exists, unlockStale } from './store.mjs';
import { launch, resolveClaude } from './launcher.mjs';
import { usageReport, formatUsage } from './usage.mjs';

const help = `Claude Same Page · switch accounts, keep the conversation

  csp init [--workspace DIR] [--shared-projects DIR]
  csp add NAME [--config DIR]     Create or adopt a profile
  csp login NAME                 Sign in with Claude's own login
  csp use NAME                   Set the default profile
  csp list                       Show profiles (no credential reads)
  csp usage [NAME] [--json]       Read per-profile usage caches offline
  csp run [NAME] -- [ARGS]        Launch; forward Claude arguments
  csp continue [NAME] -- [ARGS]   Continue this workspace's latest session
  csp resume [NAME] [SESSION]     Open picker or resume an exact session
  csp doctor [--json]            Inspect links, executable, and locks
  csp unlock --stale             Remove a verified dead-process lock

Close the old Claude session before switching. Shared data is local.
Node >=22 · no runtime dependencies · https://github.com/Yu-tao-Li/claude-same-page`;

function options(args, names) {
  const output = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!names.includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid option: ${key}`);
    if (Object.hasOwn(output, key)) throw new Error(`Duplicate option: ${key}`);
    output[key] = args[++i];
  }
  return output;
}
function doctor(state) {
  const checks = [];
  const check = (name, callback) => {
    try { checks.push({ name, ok: true, detail: callback() }); }
    catch (error) { checks.push({ name, ok: false, detail: error.message }); }
  };
  check('claude executable', resolveClaude);
  for (const [name, profile] of Object.entries(state.profiles)) {
    check(`profile ${name}`, () => { verifyProfile(profile, state); return 'projects points to the shared directory'; });
  }
  if (!Object.keys(state.profiles).length) checks.push({ name: 'profiles', ok: false, detail: 'Add a profile with csp add.' });
  check('shared writer lock', () => exists(runLockPath(state)) ? 'present: a wrapper is running, or a crash left a lock' : 'free');
  check('registry lock', () => exists(path.join(home(), '.registry.lock')) ? 'present' : 'free');
  return { ok: checks.every(item => item.ok), sharedProjects: state.sharedProjects, workspace: state.workspace || 'current directory', checks };
}
export async function main(argv) {
  const [command, ...args] = argv;
  if (!command || ['help', '--help', '-h'].includes(command)) { console.log(help); return; }
  if (['--version', 'version'].includes(command)) { console.log('0.2.0'); return; }
  if (command === 'init') {
    const flags = options(args, ['--workspace', '--shared-projects']);
    const state = init({ workspace: flags['--workspace'], sharedProjects: flags['--shared-projects'] });
    console.log(`Initialized Same Page.\nShared projects: ${state.sharedProjects}\nNext: csp add personal`); return;
  }
  if (command === 'add') {
    const [name, ...rest] = args;
    const flags = options(rest, ['--config']);
    const profile = await add(name || '', flags['--config']);
    console.log(`Added ${name}.\nProfile: ${profile.configDir}\nNext: csp login ${name}`); return;
  }
  if (command === 'use') {
    if (args.length !== 1) throw new Error('Usage: csp use NAME');
    await mutate(state => { selectProfile(state, args[0]); state.defaultProfile = args[0]; save(state); });
    console.log(`Default profile: ${args[0]}`); return;
  }
  const state = load();
  if (command === 'usage') {
    const names = args.filter(value => value !== '--json');
    if (names.length > 1 || names.some(value => value.startsWith('-')) || args.filter(value => value === '--json').length > 1) {
      throw new Error('Usage: csp usage [NAME] [--json]');
    }
    const report = usageReport(state, names[0]);
    console.log(args.includes('--json') ? JSON.stringify(report, null, 2) : formatUsage(report));
    process.exitCode = report.profiles.every(row => row.status === 'ok') ? 0 : 1; return;
  }
  if (command === 'list') {
    if (args.length) throw new Error('Usage: csp list');
    for (const [name, profile] of Object.entries(state.profiles)) console.log(`${name === state.defaultProfile ? '*' : ' '} ${name}\t${profile.configDir}`);
    return;
  }
  if (command === 'doctor') {
    if (args.length && (args.length !== 1 || args[0] !== '--json')) throw new Error('Usage: csp doctor [--json]');
    const report = doctor(state);
    console.log(args.includes('--json') ? JSON.stringify(report, null, 2) : report.checks.map(item => `${item.ok ? 'OK' : 'FAIL'}  ${item.name}: ${item.detail}`).join('\n'));
    process.exitCode = report.ok ? 0 : 1; return;
  }
  if (command === 'unlock') {
    if (args.length !== 1 || args[0] !== '--stale') throw new Error('Usage: csp unlock --stale');
    const files = [path.join(home(), '.registry.lock'), runLockPath(state)].filter(exists);
    for (const file of files) unlockStale(file);
    console.log(files.length ? 'Verified stale locks removed.' : 'No locks present.'); return;
  }
  if (['run', 'continue', 'resume', 'login'].includes(command)) {
    const separator = args.indexOf('--');
    const positions = separator < 0 ? args : args.slice(0, separator);
    const forwarded = separator < 0 ? [] : args.slice(separator + 1);
    const max = command === 'resume' ? 2 : 1;
    if (positions.length > max || positions.some(value => value.startsWith('-'))) throw new Error(`Use csp ${command} [NAME] -- [CLAUDE ARGS].`);
    if (command === 'login' && !positions[0]) throw new Error('Usage: csp login NAME');
    const claudeArgs = command === 'continue' ? ['--continue', ...forwarded] :
      command === 'resume' ? ['--resume', ...positions.slice(1), ...forwarded] :
      command === 'login' ? ['auth', 'login', ...forwarded] : forwarded;
    process.exitCode = await launch(state, positions[0], claudeArgs); return;
  }
  throw new Error(`Unknown command: ${command}. Run csp help.`);
}
