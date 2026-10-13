import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { acquireLock, directory, runLockPath, selectProfile } from './store.mjs';

// Account-selecting environment values must not silently override the profile login.
const authOverrides = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY',
  'ANTHROPIC_BASE_URL'];

function commandFiles(name) {
  const locations = name.includes('/') || name.includes('\\') ? [path.resolve(name)] :
    (process.env.PATH || '').split(path.delimiter).filter(Boolean).flatMap(dir =>
      process.platform === 'win32' ? [path.join(dir, `${name}.exe`), path.join(dir, `${name}.cmd`), path.join(dir, name)] : [path.join(dir, name)]);
  return locations.filter(file => { try { return fs.statSync(file).isFile(); } catch { return false; } });
}
export function resolveClaude() {
  const requested = process.env.CSP_CLAUDE_BIN || 'claude';
  for (const file of commandFiles(requested)) {
    if (process.platform === 'win32' && /\.(cmd|bat|ps1)$/i.test(file)) {
      // npm's official Claude shim points to a native binary. Execute it directly;
      // never place prompts/flags into cmd.exe or PowerShell command text.
      const native = path.join(path.dirname(file), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
      if (fs.existsSync(native)) return native;
      continue;
    }
    return file;
  }
  throw new Error('Claude executable not found. Install Claude Code, or set CSP_CLAUDE_BIN to its native executable (not a shell shim).');
}
export function childEnvironment(profile) {
  const overrides = authOverrides.filter(key => process.env[key]);
  if (overrides.length) throw new Error(`Account-routing environment overrides are set: ${overrides.join(', ')}. Clear them before selecting a claude.ai profile.`);
  return { ...process.env, CLAUDE_CONFIG_DIR: profile.configDir };
}
export async function launch(state, name, args) {
  const profile = selectProfile(state, name);
  const cwd = directory(state.workspace || process.cwd());
  const env = childEnvironment(profile);
  const executable = resolveClaude();
  const lock = acquireLock(runLockPath(state), { operation: 'claude', profile: profile.name });
  let child;
  // Interactive Ctrl+C belongs to Claude. Keep the parent alive and the lock held
  // until the child exits. A second wrapper cannot write through the first one's lock.
  const keepAlive = () => {};
  process.on('SIGINT', keepAlive);
  const terminate = () => { if (child) child.kill('SIGTERM'); };
  process.on('SIGTERM', terminate);
  try {
    lock.update({ launching: true });
    child = spawn(executable, args, { cwd, env, stdio: 'inherit', shell: false });
    if (child.pid) lock.update({ childPid: child.pid });
    return await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 1)));
    });
  } finally {
    process.removeListener('SIGINT', keepAlive);
    process.removeListener('SIGTERM', terminate);
    lock.release();
  }
}
