import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

export const home = () => path.resolve(process.env.CSP_HOME || path.join(os.homedir(), '.claude-samepage'));
const stateFile = () => path.join(home(), 'config.json');
export function exists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
export function directory(dir) {
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) throw new Error(`Expected a directory: ${dir}`);
  return fs.realpathSync.native(dir);
}
export function equalPath(a, b) {
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  return normalize(path.resolve(a)) === normalize(path.resolve(b));
}
function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export function checkLayout(configDir, state) {
  if (isInside(state.sharedProjects, configDir) && !equalPath(state.sharedProjects, path.join(configDir, 'projects'))) {
    throw new Error('Shared projects may only be inside a profile as its projects/ directory.');
  }
  if (isInside(configDir, state.sharedProjects) || isInside(state.workspace || home(), state.sharedProjects)) {
    throw new Error('A profile or workspace cannot be inside shared projects.');
  }
  for (const profile of Object.values(state.profiles)) {
    if (isInside(configDir, profile.configDir) || isInside(profile.configDir, configDir)) {
      throw new Error('Profile directories must be distinct and must not contain one another.');
    }
  }
}
export function load() {
  if (!exists(stateFile())) throw new Error('Run csp init first.');
  const state = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  if (state.version !== 1 || !state.profiles || !path.isAbsolute(state.sharedProjects)) {
    throw new Error('Invalid Samepage configuration. Preserve the file and inspect it.');
  }
  return state;
}
export function save(state) {
  const temp = path.join(home(), `.config-${randomUUID()}.tmp`);
  fs.writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, stateFile());
}
export function acquireLock(file, detail = {}) {
  const record = { nonce: randomUUID(), host: os.hostname(), pid: process.pid, childPid: null,
    launching: false, startedAt: new Date().toISOString(), ...detail };
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Another Samepage operation owns the lock: ${file}. Close that session first. After a crash, inspect csp doctor and use csp unlock --stale.`);
  }
  function update(fields) {
    Object.assign(record, fields);
    fs.ftruncateSync(fd, 0);
    fs.writeSync(fd, `${JSON.stringify(record)}\n`, 0, 'utf8');
    fs.fsyncSync(fd);
  }
  update({});
  let released = false;
  return {
    update,
    release() {
      if (released) return;
      released = true;
      fs.closeSync(fd);
      // Remove only the exact temporary lock created by this process.
      try {
        if (JSON.parse(fs.readFileSync(file, 'utf8')).nonce === record.nonce) fs.unlinkSync(file);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  };
}
export const runLockPath = state => path.join(directory(state.sharedProjects), '.samepage-run.lock');
export async function mutate(callback) {
  const lock = acquireLock(path.join(home(), '.registry.lock'));
  try {
    const state = load();
    const sharedLock = acquireLock(runLockPath(state), { operation: 'configure' });
    try { return await callback(state); } finally { sharedLock.release(); }
  } finally { lock.release(); }
}
export function init({ workspace, sharedProjects } = {}) {
  if (exists(stateFile())) throw new Error('Already initialized. Existing configuration was preserved.');
  if (workspace) workspace = directory(path.resolve(workspace));
  const root = home();
  // Check provided paths before creating anything.
  if (exists(root) && fs.lstatSync(root).isSymbolicLink()) throw new Error('CSP_HOME must be a real directory.');
  const shared = path.resolve(sharedProjects || path.join(root, 'shared', 'projects'));
  if (workspace && isInside(workspace, shared)) throw new Error('Workspace cannot be inside shared projects.');
  if (equalPath(shared, root) || isInside(root, shared)) throw new Error('CSP_HOME cannot be inside shared projects.');
  if (sharedProjects) directory(shared); // Adoption requires an existing directory.
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const lock = acquireLock(path.join(root, '.registry.lock'));
  try {
    if (exists(stateFile())) throw new Error('Already initialized.');
    fs.mkdirSync(shared, { recursive: true, mode: 0o700 });
    save({ version: 1, workspace: workspace || null, sharedProjects: directory(shared), defaultProfile: null, profiles: {} });
  } finally { lock.release(); }
  return load();
}
export function verifyProfile(profile, state) {
  if (fs.lstatSync(profile.configDir).isSymbolicLink()) throw new Error('Profile root must be a real directory.');
  directory(profile.configDir);
  const projects = path.join(profile.configDir, 'projects');
  if (!equalPath(directory(projects), directory(state.sharedProjects))) {
    throw new Error(`Projects link changed for ${profile.configDir}; refusing to launch.`);
  }
  return projects;
}
export async function add(name, config) {
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name)) {
    throw new Error('Profile name: lowercase letter, then up to 31 lowercase letters, digits, _ or -.');
  }
  return mutate(state => {
    if (Object.hasOwn(state.profiles, name)) throw new Error(`Profile ${name} already exists.`);
    let configDir = path.resolve(config || path.join(home(), 'profiles', name));
    if (exists(configDir)) {
      if (fs.lstatSync(configDir).isSymbolicLink()) throw new Error('Profile root must be a real directory.');
      configDir = directory(configDir);
    }
    checkLayout(configDir, state);
    const projects = path.join(configDir, 'projects');
    if (exists(projects) && !equalPath(directory(projects), directory(state.sharedProjects))) {
      throw new Error(`Existing projects directory was preserved: ${projects}. Initialize with that directory as --shared-projects, or use a fresh profile. Samepage never merges or replaces it.`);
    }
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    configDir = directory(configDir);
    checkLayout(configDir, state);
    if (!exists(projects)) fs.symlinkSync(directory(state.sharedProjects), projects, process.platform === 'win32' ? 'junction' : 'dir');
    state.profiles[name] = { configDir };
    state.defaultProfile ||= name;
    save(state);
    return state.profiles[name];
  });
}
export function selectProfile(state, name) {
  name ||= state.defaultProfile;
  if (!name || !Object.hasOwn(state.profiles, name)) throw new Error(`Unknown profile ${name || '(none)'}. Run csp add <name>.`);
  const profile = state.profiles[name];
  verifyProfile(profile, state);
  return { ...profile, name };
}
export function unlockStale(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const record = JSON.parse(raw);
  if (record.host !== os.hostname()) throw new Error('Lock belongs to another host; inspect it manually.');
  if (record.launching && !record.childPid) throw new Error('Launch was interrupted before child PID was recorded; inspect running Claude processes manually.');
  for (const pid of [record.pid, record.childPid].filter(Boolean)) {
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid lock PID; inspect manually.');
    try { process.kill(pid, 0); throw new Error(`Process ${pid} is still alive; lock preserved.`); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  if (fs.readFileSync(file, 'utf8') !== raw) throw new Error('Lock changed during inspection; preserved.');
  fs.unlinkSync(file);
}
