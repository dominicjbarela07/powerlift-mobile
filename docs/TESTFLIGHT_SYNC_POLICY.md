# TestFlight Sync Policy

## Non-accessory TestFlight sync rule

Completed Strength Ledger development work outside the active accessory-system rebuild should be promoted to the canonical TestFlight release path automatically after all of these gates pass:

- functionality is complete and its source delta is explicitly allowlisted;
- the current release backend contract remains compatible;
- the production schema requires no unapproved migration;
- the change introduces no native dependency or native configuration drift;
- the current TestFlight runtime remains compatible and the release export bundles every required asset;
- protected account-state behavior and adjacent critical workflows pass regression validation; and
- the TestFlight worktree is clean, synchronized, pushed, and published only through the guarded `testflight` channel wrapper.

Native TestFlight builds must be created only from the canonical clean release
checkout through `scripts/eas-build-testflight.sh`. The build guard requires an
explicit TestFlight release track and an already-pushed release HEAD so the
binary's embedded fallback source is the same approved release projection as
the OTA channel, never the Production source tree.

Promotion must add the approved change to the current known-good TestFlight head. It must never replace that head with development HEAD or merge the development branch wholesale.

## Active accessory rebuild exception

The active accessory picker, muscle-first discovery, custom accessory creator, accessory favorites, region drilldown, storyboard/parity work, accessory identity cleanup, and accessory-specific migrations remain development-only until the product owner explicitly authorizes their promotion. Their presence in a development worktree or mixed development commit is not release approval.

## Production rule

TestFlight promotion does not authorize a production mobile release, a production OTA update, a production backend deployment, or a production schema migration. Production remains explicitly controlled.

## Current Ledger achievement allowlist

The 2.1.0 Ledger achievement promotion is restricted to:

| Release file | Feature | Category | Promote | Reason |
| --- | --- | --- | --- | --- |
| `components/ledger/AchievementsExperience.tsx` | Plate Clubs, Total Clubs, trophies, milestones, medallions, volume, PR history | Safe non-accessory | Yes | Uses existing authenticated Ledger contracts and release-bundled assets. |
| `components/ledger/route-screen.tsx` | Activates the restored Achievements room while retaining all other Ledger V2 rooms | Safe non-accessory | Yes | Surgical route selection; no account-state or accessory flow change. |
| `lib/ledger-rewards.ts` | Canonical reward projection | Safe non-accessory | Yes | Pure projection over current-bests and accomplishment evidence; no writes. |
| `lib/major-volume-milestones.ts` | Shared medallion threshold taxonomy | Safe non-accessory | Yes | Pure constants/type guard; no schema impact. |
| `lib/ledger-data.ts` | Paginated accomplishment history read | Safe non-accessory | Yes | Reuses the existing production accomplishment endpoint. |
| `lib/major-volume-medallion-assets.ts` | Shared canonical threshold taxonomy | Safe non-accessory | Yes | Keeps the existing literal Metro asset registry intact. |
| `scripts/test-ledger-rewards.mjs` and `scripts/test-ledger-achievements-restoration.mjs` | Release regressions | Safe non-accessory | Yes | Certify canonical evidence, release assets, V2 cross-links, and accessory isolation. |
| Accessory picker/creator/favorites/region files and accessory migrations | Active accessory rebuild | Development-only | No | Explicit product-owner hold. |
| Remaining dirty development files | Unrelated in-progress work | Preserve | No | Outside this promotion and must not be disturbed. |
| Journey historical reconstruction and its `/mobile/ledger/journey` dependency | Backend-dependent follow-on | Blocked | No | Requires a separate backend/schema compatibility release decision. |

This promotion does not change authentication, onboarding, billing, entitlement, coach-athlete relationships, or protected-access routing. Ledger continues to consume backend-authorized athlete-owned historical data only after the existing account-state gate grants product access.
