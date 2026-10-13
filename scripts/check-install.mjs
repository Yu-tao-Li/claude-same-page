import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run through npm run check:install.');
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const temp = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'samepage-install-'));
const prefix = path.join(temp, 'installed');
execFileSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--pack-destination', temp], { stdio: 'pipe' });
const tarball = path.join(temp, `claude-samepage-${version}.tgz`);
execFileSync(process.execPath, [npm, 'install', '-g', tarball, '--prefix', prefix, '--ignore-scripts', '--no-audit', '--no-fund'], { stdio: 'pipe' });
const packageRoot = process.platform === 'win32' ? path.join(prefix, 'node_modules', 'claude-samepage') : path.join(prefix, 'lib', 'node_modules', 'claude-samepage');
const result = execFileSync(process.execPath, [path.join(packageRoot, 'bin', 'claude-samepage.mjs'), '--version'], { encoding: 'utf8' }).trim();
if (result !== version) throw new Error(`Installed version mismatch: ${result}`);
console.log(`Packed package installed and its executable returned ${version}.`);
