import { spawnSync } from 'node:child_process';

const areas = [
  ['substitution authority', ['scripts/test-accessory-swap-session-gating.mjs']],
  ['canonical movement identity', ['scripts/test-accessory-identity-picker.mjs', 'scripts/test-movement-history-launch.mjs']],
  ['catalog authoring', ['scripts/test-accessory-catalog-review.mjs', 'scripts/test-governed-accessory-picker-layout.mjs']],
  ['individual movement artwork', ['scripts/test-individual-movement-artwork-hard-rule.mjs', 'scripts/test-session-workspace-accessory-artwork.mjs']],
  ['Session Logger shell', ['scripts/test-session-logger-shell-state.mjs', 'scripts/test-session-logger-three-zone-header.mjs']],
  ['equipment', ['scripts/test-equipment-gating-regression.mjs', 'scripts/test-equipment-usage-semantics.mjs', 'scripts/test-manufacturer-branding.mjs']],
  ['rich Plan / Compare', ['scripts/test-session-recap-plan-compare.mjs']],
  ['grouped PR coaching recognition', ['scripts/test-coach-home-activity-first.mjs']],
  ['global display-unit propagation', ['scripts/test-global-weight-unit-toggle.mjs', 'scripts/test-journey-unit-propagation.mjs']],
  ['immediate mode switching', ['scripts/test-mobile-mode-transition.mjs']],
  ['consolidated Week Programming Manager', ['scripts/test-mobile-programming-manager-consolidation.mjs', 'scripts/test-programming-week-copy-indexing.mjs', 'scripts/test-programming-session-swipe-hotfix.mjs']],
  ['movement-class strength metrics', ['scripts/test-accessory-strength-metric-policy.mjs']],
  ['Session Workspace composition', ['scripts/test-session-workspace-layout.mjs', 'scripts/test-programming-session-workspace-sheet.mjs']],
];

const failures = [];
for (const [area, scripts] of areas) {
  for (const script of scripts) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', script], {
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

console.log(`[release-critical-invariants] PASS — ${areas.length}/${areas.length} accepted product areas`);
