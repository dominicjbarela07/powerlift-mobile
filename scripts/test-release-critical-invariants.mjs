import { spawnSync } from 'node:child_process';

const areas = [
  ['authentication and password recovery', ['scripts/test-password-reset-system-browser.mjs']],
  ['Home and athlete Meet Plan navigation', ['scripts/test-meet-plan-visibility-contract.mjs']],
  ['core and accessory Session logging', ['scripts/test-production-android-accessory-recovery.mjs']],
  ['canonical accessory authoring and identity', [
    'scripts/test-production-canonical-accessory-hotfix.mjs',
    'scripts/test-catalog-canonical-identity-gate.mjs',
  ]],
  ['machine equipment and manufacturer selection', ['scripts/test-production-equipment-picker-hotfix.mjs']],
  ['movement substitution identity and evidence lock', [
    'scripts/test-production-canonical-movement-swap.mjs',
    'scripts/test-accessory-swap-session-gating.mjs',
  ]],
  ['Session completion time and duration', [
    'scripts/test-post-session-time-picker-hotfix.mjs',
    'scripts/test-session-timing-telemetry.mjs',
  ]],
  ['video upload compatibility', ['scripts/assert-video-upload-policy.js']],
  ['Core Variant authoring', ['scripts/assert-core-variant-creator-policy.js']],
  ['Production runtime and platform parity policy', ['scripts/test-production-release-policy.mjs']],
];

const failures = [];
for (const [area, scripts] of areas) {
  for (const script of scripts) {
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    if (result.status !== 0) {
      failures.push({ area, script, output: `${result.stdout || ''}${result.stderr || ''}`.trim() });
      break;
    }
  }
  console.log(`[release-critical-invariants] ${failures.at(-1)?.area === area ? 'FAIL' : 'PASS'} — ${area}`);
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`\n${failure.area}: ${failure.script}\n${failure.output}`);
  }
  process.exit(1);
}

console.log(`[release-critical-invariants] PASS — ${areas.length}/${areas.length} Production 2.0.2 areas`);
