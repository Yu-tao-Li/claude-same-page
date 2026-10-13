import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 64 * 1024;
const KEYS = ['five_hour', 'seven_day'];
const messages = {
  missing: 'No cache yet. Configure a status line and complete a Claude response first.',
  invalid: 'Invalid cache. Expected numeric used_percentage and Unix-seconds resets_at.',
  oversized: 'Cache exceeds the 64 KiB limit.',
  unsafe: 'Profile root and cache must be real directories/files, not links.',
  unavailable: 'Cache could not be read. Check local permissions.',
  empty: 'Cache has no usage windows yet.'
};

function windowValue(value, now) {
  if (!value || typeof value.used_percentage !== 'number' || !Number.isFinite(value.used_percentage) ||
      value.used_percentage < 0 || typeof value.resets_at !== 'number' ||
      !Number.isFinite(value.resets_at) || value.resets_at < 0 || value.resets_at > 8.64e12) return null;
  return { used_percentage: value.used_percentage, resets_at: value.resets_at,
    resets_at_iso: new Date(value.resets_at * 1000).toISOString(), reset_passed: value.resets_at * 1000 <= now };
}

// Read exactly one bounded regular file. Never follow a cache link, read other
// profile files, or include arbitrary JSON fields/error contents in output.
export function readUsage(configDir, now = Date.now()) {
  let fd;
  const failure = status => ({ status, message: messages[status] });
  try {
    const root = fs.lstatSync(configDir);
    if (!root.isDirectory() || root.isSymbolicLink()) return failure('unsafe');
    const file = path.join(configDir, 'statusline-usage.json');
    const before = fs.lstatSync(file);
    if (!before.isFile() || before.isSymbolicLink()) return failure('unsafe');
    if (before.size > MAX_BYTES) return failure('oversized');
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino) return failure('unsafe');
    if (stat.size > MAX_BYTES) return failure('oversized');
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > MAX_BYTES) return failure('oversized');
    let parsed;
    try { parsed = JSON.parse(buffer.subarray(0, length).toString('utf8').replace(/^\uFEFF/, '')); }
    catch { return failure('invalid'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return failure('invalid');
    const windows = Object.fromEntries(KEYS.map(key => [key, windowValue(parsed[key], now)]));
    const invalid = KEYS.filter(key => Object.hasOwn(parsed, key) && !windows[key]);
    const count = Object.values(windows).filter(Boolean).length;
    const status = invalid.length ? (count ? 'partial' : 'invalid') : count ? 'ok' : 'empty';
    return { status, ...(messages[status] ? { message: messages[status] } : {}),
      cached_at: stat.mtime.toISOString(), age_seconds: Math.max(0, Math.floor((now - stat.mtimeMs) / 1000)),
      windows, ...(invalid.length ? { invalid_windows: invalid } : {}) };
  } catch (error) {
    return failure(error.code === 'ENOENT' ? 'missing' : error.code === 'ELOOP' ? 'unsafe' : 'unavailable');
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

export function usageReport(state, name, now = Date.now()) {
  if (name && !Object.hasOwn(state.profiles, name)) throw new Error('Unknown profile. Run csp list.');
  const entries = name ? [[name, state.profiles[name]]] : Object.entries(state.profiles);
  if (!entries.length) throw new Error('No registered profiles. Run csp add NAME first.');
  return { source: 'local-cache', offline: true, observed_at: new Date(now).toISOString(),
    profiles: entries.map(([profile, record]) => ({ profile, ...readUsage(record.configDir, now) })) };
}

export function formatUsage(report) {
  return ['Cached usage · offline · actual server limits may differ', ...report.profiles.map(row => {
    if (!row.windows) return `${row.profile}: ${row.status} — ${row.message}`;
    const windows = KEYS.map((key, index) => {
      const value = row.windows[key];
      return `${index ? '7d' : '5h'} ${value ? `${value.used_percentage}% used (reset ${value.resets_at_iso}${value.reset_passed ? '; reset time passed' : ''})` : 'unavailable'}`;
    });
    return `${row.profile}: ${windows.join(' | ')}\n  Cache file updated ${row.cached_at} · age ${row.age_seconds}s · ${row.status}`;
  })].join('\n');
}
