import { spawnSync } from 'node:child_process';

const areas = [
  ['Coach Session Reviewer V3 evidence and shared tools', ['scripts/test-review-hub-canonical-parity.mjs']],
  ['Coach Check-Ins V2 command center and evidence lifecycle', ['scripts/test-coach-check-ins-v2.mjs']],
  ['substitution authority', ['scripts/test-accessory-swap-session-gating.mjs', 'scripts/test-superset-self-coach-swap-history.mjs']],
  ['canonical movement identity', ['scripts/test-accessory-identity-picker.mjs', 'scripts/test-movement-history-launch.mjs']],
  ['catalog authoring', ['scripts/test-accessory-catalog-review.mjs', 'scripts/test-governed-accessory-picker-layout.mjs']],
  ['individual movement artwork', ['scripts/test-individual-movement-artwork-hard-rule.mjs', 'scripts/test-session-workspace-accessory-artwork.mjs']],
  ['Session Logger shell', ['scripts/test-session-logger-shell-state.mjs', 'scripts/test-session-logger-three-zone-header.mjs']],
  ['canonical rest-timer lifecycle', ['scripts/test-rest-timer-zero-deadlock.mjs']],
  ['Session Logger performance, route, and resume ownership', ['scripts/test-session-logger-performance-contract.mjs', 'scripts/test-session-logger-resume-contract.mjs']],
  ['Session Logger request timeout ownership', ['scripts/test-session-logger-request-policy.mjs']],
  ['equipment', ['scripts/test-equipment-gating-regression.mjs', 'scripts/test-equipment-usage-semantics.mjs', 'scripts/test-manufacturer-branding.mjs', 'scripts/test-superset-equipment-context.mjs', 'scripts/test-machine-brand-keyboard-selection.mjs']],
  ['rich Plan / Compare', ['scripts/test-session-recap-plan-compare.mjs']],
  ['Coach Session review shared cross-tab tools', ['scripts/test-coach-session-review-cross-tab.mjs']],
  ['Coach Coming Up exact Session navigation', ['scripts/test-coach-home-coming-up-direct-open.mjs']],
  ['Coach Calendar direct filter controls', ['scripts/test-coach-calendar-v2.mjs']],
  ['relationship-scoped athlete coaching scratchpad', ['scripts/test-athlete-coaching-scratchpad.mjs']],
  ['movement-class strength metrics', ['scripts/test-accessory-strength-metric-policy.mjs']],
  ['immediate mode switching', ['scripts/test-mobile-mode-transition.mjs']],
  ['Settings account identity and mode parity', ['scripts/test-settings-account-parity.mjs']],
  ['grouped PR coaching recognition', ['scripts/test-coach-home-activity-first.mjs']],
  ['Team Brief coaching analytics and team-relative Athlete Workspace', ['scripts/test-team-brief-v2.mjs']],
  ['platform-wide analytical chart fidelity', ['scripts/test-chart-fidelity-standard.mjs', 'scripts/test-accessory-trend-axis-mode.mjs']],
  ['global display-unit propagation', ['scripts/test-global-weight-unit-toggle.mjs', 'scripts/test-journey-unit-propagation.mjs']],
  ['historical Ledger preservation', ['scripts/test-journey-historical-reconstruction.mjs', 'scripts/test-testflight-source-parity.mjs']],
  ['consolidated Week Programming Manager', ['scripts/test-mobile-programming-manager-consolidation.mjs', 'scripts/test-programming-week-copy-indexing.mjs', 'scripts/test-copy-week-ux-convergence.mjs', 'scripts/test-programming-session-swipe-hotfix.mjs', 'scripts/test-programming-manager-overlay-system.mjs']],
  ['Session Workspace composition and presentation-only units', ['scripts/test-session-workspace-layout.mjs', 'scripts/test-programming-session-workspace-sheet.mjs', 'scripts/test-session-workspace-unit-presentation.mjs']],
  ['Session Workspace dirty-state reorder transaction', ['scripts/test-session-workspace-dirty-reorder.mjs']],
  ['Session Workspace canonical accessory drilldown', ['scripts/test-session-workspace-accessory-picker.mjs']],
  ['Session Workspace Athlete View handoff', ['scripts/test-session-workspace-athlete-preview-handoff.mjs']],
  ['Athlete Training Hub Program Timeline navigation', ['scripts/test-program-timeline-v2.mjs']],
  ['visible control action reachability', ['scripts/test-major-visible-control-actions.mjs']],
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
