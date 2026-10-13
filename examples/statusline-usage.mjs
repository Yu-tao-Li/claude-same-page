// Optional Claude Code status line. Copy this standalone file into EACH
// profile's config directory and point that profile's settings.json at it.
// Only stdin rate_limits and this script's sibling cache are used. No network,
// credential reads, external packages, or writes to the shared projects store.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const cache = path.join(root, 'statusline-usage.json');
const keys = ['five_hour', 'seven_day'];
const valid = value => value && typeof value.used_percentage === 'number' &&
  Number.isFinite(value.used_percentage) && value.used_percentage >= 0 &&
  typeof value.resets_at === 'number' && Number.isFinite(value.resets_at) &&
  value.resets_at >= 0 && value.resets_at <= 8.64e12;
const clean = value => ({ used_percentage: value.used_percentage, resets_at: value.resets_at });

function readCache() {
  let fd;
  try {
    const stat = fs.lstatSync(cache);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) throw new Error();
    fd = fs.openSync(cache, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev) throw new Error();
    const buffer = Buffer.alloc(64 * 1024 + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > 64 * 1024) throw new Error();
    const value = JSON.parse(buffer.subarray(0, length).toString('utf8').replace(/^\uFEFF/, ''));
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        keys.some(key => Object.hasOwn(value, key) && !valid(value[key]))) throw new Error();
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error('Cache unavailable'); // Never echo file contents or parser errors.
  } finally { if (fd !== undefined) fs.closeSync(fd); }
}

let input = '';
let bytes = 0;
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  bytes += Buffer.byteLength(chunk);
  if (bytes <= 1024 * 1024) input += chunk;
});
process.stdin.on('end', () => {
  let temp;
  try {
    const stat = fs.lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || bytes > 1024 * 1024) throw new Error();
    const data = JSON.parse(input);
    const old = readCache();
    const keep = {};
    let received = false;
    const parts = [];
    for (const [index, key] of keys.entries()) {
      const live = valid(data?.rate_limits?.[key]) ? clean(data.rate_limits[key]) : null;
      const previous = valid(old[key]) ? clean(old[key]) : null;
      received ||= Boolean(live);
      let best = live || previous;
      if (live && previous) {
        best = live.resets_at === previous.resets_at
          ? (live.used_percentage >= previous.used_percentage ? live : previous)
          : (live.resets_at > previous.resets_at ? live : previous);
      }
      if (!best) continue;
      keep[key] = best;
      const expired = best.resets_at * 1000 <= Date.now();
      parts.push(`${index ? '7d' : '5h'} ${live && best === live ? '' : '~'}${best.used_percentage}% used${expired ? ' (reset passed)' : ''}`);
    }
    // Idle updates never create/refresh a cache. mtime means file update time,
    // not the time the server measured usage. Retain old observations as old.
    if (received && JSON.stringify(keep) !== JSON.stringify(old)) {
      const candidate = path.join(root, `.statusline-usage-${randomUUID()}.tmp`);
      const fd = fs.openSync(candidate, 'wx', 0o600);
      temp = candidate; // Ownership starts only after exclusive creation succeeds.
      try { fs.writeFileSync(fd, `${JSON.stringify(keep)}\n`); }
      finally { fs.closeSync(fd); }
      fs.renameSync(temp, cache);
      temp = undefined;
    }
    console.log(parts.length ? parts.join(' | ') : 'Usage unavailable: waiting for rate_limits');
  } catch {
    console.log('Usage unavailable: check status line input/cache');
  } finally {
    // Only this invocation's newly created temporary file can be removed.
    if (temp) { try { fs.unlinkSync(temp); } catch {} }
  }
});
