import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd(), fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-visual-policy-'));
try {
  for (const folder of ['app', 'components', 'dev-mocks']) if (fs.existsSync(folder)) fs.cpSync(folder, path.join(fixture, folder), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'scripts'));
  fs.mkdirSync(path.join(fixture, 'config'));
  fs.copyFileSync('config/protected-fix-manifest.json', path.join(fixture, 'config/protected-fix-manifest.json'));
  for (const folder of ['testflight-release-3-1-20261111', 'testflight-release-owner-evidence']) fs.cpSync(path.join('config', folder), path.join(fixture, 'config', folder), { recursive: true });
  fs.copyFileSync('scripts/reviewed-visual-progression.cjs', path.join(fixture, 'scripts/reviewed-visual-progression.cjs'));
  for (const file of ['audit-ui-constitution.js', 'audit-transparent-screen-roots.js', 'ui-constitution-exceptions.json', 'mobile-3-surface-owners.json']) fs.copyFileSync(path.join('scripts', file), path.join(fixture, 'scripts', file));
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  const run = script => spawnSync(process.execPath, [path.join(fixture, 'scripts', script)], { cwd: fixture, encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
  for (const script of ['audit-ui-constitution.js', 'audit-transparent-screen-roots.js']) {
    const positive = run(script); assert.equal(positive.status, 0, positive.stderr);
  }
  const file = path.join(fixture, 'components/education/AthleteEducationOpening.tsx');
  const original = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, original.replace('#D1C7D9', '#010203'));
  const color = run('audit-ui-constitution.js');
  assert.notEqual(color.status, 0, 'same-count unauthorized color substitution must fail');
  assert.match(color.stdout, /reviewed values changed/);
  fs.writeFileSync(file, original.replace("backgroundColor: '#05030A'", "backgroundColor: '#010203'"));
  const surface = run('audit-transparent-screen-roots.js');
  assert.notEqual(surface.status, 0, 'unregistered route/surface material must fail');
  assert.match(surface.stderr, /changed its reviewed 3.0 surface ownership/);
  fs.writeFileSync(file, original.replace("root: { flex: 1,", "root: { paddingHorizontal: 20, flex: 1,"));
  const gutter = run('audit-transparent-screen-roots.js');
  assert.notEqual(gutter.status, 0, 'unreviewed page gutter must fail');
  assert.match(gutter.stderr, /prohibited page-level inset/);
  fs.writeFileSync(file, original);
  const selfCoachFile = path.join(fixture, 'components/home/SelfCoachTrain.tsx');
  fs.appendFileSync(selfCoachFile, "\nconst hiddenVisualDrift = '#010203';\n");
  assert.notEqual(run('audit-ui-constitution.js').status, 0, 'reviewed Self-Coach source rejects an extra color');
  assert.notEqual(run('audit-transparent-screen-roots.js').status, 0, 'reviewed Self-Coach source rejects hidden root drift');
} finally { fs.rmSync(fixture, { recursive: true, force: true }); }
console.log('3.0 visual policy PASS: preserved surfaces accepted; same-count color replacement, altered canvas and extra page gutter rejected by actual audit CLIs.');
