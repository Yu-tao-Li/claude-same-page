import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Findings show rule/path/line only. Never print a matched secret.
const tracked = process.argv.includes('--tracked');
const history = process.argv.includes('--history');
const commits = history ? execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean) : [];
const files = history ? commits.flatMap(commit => execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', commit], { encoding: 'utf8' }).split('\0').filter(Boolean).map(file => ({ file, commit }))) :
  (tracked ? execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean) : walk('.')).map(file => ({ file }));
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules'].includes(entry.name)) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['anthropic-token', /\bsk-ant-[A-Za-z0-9_-]{16,}\b/],
  ['openai-token', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/],
  ['credential-value', /["'](?:accessToken|refreshToken|clientSecret|apiKey)["']\s*:\s*["'][^"']{12,}["']/],
  ['bearer-token', /Bearer\s+[A-Za-z0-9._-]{24,}/],
  ['personal-windows-path', /[A-Za-z]:\\(?:Users\\(?!you\b|USER\b|example\b)[^\\\s"']+|ClaudeProfiles|ClaudeChat)/i],
  ['personal-email', /\b[A-Za-z0-9._%+-]+@(?:gmail\.com|foxmail\.com|outlook\.com|qq\.com)\b/i]
];
let findings = 0;
for (const { file, commit } of files) {
  if (/(?:^|[\\/])(?:\.credentials\.json|\.claude\.json|history\.jsonl|statusline-usage\.json|\.env(?:\..*)?|[^/\\]+\.pem|[^/\\]+\.key)$/.test(file) || /(?:^|[\\/])(?:profiles|shared)[\\/]/.test(file)) {
    console.error(`credential-path: ${file}`); findings++; continue;
  }
  if (/\.(png|gif|jpg|webp|ico|zip|tgz)$/.test(file)) continue;
  const text = commit ? execFileSync('git', ['show', `${commit}:${file}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }) : fs.readFileSync(file, 'utf8');
  for (const [index, line] of text.split(/\r?\n/).entries()) for (const [name, rule] of rules) {
    if (rule.test(line)) { console.error(`${name}: ${file}:${index + 1}`); findings++; }
  }
}
console.log(JSON.stringify({ scope: history ? 'all-reachable-commit-files' : tracked ? 'git-tracked-files' : 'working-tree-files', commits: commits.length, files: files.length, findings }));
if (findings) process.exitCode = 1;
