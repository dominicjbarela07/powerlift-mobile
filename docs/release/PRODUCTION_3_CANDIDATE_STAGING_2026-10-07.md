# Production 3 candidate staging — October 7, 2026

Owner request: “All right, you'll stage all candidates in the production folder
\"/powerlifting_app\" and \"/powerlifting_app/powerlift_mobile\"”.

Resolved destinations: `/Users/dominic/powerlifting_app` for the backend and
`/Users/dominic/powerlifting_app/powerlift_mobile` for the mobile candidate.
This authorizes local candidate assembly/staging, not a Production deployment,
OTA, paid native build or store submission.

Acceptance:

- Stage the backend candidate on the exact current live/main source, plus the
  bounded reviewed search-ranking change required by the readiness sweep.
- Stage the complete cumulative Mobile3 candidate in the named mobile checkout,
  retaining reviewed Education, Logger/UI/search/readiness fixes, approved OHP
  and all existing image/crop/identity protection. Keep the deferred Cable server
  rollout separate, retain its shipped client implementation and prove the exact
  reviewed Logger/UI additions. Stage the canonical active directory with exact
  historical compatibility identities; retain original protection pins and report
  the required final catalog/projection reconciliation before publication.
- Preserve existing branches, tracked/untracked work, databases, local settings,
  nested repositories and legacy2.0.2 source/history; create no temporary worktree
  merely for convenience. Record any necessary checkout transition and retained
  backup before modifying it.
- Validate the actual destination source, dependencies, type/contracts and local
  artifact inclusion. Report failed release gates and outstanding native/customer
  certification honestly. Do not weaken protections to label staging a release GO.
- Retain destination/source identities and a complete file/holdback comparison.
  Canonical DEV remains the superset. No shipped or unique candidate fix may exist
  only in the Production candidate checkout.
- Continue independent checks if the Mac locks; do not repeat already satisfactory
  screens or request an unlock.

Starting canonical mobile: `57ddc768d964dacc2473e6be9cca464461ec1891`.
Starting canonical backend: `35027c051cb22dd9611ee7b3c0cf3ada8eb803f3`.
Starting Production backend checkout: `ada0ed1861027b2d2d346794ef9fac2e851821f8`.
Current live/backend main: `751a1173b301cb382557c5cbda59e4fdf72633b2`.
Starting legacy mobile checkout/main: `61a6893f5ca02cb53b347460adeef5121d681cad`.

## Staged result

Both requested destination checkouts now use local branch
`release/production3-staged-20261007`. No new worktree was created.

| Candidate | Destination and exact tested source |
| --- | --- |
| Backend | `/Users/dominic/powerlifting_app`, `d4b6a8b22549a9853db71fbbd0485c708471519f`, based on current live/main `751a1173b301cb382557c5cbda59e4fdf72633b2` |
| Mobile | `/Users/dominic/powerlifting_app/powerlift_mobile`, `13d066ab6227a53e163d507f9e6887f74bf3bcab`, based on cumulative TestFlight checkout `57de0daf66a10579a92a1cb983bf0a88ead035fd`, incorporating canonical DEV `1a15ab521dc133ea1d1ca6d067dedfe68b5fcbdd` |

Backend staging contains only the bounded search-ranking implementation, its
three relevance assertions and existing DEV closeout record. The implementation
is byte-identical to canonical DEV. Current live backend fixes are the ancestor,
not overwritten by the stale starting checkout. Models and migrations are
unchanged. This is a local candidate; the server still serves the prior live SHA.

Mobile staging copied287 exact tracked canonical source/evidence files, then
carried the10 already-reviewed Logger/Education changes onto the shipped
Cable-compatible Logger. It retains the reviewed UI, Education, search consumers,
readiness, Draft presentation, current image/crop receipts and OHP650/Core62.
The initial catalog projection was corrected after the destination parity check:
the final catalog is exact canonical DEV, **499 active definitions plus69 exact
historical compatibility definitions**. All567 protected identities survive;
retired discovery entries reactivated:0. No database rows or numeric IDs were
transferred.

At the tested source,8471 tracked paths match canonical DEV exactly. The only
five differences are the three Cable-compatible implementation paths and the
two associated governed held-back test paths:

- `app/(tabs)/workout/[workoutId].tsx`: exact shipped implementation plus all10
  reviewed Logger/Education changes, rather than the pending Cable implementation.
- `lib/equipment-flow-subject.ts` and `lib/equipment-selection.ts`: retained
  shipped implementations pending the compatible Cable backend rollout.
- `scripts/test-equipment-flow-subject.mjs`: retained corresponding shipped
  contract; `scripts/test-shared-movement-programming-context.mjs` remains the
  previously governed DEV-only excluded harness.

No unknown destination difference exists. These are staging projections, not new
source exemptions: the old protection pins remain unchanged and still block
publication until the final approved3.0 projection is reconciled. All valid
product state remains in canonical DEV; no new feature fix is stranded here.

## Destination validation

| Check | Result / limit |
| --- | --- |
| Canonical shared-backend gate on exact candidate SHA | PASS. Frozen iOS/Android2.0.2 API responses are identical; deliberately broken permission comparison is rejected; independent manufacturer-isolation owner acceptance and recognition/adjacent regressions pass. No model/schema change. |
| Destination search API tests |8 tests /35 subtests PASS against the actual staged backend implementation. |
| Mobile dependency installation |PASS; local dependencies installed from the staged lockfile. No native build. |
| Final mobile TypeScript |PASS after regenerating the ignored Expo Router declarations from actual destination routes. The initial legacy cache mismatch is retained in evidence. No source assertion was weakened. |
| Final complete active catalog / thin-payload check |499 definitions /6084 lifecycle contracts PASS:468 accessory exact-art definitions,31 Core definitions,0 anatomy/unresolved outcomes. |
| Final historical catalog compatibility |PASS for all567 protected IDs and all69 exact compatibility records. |
| Final independent iOS/Android local exports |PASS for the explicit Production3 target / approved-art channel /3.0.0 runtime. Each contains all487 unique approved movement images, covering490 policy mappings, plus3 approved equipment images; OHP included; missing approved images0; pending/rejected master leakage0. |
| Protected baseline resolver and bytes |PASS:567 identities /557 exact-art identities /10 established fallbacks; unauthorized missing mappings, changed approved image bytes, unexpected fallbacks and unauthorized crop changes all0. Existing actual human crop changes retained. |
| Full accepted/critical runs before catalog correction |269 PASS /3 FAIL of272 accepted contracts;78 PASS /3 FAIL of81 critical areas. The catalog-parity failure was corrected and its complete active/compatibility contracts rerun successfully. The two original source-protection failures remain. Do not relabel these earlier aggregate logs as a final all-green run. |
| Exact final destination release gate |FAIL: original catalog holdback expects Git blob `a253d05bb987ca050e2fe19906b031b716c2aec3`; staged canonical catalog is `b66aadced6dd202e267a1e9499c606b5547d7128`. Subsequent projection/OHP/crop source protections also require bounded reconciliation; none were bypassed or refreshed. |
| Physical/native/customer certification |Not performed. Prior reviewed screens were not repeated; no new simulator run was needed for staging. Actual3.0 native/store/device/customer validation remains required. |

**LOCAL CANDIDATES STAGED: YES. RELEASE/PUBLICATION GO: NO.**

NOT PRODUCTION VALIDATED - automated checks passed, but complete customer
workflow validation is still required. This statement describes the passing
destination checks; the named release-source gate remains failed.

Required next preparation work: reconcile the already-approved OHP/crop and
current reviewed UI/catalog staging projections with the permanent protections,
retain the original historical baseline, prove unauthorized changes still fail,
synchronize reviewed canonical source and certify the actual native candidate.
Existing image approvals need no repetition. A separate compatible Cable/server
rollout must be reconciled before enabling its deferred implementation.

## Preservation, source and delivery boundaries

The backend checkout had26 pre-existing tracked dirty files and an untracked
test overlapping the newer baseline. Before its necessary branch transition,
recorded hashes and saved both colliding files outside the repository. Restored
both exactly afterward; every original tracked dirty file retains its exact
bytes, including `instance/powerlift.db`. Existing untracked local work, nested
mobile/TestFlight repositories and original branches remain preserved. None was
included in the backend candidate commit. The backend worktree remains honestly
dirty; the shared-backend guard validates the immutable candidate commit in
isolated disposable databases.

The legacy mobile `main` source remains at `61a6893f`; its source/history was
not deleted or published over. The mobile candidate checkout is tracked-clean.
Production2.0.2 channel/binaries and TestFlight updates were not changed. No
Production Git push, DEV push, backend deployment, OTA, native build, store
submission, catalog migration, message or owner-data mutation occurred.

Complete local evidence and exports:
`/Users/dominic/Documents/Codex/2026-10-03/re/outputs/production3-staging-2026-10-07/`.
Tracked summary/projection/guard evidence:
`../validation/production3-staging-2026-10-07/`.
Documentation-only closeout commits change no tested product bytes.

## Sibling/Adjacent Coverage

The independent backend gate exercises both frozen2.0.2 platforms, real API
permission/Session execution paths, machine baseline/improvement, manufacturer
and Other isolation, SetLog/core recognition, queries, recap and prescription
regressions. Search exercises every active name/alias, typo relevance and private
movement boundaries. Mobile checks cover complete active/thin/compatibility
identity resolution and every approved exported movement image on both platforms.
No fresh live/customer/native workflow claim is inferred from those tests.

## State-machine closeout

- **What state machine did this touch?** Local release-source/candidate staging;
  no new identity, access, billing, Session or equipment transition was invented.
- **What adjacent systems could be affected?** Directory search, Programming,
  Logger/Education, active/retired identity hydration, artwork, deferred equipment
  compatibility and future native release tooling.
- **What existing workflows were validated?** Exact backend compatibility and
  owner acceptance, search, final mobile type/catalog/compatibility/artifact
  contracts, full pre-correction mobile suites and explicit failed source gates.
- **Why can we be confident this did not introduce a regression?** Current live
  backend is the candidate ancestor; app changes match reviewed DEV or the
  exact recorded Cable-compatible projection; all protected identities/images
  survive; source gates are left failed rather than waived; existing local work
  and live destinations remain untouched. Publication certification is open.
