# Mobile 3.0 Education in canonical DEV

Owner directive, October 6: “ok well add the education to the canonical shit”.
This completes the Education integration requested during the production
readiness sweep. Destination: canonical DEV; this directive does not publish.

## Integrated scope

The existing reviewed Education system from
`/Users/dominic/powerlifting_app_mobile_optional_dev` is now in canonical DEV.
It includes Self-Coach, Athlete and Team Coach introductions, the mode-aware
overview, Settings → Guidance & What’s New replay/toggle/reset, contextual tips,
and first-visit Ledger/Review Hub markers. Account-scoped campaign persistence
uses the canonical user ID. Account readiness, access and mode remain owned by
AuthContext; Education does not grant access or change identities.

The Self-Coach lessons describe Programming → Today, editing/swapping in Active
Session, and Ledger → Movement History. The reviewed examples have no cyan
annotation boxes. The illustrative trend uses six exposures and labels its
barbell context. Completion, skip and close record completion before dismissal,
so returning home cannot reopen the introduction automatically.

Only the Education dependency closure and bounded consumer wiring were
transferred. The replaced 2.0 navigation-tour modal was removed and its exact
bottom-sheet classification reconciled. Canonical keyboard/modal boundaries
were retained. Developer capture routes and launch overrides were excluded.
Existing canonical Session mutations, approved art, crops, auth logic and
post-October-2 fixes were retained. No new artwork was generated. The optional
checkout and its unrelated dirty work remain preserved.

Source-file and canonical-file hashes are recorded in
`docs/validation/production-readiness-2026-10-06/education-transfer.json`.

## Validation

- Both automatically discovered Education contracts pass: role/state/storage
  policy and actual provider navigation callbacks.
- Deliberately omitting introduction completion fails the exit-loop guard.
- TypeScript, keyboard ownership and classified modal-inventory checks pass.
- Actual canonical Metro8081 on iPhone Air: Settings replay → opening → all
  three Self-Coach lessons → Today succeeds; Back succeeds; reopening the base
  project retains completion without forcing another introduction.
- Canonical screenshots: `08-canonical-education-programming.png` and
  `09-canonical-education-ledger.png` in the same validation directory.
- Full accepted suite: 266 pass / 3 pre-existing failures. The failures are
  missing Barbell Overhead Press approval/binding (two contracts) and protected
  release-source registration for the earlier equipment Select change. These
  remain production-readiness findings; Education integration is not a release
  readiness certification.

The provider changes presentation and account-scoped guidance state only.
Adjacent surfaces checked by executable contracts include Settings, Session
Workspace, Logger, movement history, navigation markers and Coach Workspace.
Actual Athlete and Coach screen review continues in the broader sweep.
