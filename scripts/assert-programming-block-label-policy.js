const fs = require('fs');
const path = require('path');

const sourcePath = path.join(process.cwd(), 'app', '(tabs)', 'workout', 'index.tsx');
const source = fs.readFileSync(sourcePath, 'utf8');

const match = source.match(/function blockTabLabel\(block: ProgramBlockPayload, index: number\) \{([\s\S]*?)\n\}/);

if (!match) {
  throw new Error('blockTabLabel helper was not found.');
}

const body = match[1];
const rawNameGuard = /const rawName = \(block\.name \|\| ''\)\.trim\(\);[\s\S]*if \(rawName\) return rawName;/.test(body);
const fallback = /return `Block \$\{Number\(block\.order_idx \|\| index\) \+ 1\}`;/.test(body);

if (!rawNameGuard) {
  throw new Error('blockTabLabel must return the actual block.name when it is present.');
}

if (!fallback) {
  throw new Error('blockTabLabel must keep a generic Block N fallback for unnamed blocks.');
}

console.log('Programming block label policy OK');
