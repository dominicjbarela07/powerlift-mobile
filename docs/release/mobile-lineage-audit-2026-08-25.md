# Mobile Release Lineage Audit — 2026-08-25

## Authority

`dev/canonical-mobile` is the only authoritative mobile product-source branch.
TestFlight and Production branches are release projections. They may carry
release configuration, but product changes made there are incomplete until
back-propagated to canonical DEV.

Audit source at the time of this report:

- canonical DEV: `d5cb7e21f70743fc71f2c2a3eb5a8191190a1cd3`
- prior TestFlight source: `427d573208ebcc560d27a61fd9121f6a31b18e5b`
- Production mobile: `bdae472c2148d566a306b7baa0153b4b924ac2e1`
- DEV backend/web checkout: `ba74376d057bc0b0079669c1465b03db26048901`
- Production backend/web checkout: `ada0ed1861027b2d2d346794ef9fac2e851821f8`

## Regression ancestry

The accepted Coach Coming Up direct-open implementation entered history at
`04b3de5056da23afeacf3595477f60cea1a5d8e5`. Commit
`4437b06291e7b3930da2c8d7f4f79da5bfd369a4` later consolidated Programming
Manager and deleted the `workoutId`/`programId` hydration consumer. The original
fix stayed in ancestry, so an ancestry-only check could not detect the behavioral
reversion. The release matrix also omitted the standalone direct-open contract.

The repair restores exact athlete/program/block/week resolution and automatic
Session Workspace opening. It also adds that behavior to the cumulative release
matrix and makes the contract self-contained inside the mobile repository.

## Registered mobile worktrees after safe cleanup

Counts below are `canonical-only / worktree-only` commits at audit time.

| Purpose | Worktree / branch | HEAD | Merge base | Counts | State |
| --- | --- | --- | --- | ---: | --- |
| Authoritative product source | `.worktrees/mobile-canonical-dev` / `dev/canonical-mobile` | `d5cb7e2` | `d5cb7e2` | `0 / 0` | clean |
| Historical in-progress DEV checkout | `powerlift_mobile` / `codex/coach-calendar-month-agenda-20260815` | `985f404` | `57212c9` | `227 / 62` | dirty; preserved, never a release source |
| Prior TestFlight projection | `powerlift_mobile_testflight` / `release/testflight/pr-recognition-dedup-20260825` | `427d573` | `427d573` | `1 / 0` | clean; to be replaced |
| Production mobile projection | `powerlift_mobile` / `main` in the Production clone | `bdae472` | `1dd549e` | `153 / 11` | clean; untouched |
| Production core-history archive | `release/production-core-movement-history-20260823` | `a742736` | `1dd549e` | `153 / 5` | clean; retained |
| Production equipment archive | `hotfix/production-equipment-picker-20260824` | `03eaadd` | `1dd549e` | `153 / 7` | clean; retained |
| Manufacturer feature archive | `codex/manufacturer-brands-20260816` | `fc7e185` | `30b7eef` | `57 / 1` | clean; behavior present in canonical; retained |
| Recap trend archive | `codex/session-recap-identity-trends-mobile-20260816` | `ed72ba6` | `30b7eef` | `57 / 1` | patch-equivalent in canonical; retained |
| Session review archive | `codex/session-review-v3-mobile-20260816` | `900583f` | `4b422af` | `61 / 2` | patch-equivalent in canonical; retained |
| Set logger load archive | `codex/set-logger-load-wheel-20260816` | `533b3da` | `b221901` | `59 / 1` | patch-equivalent in canonical; retained |
| Superset logger archive | `codex/superset-independent-completion-20260816` | `a1170f0` | `8011c41` | `58 / 1` | patch-equivalent in canonical; retained |

The mobile clone had 23 local and 35 remote historical release/hotfix refs.
Branches were not deleted because refs preserve recoverable provenance. The new
lineage guard makes them ineligible as release sources unless they descend from
current canonical DEV and contain no non-configuration candidate-only changes.

## Worktrees removed

The following clean or reproducible stale TestFlight worktrees were removed
after their commits were proven to be ancestors of, or behaviorally superseded
in, canonical DEV. Their Git branch refs remain available:

- `release/testflight-dev-reconciliation-20260823`
- `release/testflight-programming-consolidation-20260825`
- `release/testflight-substitution-confirmation-20260825`
- `release/testflight-week-copy-indexing-20260823`
- `release/testflight-zero-unknown-artwork-20260823`
- `hotfix/testflight-accessory-setup-replacement-20260824`
- `release/accessory-testflight-20260816` (only regenerated `node_modules` was untracked)
- historical Ledger Index, reported-bodyweight, and manufacturer-tag TestFlight worktrees in the Production clone

Missing temporary-worktree registrations were pruned in both mobile clones.
No unique source commit was deleted.

## Recovered and superseded parallel work

The stale Programming Manager and substitution worktrees reported branch-unique
commits because they were cut from an older merge base. Their accepted product
work is present in canonical history through the cumulative equivalents:

| Stale commit | Canonical equivalent / successor |
| --- | --- |
| `ec5bccb` logger identity | `e4336ed` and later canonical identity work |
| `6f369e8` evidence lock | `cb3e308` |
| `71b6b94` local units | `a899c48` global floating-unit system |
| `f835a56` Programming Manager | `4437b06` plus `d5cb7e2` direct-open repair |
| `c0c666a` substitution sheet | `7a2796b` and cumulative Logger source |

The historical dirty DEV checkout contains additional in-progress and DEV-only
work. It was preserved without being merged wholesale. Release-critical behavior
was reconciled through the protected manifest and the 15-area behavioral matrix.

## Critical-file convergence

The audit explicitly compared the Session Logger, swap authority, Session
Workspace, Programming Manager, Coach Home/Index, Plan / Compare, Movement
History, Ledger, movement artwork, display units, PR presentation, navigation,
and Auth/workspace-mode source. The material drift was:

- TestFlight Programming Manager had lost the exact Session intent consumer;
- canonical DEV retained a self-contained direct-open contract that the isolated
  TestFlight test could not previously run;
- the historical dirty DEV Programming Manager lacked the latest `workspaceKey`
  reset in its direct-open composition; this was back-propagated there;
- `app.json` and `eas.json` legitimately differ between canonical DEV and the
  TestFlight projection; product files may no longer differ candidate-only.

All other named regression areas are certified by
`scripts/test-release-critical-invariants.mjs`. Source ancestry and behavior are
separate mandatory gates.

## Enforcement

- `config/protected-fix-manifest.json` records critical accepted provenance and
  behavior contracts.
- `scripts/test-release-source-lineage.mjs` blocks a candidate that does not
  descend from pushed canonical DEV or contains candidate-only product files.
- `scripts/test-release-critical-invariants.mjs` detects later behavioral
  reversion even when the original fix remains in ancestry.
- both TestFlight OTA and TestFlight build wrappers run the lineage guard; the
  guarded OTA pipeline additionally verifies the exact remote launch asset is
  byte-identical to the locally validated route-complete Hermes artifact.

## 2026-08-26 Program Timeline regression addendum

The active Program Timeline feature entered history at `a59f1b3`, including a
stable-ID route helper and the Training Hub action-dispatch branch. Programming
Manager consolidation at `4437b06` replaced the surrounding Training Hub source
with a state that retained the visible CTA and emitted action, but dropped the
consumer that performed navigation. The broken behavior therefore existed in
both canonical DEV and its config-only TestFlight projection; it was not caused
by candidate-only source drift or Expo Router preloading.

Canonical repair `9c5db52` restores navigation through one governed route
builder, preserves optional athlete context, guards repeated taps, and re-arms
the control when Training Hub regains focus. `test-program-timeline-v2.mjs` is
now a protected-fix contract and the sixteenth release-critical product area so
ancestry alone cannot certify this behavior again.
