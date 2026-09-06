import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { certifyCanonicalDevMetro } from './canonical-dev-metro-lineage.mjs';

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const host = option('--host', '127.0.0.1');
const output = option('--output');
const snapshot = await certifyCanonicalDevMetro(host);
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
if (output) writeFileSync(path.resolve(output), serialized, 'utf8');
console.log('[canonical-dev-metro] RUNTIME CERTIFICATION PASS');
console.log(serialized);
