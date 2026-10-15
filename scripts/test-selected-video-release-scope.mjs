import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertSelectedVideoBaseline, assertClientFixScope } from './owner-directed-client-fix.mjs';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'selected-video-scope-'));
try {
  const write = (file, data) => { const bytes = JSON.stringify(data); fs.writeFileSync(path.join(root, file), bytes); return { path:file, sha256:sha(bytes) }; };
  const baseline = { 'assets/approved.png':'original', 'app/(tabs)/workout/[workoutId].tsx':'prior' };
  const fingerprint = sha(JSON.stringify(Object.entries(baseline).sort(([a],[b]) => a.localeCompare(b))));
  const proof = { gateC:write('gate.json', {pass:true,missing:[],candidateProductFingerprint:fingerprint,published:{id:'verified-3',gitCommitHash:'same-source',servedBundleSha256:'bundle'}}), assetAudit:write('audit.json',{pass:true,missingOrCorrupt:0,updateId:'verified-3',servedLaunchSha256:'bundle'}) };
  const state = {currentTestFlight:{id:'current-2',gitCommitHash:'same-source'},verifiedProduction3VideoArchiveAccess:{publishedProof:proof}};
  const paths = ['app/(tabs)/workout/[workoutId].tsx','components/workout-logger/core-loggers.tsx','components/workout-logger/selected-set-video-preview.tsx','components/workout-logger/set-entry-video.tsx','config/protected-fix-manifest.json','lib/set-video-upload-status.ts','lib/videoUploadQueue.ts'];
  const files = {...baseline,...Object.fromEntries(paths.map(file => [file,'after']))};
  const ownerInstruction = 'Good, please ship it. If the validation passes for 3.0, ship it for both 3.0 and 2.1, please.';
  const scope = {scope:'set-entry-video-preview-20261014',ownerInstruction,validation:'OWNER_DIRECTED_CONTRACTS_ONLY',productFingerprint:'candidate',baselineUpdateId:'current-2',baselineSourceSha:'same-source',baselineProductFingerprint:fingerprint,baselineFiles:write('baseline.json',baseline),changedProductFiles:Object.fromEntries(paths.map(file => [file,'after'])),contracts:Object.fromEntries(['scripts/test-selected-set-video-preview.mjs','scripts/test-session-execution-ownership.mjs','scripts/test-set-entry-video.mjs'].map(file => [file,'hash']))};
  const changes = assertSelectedVideoBaseline({root,scope,state,files});
  assertClientFixScope(scope,'candidate',changes,ownerInstruction+' Preview before I even submit it');
  assert.throws(() => assertSelectedVideoBaseline({root,scope,state,files:{...files,'assets/approved.png':'missing-art'}}));
  assert.throws(() => assertSelectedVideoBaseline({root,scope,state,files:{...files,'lib/unrelated.ts':'hidden'}}));
  assert.throws(() => assertSelectedVideoBaseline({root,scope:{...scope,baselineSourceSha:'different'},state,files}));
  assert.throws(() => assertClientFixScope(scope,'different',changes,ownerInstruction));
  assert.throws(() => assertClientFixScope(scope,'candidate',changes,'invented signoff'));
  console.log('PASS: exact owner-approved selected video delta preserves verified cumulative baseline and rejects hidden changes, missing art, changed source and invented authority.');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
