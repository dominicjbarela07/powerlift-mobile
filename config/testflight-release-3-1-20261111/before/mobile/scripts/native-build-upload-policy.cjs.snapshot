const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// The owner requires preservation of approved imagery. Keep the ENTIRE assets
// tree; only Git history, development outputs and non-runtime review media leave
// the upload. Do not replace this policy with a broad assets/ exclusion.
const BASE_RULES = ['node_modules/', '.expo/', 'dist/', 'web-build/',
  'expo-env.d.ts', '.kotlin/', '*.orig.*', '*.jks', '*.p8', '*.p12', '*.key',
  '*.mobileprovision', '.metro-health-check*', 'npm-debug.*', 'yarn-debug.*',
  'yarn-error.*', '.DS_Store', '*.pem', '.env*.local', '*.tsbuildinfo',
  'app-example', '/ios', '/android'];
const UPLOAD_ONLY_RULES = ['/.git', '/artwork-review/candidates/',
  '/artwork-review/generation-attempts/', '/artwork-review/exports/',
  '/artwork-review/equipment-types/', '/artwork-review/.review.lock',
  '/artwork-review/.*.json*', '/docs/evidence/', '/docs/validation/',
  '/artifacts/', '/.pytest_cache/', '/.worktrees/'];
const OMIT_DIRECTORIES = ['.git', 'node_modules', '.expo', 'dist', 'web-build',
  '.kotlin', 'app-example', 'ios', 'android', 'artwork-review/candidates',
  'artwork-review/generation-attempts', 'artwork-review/exports',
  'artwork-review/equipment-types', 'docs/evidence', 'docs/validation',
  'artifacts', '.pytest_cache', '.worktrees'];
const REQUIRED_ROOTS = ['assets', 'app', 'components', 'constants', 'hooks',
  'lib', 'config', 'scripts', 'dev-mocks', 'context'];
const REQUIRED_FILES = ['package.json', 'package-lock.json', 'app.json',
  'app.config.js', 'eas.json', 'tsconfig.json', '.gitignore', '.easignore',
  'theme.ts', 'eslint.config.js',
  'artwork-review/runtime-policy.json', 'artwork-review/review-state.json'];
const MAX_SOURCE_BYTES = 1_900_000_000;
const MAX_UPLOAD_BYTES = 2_000_000_000;
const rules = text => text.split(/\r?\n/).map(s => s.trim())
  .filter(s => s && !s.startsWith('#'));

function assertUploadRules(ignoreText, gitignoreText) {
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!equal(rules(gitignoreText), BASE_RULES)) {
    throw new Error('NATIVE UPLOAD BLOCKED: changed Git ignore rules require packaging review.');
  }
  if (!equal(rules(ignoreText), [...BASE_RULES, ...UPLOAD_ONLY_RULES])) {
    throw new Error('NATIVE UPLOAD BLOCKED: upload exclusions changed; all runtime assets/source must remain included, and Git/review outputs must be excluded.');
  }
}

function assertUploadBudget(bytes, maximum = MAX_SOURCE_BYTES) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes >= maximum) {
    throw new Error(`NATIVE UPLOAD BLOCKED: ${bytes} bytes exceeds the safe ${maximum}-byte upload budget.`);
  }
}

function filesUnder(root, relative = '', omit = false) {
  const result = [];
  const walk = rel => {
    if (omit && OMIT_DIRECTORIES.includes(rel)) return;
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const name = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.name === '.DS_Store') continue; // Finder metadata is ignored by the preserved base rules.
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) result.push(name);
      else if (entry.isSymbolicLink()) {
        throw new Error(`NATIVE UPLOAD BLOCKED: review non-portable source symlink ${name}.`);
      }
    }
  };
  walk(relative);
  return result;
}

function assertNativeBuildUploadPolicy(root) {
  const read = name => fs.readFileSync(path.join(root, name), 'utf8');
  if (!fs.existsSync(path.join(root, '.easignore'))) {
    throw new Error('NATIVE UPLOAD BLOCKED: .easignore is missing; oversized Git/review uploads must not recur.');
  }
  assertUploadRules(read('.easignore'), read('.gitignore'));
  // Conservative upper bound: includes small ignored files too. A compressed
  // archive must still be measured separately before native build readiness.
  const sourceFiles = filesUnder(root, '', true);
  const sourceBytes = sourceFiles.reduce((n, file) => n + fs.statSync(path.join(root, file)).size, 0);
  assertUploadBudget(sourceBytes);
  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`NATIVE UPLOAD BLOCKED: required ${file} is missing.`);
  }
  return { result: 'PASS', conservativeSourceBytes: sourceBytes, files: sourceFiles.length };
}

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function assertNativeBuildArchive(root, archiveRoot, compressedBytes) {
  const policy = assertNativeBuildUploadPolicy(root);
  assertUploadBudget(compressedBytes, MAX_UPLOAD_BYTES);
  for (const dir of OMIT_DIRECTORIES) {
    // EAS can leave empty ignored directory entries; they contain no upload
    // payload. Git itself must be absent, including its directory entry.
    if (fs.existsSync(path.join(archiveRoot, dir))
        && (dir === '.git' || filesUnder(archiveRoot, dir).length > 0)) {
      throw new Error(`NATIVE UPLOAD BLOCKED: excluded ${dir} remains in actual archive.`);
    }
  }
  const required = [...new Set([...REQUIRED_FILES,
    ...REQUIRED_ROOTS.flatMap(dir => filesUnder(root, dir)),
    ...fs.readdirSync(path.join(root, 'artwork-review')).filter(f => f.endsWith('.json') && !f.startsWith('.'))
      .map(f => `artwork-review/${f}`)])];
  const failures = [];
  for (const file of required) {
    const actual = path.join(archiveRoot, file);
    if (!fs.existsSync(actual)) failures.push(`missing ${file}`);
    else if (hash(actual) !== hash(path.join(root, file))) failures.push(`changed ${file}`);
  }
  if (failures.length) throw new Error(`NATIVE UPLOAD BLOCKED: required runtime/source bytes lost: ${failures.join(', ')}`);
  return { ...policy, compressedBytes, verifiedRequiredFiles: required.length,
    verifiedAssetFiles: required.filter(f => f.startsWith('assets/')).length,
    missingOrChangedRequiredFiles: 0, gitAndReviewOutputsIncluded: false };
}

module.exports = { BASE_RULES, UPLOAD_ONLY_RULES, MAX_SOURCE_BYTES, MAX_UPLOAD_BYTES,
  assertUploadRules, assertUploadBudget, assertNativeBuildUploadPolicy, assertNativeBuildArchive };

if (require.main === module) {
  try {
    const [archiveRoot, compressedBytes] = process.argv.slice(2);
    const result = archiveRoot
      ? assertNativeBuildArchive(process.cwd(), archiveRoot, Number(compressedBytes))
      : assertNativeBuildUploadPolicy(process.cwd());
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
