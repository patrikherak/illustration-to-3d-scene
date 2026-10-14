import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const copyleft = /\b(A?GPL|LGPL|MPL|EPL|EUPL|CDDL|OSL|CC-BY-SA|SSPL)\b/i;
const knownLicenseHeadings = [
  [/^MIT License/i, 'MIT'],
  [/^ISC License/i, 'ISC'],
  [/^Apache License/i, 'Apache-2.0'],
  [/^BSD 3-Clause/i, 'BSD-3-Clause'],
  [/^BSD 2-Clause/i, 'BSD-2-Clause'],
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? join(root, readdirSync(root).find((name) => name.endsWith('-lock.json')) ?? '');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));

function licenseFromFile(packageDir) {
  if (!existsSync(packageDir)) return undefined;
  const file = readdirSync(packageDir).find((name) => /^licen[cs]e/i.test(name));
  if (!file) return undefined;
  const heading = readFileSync(join(packageDir, file), 'utf8').trim().split('\n')[0];
  const match = knownLicenseHeadings.find(([pattern]) => pattern.test(heading));
  return match ? `${match[1]} (from ${file})` : undefined;
}

const rows = Object.entries(lock.packages)
  .filter(([path]) => path.startsWith('node_modules/'))
  .map(([path, info]) => ({
    name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length),
    version: info.version,
    license: info.license ?? licenseFromFile(join(dirname(lockPath), path)) ?? 'UNKNOWN',
    scope: info.dev ? 'dev' : 'runtime',
    optional: Boolean(info.optional),
  }));

const byLicense = new Map();
for (const row of rows) {
  const key = `${row.license} (${row.scope})`;
  byLicense.set(key, [...(byLicense.get(key) ?? []), `${row.name}@${row.version}`]);
}
for (const [license, names] of [...byLicense].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${license}: ${names.length}`);
  if (process.argv.includes('--verbose')) console.log(`  ${names.join(', ')}`);
}

const flagged = rows.filter((row) => copyleft.test(row.license) || row.license === 'UNKNOWN');
if (flagged.length) {
  console.error('\nneeds review:');
  for (const row of flagged) console.error(`  ${row.name}@${row.version} ${row.license} ${row.scope}${row.optional ? ' optional' : ''}`);
  process.exit(1);
}
console.log(`\n${rows.length} dependencies, no copyleft licence`);
