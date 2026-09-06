import { spawnSync } from 'node:child_process';

const areas = [
  ['platform-wide mobile full-width layout', ['scripts/test-mobile-full-width-enforcement.mjs']],
  ['Athlete Meet Packet V2 lifecycle and operational toolkit', ['scripts/test-athlete-meet-packet-v2.mjs']],
  ['Coach Session Reviewer V3 evidence and shared tools', ['scripts/test-review-hub-canonical-parity.mjs']],
  ['canonical shared athlete and coach post-Session surface', ['scripts/test-canonical-post-session-surface.mjs', 'scripts/test-post-session-shell-restoration.mjs', 'scripts/test-post-session-overview-visual-convergence.mjs', 'scripts/test-post-session-times.mjs', 'scripts/test-post-session-related-history.mjs']],
  ['Coach Check-Ins V2 command center and evidence lifecycle', ['scripts/test-coach-check-ins-v2.mjs']],
  ['substitution authority', ['scripts/test-accessory-swap-session-gating.mjs', 'scripts/test-self-coached-accessory-swap-v2.mjs', 'scripts/test-superset-self-coach-swap-history.mjs']],
  ['canonical movement identity', ['scripts/test-accessory-identity-picker.mjs', 'scripts/test-movement-history-launch.mjs']],
  ['catalog authoring', ['scripts/test-accessory-catalog-review.mjs', 'scripts/test-governed-accessory-picker-layout.mjs']],
  ['individual movement artwork', ['scripts/test-individual-movement-artwork-hard-rule.mjs', 'scripts/test-session-workspace-accessory-artwork.mjs']],
  ['Swap and Session Workspace muscle drill-down anatomy', ['scripts/test-swap-muscle-thumbnail-framing.mjs']],
  ['Swap muscle-result equipment-type narrowing', ['scripts/test-swap-equipment-type-filter.mjs']],
  ['Session Logger shell', ['scripts/test-session-logger-shell-state.mjs', 'scripts/test-session-logger-three-zone-header.mjs', 'scripts/test-movement-lifecycle-status-layout.mjs', 'scripts/test-pre-session-accessory-last-best.mjs']],
  ['Smart Warmup lifecycle and physical configuration', ['scripts/test-smart-warmup-engine.mjs']],
  ['expanded Core Logger workspace density', ['scripts/test-expanded-core-card-compaction.mjs']],
  ['canonical compact Set Timeline', ['scripts/test-set-timeline-storyboard.mjs']],
  ['movement-scoped SetLog edit/delete order', ['scripts/test-setlog-delete-order.mjs']],
  ['movement-scoped Logger physical loading', ['scripts/test-logger-movement-physical-loading.mjs']],
  ['canonical rest-timer lifecycle', ['scripts/test-rest-timer-zero-deadlock.mjs']],
  ['Session Logger performance, route, and resume ownership', ['scripts/test-session-logger-performance-contract.mjs', 'scripts/test-session-logger-resume-contract.mjs']],
  ['Session Logger request timeout ownership', ['scripts/test-session-logger-request-policy.mjs']],
  ['equipment', ['scripts/test-equipment-gating-regression.mjs', 'scripts/test-equipment-usage-semantics.mjs', 'scripts/test-canonical-equipment-picker.mjs', 'scripts/test-manufacturer-branding.mjs', 'scripts/test-superset-equipment-context.mjs', 'scripts/test-superset-equipment-control.mjs', 'scripts/test-machine-brand-keyboard-selection.mjs']],
  ['completed Session equipment evidence correction', ['scripts/test-completed-session-equipment-correction.mjs']],
  ['rich Plan / Compare', ['scripts/test-session-recap-plan-compare.mjs']],
  ['Coach Session review shared cross-tab tools', ['scripts/test-coach-session-review-cross-tab.mjs', 'scripts/test-coach-session-review-scroll-lifecycle.mjs']],
  ['Coach Coming Up exact Session navigation', ['scripts/test-coach-home-coming-up-direct-open.mjs']],
  ['Coach Calendar direct filter controls', ['scripts/test-coach-calendar-v2.mjs']],
  ['relationship-scoped athlete coaching scratchpad', ['scripts/test-athlete-coaching-scratchpad.mjs']],
  ['movement-class strength metrics', ['scripts/test-accessory-strength-metric-policy.mjs']],
  ['assisted movement evidence semantics', ['scripts/test-assisted-movement-semantics.mjs']],
  ['immediate mode switching', ['scripts/test-mobile-mode-transition.mjs']],
  ['Settings account identity and mode parity', ['scripts/test-settings-account-parity.mjs']],
  ['grouped PR coaching recognition', ['scripts/test-coach-home-activity-first.mjs']],
  ['mobile coach Meet Day visibility and athlete parity', ['scripts/test-coach-meet-day-visibility.mjs']],
  ['Team Brief coaching analytics and team-relative Athlete Workspace', ['scripts/test-team-brief-v2.mjs']],
  ['platform-wide analytical chart fidelity', ['scripts/test-chart-fidelity-standard.mjs', 'scripts/test-accessory-trend-axis-mode.mjs']],
  ['global display-unit propagation', ['scripts/test-global-weight-unit-toggle.mjs', 'scripts/test-journey-unit-propagation.mjs']],
  ['historical Ledger preservation', ['scripts/test-journey-historical-reconstruction.mjs', 'scripts/test-testflight-source-parity.mjs']],
  ['data-driven sex-specific strength tiers', ['scripts/test-ledger-rewards.mjs', 'scripts/test-data-driven-strength-tiers.mjs', 'scripts/test-ledger-clubs-runtime-source.mjs', 'scripts/test-legacy-strength-trophy-retirement.mjs']],
  ['Achievements storyboard hierarchy, evidence details, and asset families', ['scripts/test-ledger-achievements-restoration.mjs', 'scripts/test-achievements-storyboard-convergence.mjs']],
  ['Strength storyboard hierarchy, lift detail, standards, evidence, and assets', ['scripts/test-strength-storyboard-convergence.mjs']],
  ['strength-tier certification app-shell integrity', ['scripts/test-strength-tier-certification-app-shell.mjs']],
  ['canonical DEV Metro source lineage', ['scripts/test-canonical-dev-metro-lineage-policy.mjs']],
  ['background unread-summary network resilience', ['scripts/test-unread-summary-resilience.mjs']],
  ['consolidated Week Programming Manager', ['scripts/test-mobile-programming-manager-consolidation.mjs', 'scripts/test-programming-week-copy-indexing.mjs', 'scripts/test-copy-week-ux-convergence.mjs', 'scripts/test-programming-session-swipe-hotfix.mjs', 'scripts/test-programming-manager-overlay-system.mjs']],
  ['Session Workspace composition and presentation-only units', ['scripts/test-session-workspace-layout.mjs', 'scripts/test-programming-session-workspace-sheet.mjs', 'scripts/test-session-workspace-unit-presentation.mjs']],
  ['Session Workspace dirty-state reorder transaction', ['scripts/test-session-workspace-dirty-reorder.mjs']],
  ['Session Workspace canonical accessory drilldown', ['scripts/test-session-workspace-accessory-picker.mjs']],
  ['Session Workspace Athlete View handoff', ['scripts/test-session-workspace-athlete-preview-handoff.mjs']],
  ['Athlete Training Hub Program Timeline navigation', ['scripts/test-program-timeline-v2.mjs']],
  ['Athlete Training Hub same-day PR hero truth', ['scripts/test-training-hub-today-hero.mjs']],
  ['visible control action reachability', ['scripts/test-major-visible-control-actions.mjs']],
  ['Production Android/iOS release parity guard', ['scripts/test-production-release-policy.mjs']],
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
