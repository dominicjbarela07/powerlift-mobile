# Logger history visibility — owner DEV review, October 6

Owner approved the proposed three states and requested implementation in DEV
only, with the actual logger open to inspect:
- A valid comparable prior exposure retains the existing performance card.
- Exact movement history exists but no comparable prior exposure: replace the
  empty card with a compact Movement history link. Other manufacturers remain
  recorded context only, never comparable performance.
- No exact movement history on any equipment: show neither card nor link,
  freeing vertical space for today's Sets.

Use the real authorized canonical History endpoint to establish history existence;
a selected-machine empty summary does not prove no history elsewhere. Keep
loading/read failures distinguishable from successful empty evidence. Preserve
current canonical movement/equipment ownership, manufacturer comparison policy,
History navigation/permissions, prior shipped fixes, approved art, zero-load
semantics, current Session and immutable performed sets. No backend deployment,
TestFlight publication, art/taxonomy replacements or unrelated UI redesign.

Acceptance: inspect actual canonical npm-start DEV screenshots before/after,
confirm no-history removal on the owner's QA movement, compact link with
other-equipment history and working History destination, retained comparable card.
Validate actual rendering plus availability subject isolation, stale reads,
errors and current evidence invalidation. Typecheck and existing affected History
regressions. Keep proof and leave the DEV logger open for owner review.

## DEV closeout

Implemented in canonical mobile DEV, based on 7ac0665ecfed4ecda4d6b4ba1152df41bc5a2035.
Backend source remains 271bef5bcbd2fa47406012ab8f6f3dcae2108447. No backend
deployment, OTA or TestFlight publication was made for this owner-review change.
No temporary worktree was needed. Existing dirty/untracked work is preserved.

Actual canonical npm-start runtime was certified on port 8081, PID 61434, project
root /Users/dominic/powerlifting_app_dev/powerlift_mobile, runtime 2.1.0.
iPhone Air simulator, iOS 26.2, used real authorized DEV reads as QA user 72 /
athlete 65. The new QA Sessions contain no performed SetLogs. No actual athlete
evidence, existing Session prescription, equipment ownership or imagery changed.

Observed three states:
- Original Session 1837, canonical movement 219, Hammer Strength Plate Loaded:
  no exact history, card/link absent, equipment flows directly into today's Sets.
- QA Session 1840, canonical movement 121, Hammer Strength Selectorized:
  compact unboxed Movement history link; no borrowed Arsenal/Matrix performance.
  Tapping it opened exact Machine Lateral Raise History, All History, five
  exposures/seven Sets with Arsenal and Matrix breakdown and no earlier Session
  for the selected Hammer equipment. Manufacturer comparison stays isolated.
- QA Session 1841, canonical movement 121, Arsenal Strength Selectorized:
  full comparable card retained: Oct 5, 110.23 lb × 12 @1 RIR.

Visual review addressed the supplied screen's three weak areas: a large empty
container occupying vertical space, empty-state copy using performance-level
hierarchy, and a full-size history affordance even when no evidence exists.
Successful empty history now renders nothing; other-equipment evidence has a
44-point compact tap target without a background; actual comparable performance
retains its existing hierarchy. First and second actual screenshot passes were
inspected; current art, inline Swap, prescription edit and equipment controls
are preserved. Screenshots and test logs live in
`docs/validation/logger-history-visibility-2026-10-06/`.

Passing checks: actual availability-hook lifecycle and rendered three-state
component; equipment recency/manufacturer transitions; exposure snapshots,
exact accessory History, Programming last exposure, Option E; TypeScript.
The new permanent test runs via `npm run test:logger-history-visibility`. It
checks exact unrestricted history existence, owner/athlete/subject isolation,
late-response rejection, evidence invalidation, invalid Session identities,
network errors distinct from empty evidence, no per-render reads, and working
full/compact History navigation.

Touched state machine: read-only history availability and logger presentation.
Adjacent workflows validated: exact History navigation, machine comparisons,
bodyweight display, prior-exposure cache invalidation, Programming history and
Option E. Existing mutation handlers, PR recognition, prescription persistence,
permissions, search and release policies remain outside this change.

Destination: DEV visual review only. Owner sign-off/publication is still pending.
The original no-history logger is left open for inspection.
