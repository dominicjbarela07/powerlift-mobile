#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scanRoots = ['app', 'components'];
const exceptionRegister = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'ui-constitution-exceptions.json'), 'utf8'),
);
const allowedLiteralFiles = new Set([
  'constants/theme.ts',
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const patterns = {
  colors: /#[0-9a-fA-F]{3,8}\b/g,
  radius: /borderRadius\s*:\s*\d+/g,
  fontSize: /fontSize\s*:\s*\d+/g,
  shadow: /\b(?:shadowColor|shadowOpacity|shadowRadius|shadowOffset|elevation)\s*:/g,
};

const rows = [];
for (const scanRoot of scanRoots) {
  for (const file of walk(path.join(root, scanRoot))) {
    const relative = path.relative(root, file);
    if (allowedLiteralFiles.has(relative)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const counts = Object.fromEntries(
      Object.entries(patterns).map(([name, pattern]) => [name, (source.match(pattern) || []).length]),
    );
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (total) rows.push({ file: relative, total, ...counts });
  }
}

rows.sort((a, b) => b.total - a.total || a.file.localeCompare(b.file));
console.log('Strength Ledger mobile UI constitution drift report');
console.log('This command reports existing drift; it does not mutate files.');
console.table(rows);
console.log(`Files with raw visual literals: ${rows.length}`);
const rawTotal = rows.reduce((sum, row) => sum + row.total, 0);
console.log(`Total raw visual literals: ${rawTotal}`);

const countKeys = Object.keys(patterns);
const mismatches = [];
for (const row of rows) {
  const reviewed = exceptionRegister[row.file];
  if (!reviewed) {
    mismatches.push({ file: row.file, issue: 'unreviewed literals', actual: row.total, expected: 0 });
    continue;
  }
  for (const key of countKeys) {
    if (row[key] !== reviewed[key]) {
      mismatches.push({ file: row.file, issue: key, actual: row[key], expected: reviewed[key] });
    }
  }
  if (!reviewed.reason || !reviewed.reason.trim()) {
    mismatches.push({ file: row.file, issue: 'missing reason', actual: row.total, expected: row.total });
  }
}

for (const [file, reviewed] of Object.entries(exceptionRegister)) {
  if (!rows.some((row) => row.file === file)) {
    mismatches.push({
      file,
      issue: 'stale exception entry',
      actual: 0,
      expected: countKeys.reduce((sum, key) => sum + reviewed[key], 0),
    });
  }
}

console.log(`Reviewed justified exceptions: ${rawTotal}`);
console.log(`Unreviewed or changed findings: ${mismatches.length}`);
if (mismatches.length) {
  console.table(mismatches);
  process.exitCode = 1;
}
