# Mobile 3.0 readiness re-sweep — October 7, 2026

Owner request: “Run the same go no-go.” Repeat the October 6 readiness sweep
against canonical DEV after the approved OHP source and framing integration.
Assess whether Mobile 3.0 is ready to begin Production preparation, distinguish
remaining product failures from final native/store certification, and retain a
clear GO/NO-GO supported by fresh evidence. This is an audit, not publication or
paid/native build authority. Do not modify owner data or Production 2.0.2.

Acceptance: rerun all accepted and critical contracts, Session/PR/search API
regressions, visual/layout/type audits, source/release preservation checks and
local 3.0 iOS/Android asset exports. Inventory exact source/runtime identities,
review available real DEV screens and note unobserved cases honestly. If the Mac
locks, continue independent checks without requesting an unlock. Preserve all
approved assets, current crops and unrelated dirty work; no new product choices.
Apply the existing manufacturer-isolated machine PR, baseline, Cable holdback,
zero-load, prescription, Hot Swap, canonical identity, Education and cumulative
release laws. Do not weaken gates or refresh protected pins to pass this audit.

Starting mobile source: `293c5b0a081db06c677bd259f442509fc7f7cc91`.
Fresh evidence: `../validation/production-readiness-2026-10-07/`.

## Verdict

**GO to begin bounded Production release preparation. NO-GO to publish or call
the current source a certified release candidate.**

The previous Draft-state, missing OHP artwork, minimum-text-size and identified
presentation/search findings have been addressed in DEV. No new functional or
visual blocker was found in the paths exercised by this re-sweep. A broad UI
redesign is not needed before 3.0. There are still deterministic release-gate
failures, unsynchronized source, one DEV-only server search improvement and the
normal new-native/platform certification work described below.

Owner steering: “you dont need to recheck screens that you determined were fine
btw”. Prior unchanged screen observations remain in the October 6 report; they
are not represented as fresh observations. Actual new observations concentrate
on the previously failed Draft path and updated Settings. The Mac subsequently
locked; independent checks continued without an unlock request.

## Fresh results

| Check | Result and limit |
| --- | --- |
| Accepted behavior contracts | **271 PASS / 2 FAIL**, 273 automatically discovered accepted contracts. Both failures are release-source reconciliation failures, detailed below. No test was removed, quarantined or weakened. |
| Critical invariant areas | **79 PASS / 2 FAIL**, 81 areas. The two failed areas wrap the same source-reconciliation failures; these counts overlap the accepted suite. |
| Current governed artwork coverage | **499/499 built-in movements** and **31/31 Core movements** have approved exact image/crop coverage. Human source/crop approval and stale/missing/rejected approval failure contracts pass. OHP650 / Core62 uses the approved dedicated image and owner-saved framing. |
| Entire protected pre-Oct2 resolver inventory | **567 identities**:557 exact-art identities and10 established fallbacks. Missing approved mappings:0; changed approved image bytes:0; unexpected fallbacks:0; unauthorized crop changes:0. This independent diagnostic retains the actual approved Deficit Deadlift crop change and does not substitute for the failed source gate. |
| Fresh local Production3 exports | iOS and Android export successfully with the required target, artwork channel and3.0.0 runtime switches. **487 unique approved movement images**, covering490 approval-policy mappings, are present on each platform. OHP is included. Three approved equipment-category images are included; pending/rejected master leakage is0. These are local exports, not native binaries or published updates. |
| Protected artifact inventory | iOS has1015 asset entries /1009 unique hashes; Android has1015 /1010. Unauthorized protected movement-image omissions:0. Existing47 owner-authorized historical differences are honored; the46 consolidation records with retained paths still have their original source bytes. The remaining record is the owner-authorized completion-cue replacement. Android differs from the iOS protection manifest only for seven exact installed-library iOS back/search icons; no movement exemption was introduced. |
| Session / search API regressions | **44 tests /55 subtests PASS** for actual prescription, composition, zero-load edit and directory-wide search behavior on the local test backend. |
| Recognition / exact-history API regressions | **22 tests PASS**, including actual mobile save response, machine baseline silence, earned improvement, equipment/manufacturer isolation, historical evidence and replay behavior. The mobile accepted suite also passes save-to-celebration, rest handoff and transient delivery contracts. No fresh physical-phone playback claim is made. |
| Account / access API regressions | **52 tests /21 subtests PASS** for account state, mobile account contract, billing access and readiness. These do not certify a real store purchase or Apple sign-in. |
| Type checking | PASS. |
| Typography / horizontal layout | PASS:42 semantic roles /6 surfaces meet the12pt minimum;42 canonical files /7 sheet contracts plus app route roots pass horizontal-layout ownership. Larger-text/compact-phone visuals remain unobserved. |
| Visual-value / root audits | PASS:6408 reviewed exact literal values across139 files,0 unreviewed/changed findings;268 TypeScript files pass root ownership. These are governed source checks, not a claim that every possible device state was inspected. |
| Current DEV-superset release gate | FAIL before completing its inventory: unregistered current artwork-registry source. No complete Gate A PASS or zero release-source delta is claimed. |
| Strict canonical Metro certificate | FAIL: reviewed local HEAD differs from the remote canonical reference. The tested runtime uses the canonical local checkout; that does not meet the synchronized release-source certificate. |

The local export's product fingerprint is
`4d1dac715c9a6992b4f51c68be7bb7d7da00e13fc8e2bffca0dac753d545d670`.
iOS bundle SHA-256:
`0540e39be8fda5a9becef6009c01caf5634b4029c97027ce787c5b971b27f1f1`.
Android bundle SHA-256:
`8290923a0fe89d14730f3242c795e1d3eca915b7f48fe79ac21c2778d5f3fa84`.
The source-bound export receipt was independently validated before this
documentation-only closeout. See `local-export-source.json`.

## Required before a release GO

### 1. Reconcile the approved OHP addition and saved crop into release protection

`test-dev-testflight-release-gates.mjs` rejects the current
`lib/canonical-movement-artwork-assets.ts` as “unregistered DEV changes”. Its
registered endpoint is `0803f68a…`; the actual approved-addition source is
`4d7c1899…`.

`test-pre-october-2-restoration.mjs` fails with “3.0 art policy requires its exact
owner-bound extension receipt”. Its only existing registry extension permits
the version-scoped bundle condition while pinning every other byte; OHP's
legitimate new require/mapping falls outside that narrow exception. Subsequent
exact-source checks also cover Core identity/reuse and runtime policy. Independent
diagnosis records four changed source paths and one existing image's changed crop:
`lib/canonical-movement-artwork-assets.ts`,
`lib/canonical-core-artwork-identities.ts`,
`config/governed-core-artwork-reuse.json`,
`artwork-review/runtime-policy.json`; the owner changed Deficit Deadlift framing
through the real human crop editor on October7.

The OHP source and framing approvals are already valid. **No new owner image
approval is required.** Implement a separate, exact human-approval-bound
art-addition/crop progression in these protections, retaining the original
restoration pins and existing bundle-policy exception. Prove all unchanged
baseline images, numeric ownership, mappings and crops; retain only the actual
approved positive addition/crop change. Deliberately reject missing images,
unapproved additions, changed image bytes, unauthorized crops, omitted inclusion
switches and unrelated source changes. Re-run accepted/critical suites and
complete Gate A on the assembled candidate. Do not solve this by replacing the
protected baseline, broadly exempting artwork files or accepting a new hash alone.

The independent complete inventory and artifact checks pass. They diagnose
preservation; they do not waive either failed permanent release protection.

### 2. Synchronize and certify the reviewed cumulative source

The local tested mobile HEAD is
`293c5b0a081db06c677bd259f442509fc7f7cc91`; the actual remote
`dev/canonical-mobile` reference remains
`44ad12952ea9831f60465d0295a5ffde8d3ae646`.
Synchronize the reviewed source after the bounded protection repair, assemble
a clean cumulative release candidate and certify that exact source/artifact.
Preserve historical untracked evidence and unrelated backend/optional work.
Keep the existing six-path Cable backend/catalog holdback unless it is separately
reconciled with its required implementation and compatibility validation.

### 3. Carry the DEV search ranking fix into the serving backend

Read-only live health identifies serving backend
`751a1173b301cb382557c5cbda59e4fdf72633b2`.
Its exact `app/services/canonical_movement_search.py` blob still ranks a direct
name/alias typo as tier7 /300 points. Canonical DEV's bounded fix at `84297668`
uses tier3 /750 points so that it outranks broader metadata matches.
The file comparison/diff is retained; DEV tests do not prove that server change
has been deployed. Include that bounded server dependency in release preparation,
run the canonical shared-backend/legacy2.0.2 compatibility guard and verify the
actual serving source after the authorized deployment. Do not deploy wholesale
DEV or the held-back Cable migration.

### 4. Certify the actual new native candidate

The separate3.0.0 target now includes approved imagery correctly on both local
platform exports. Current TestFlight is runtime2.1.0 and protected Production
is2.0.2; the local export is not a replacement native binary. Assemble the real
3.0 candidate and complete the native/store checks before a publish/submit GO:
Apple sign-in, purchase/restore/access transitions, push/background delivery,
media upload/review, a fresh qualifying PR's visible/audio delivery, compact-phone
and larger-text layouts, supported tablet coverage and Android if included.

This readiness task creates no publication, build, deployment or store submission.
The preparation profile remains explicitly distinct from release authorization.

## Actual observations and retained coverage

- Athlete Training labels the previously failed QA Draft as **Draft**. Its real
  preview keeps Begin unavailable and visibly explains that it must be ready to
  train first. No Draft was started and no athlete authoring access was granted.
- Updated Settings uses the current near-black surface and restrained section
  presentation. Support/Guidance, privacy, account and lower actions remain
  readable/reachable in the inspected state; no privacy, notification, account
  deletion or purchase action was taken.
- OHP source/framing approval comes from the existing owner receipt and real
  crop editor, followed by current complete artwork/runtime/export checks.
  This audit does not claim a new OHP Session was created or that its phone Logger
  was physically reviewed again.
- Unchanged, previously satisfactory Self-Coach/Coach/Athlete, Education,
  Programming, Logger, Calendar, Ledger and review observations remain in
  `PRODUCTION_READINESS_SWEEP_2026-10-06.md`. Their executable contracts were
  rerun. Archive/editor/Team Brief second-pass visuals and native scenarios
  were not newly certified after the Mac locked.

Final visual evidence: `05-settings-return.png`,
`06-draft-lifecycle-return.png`, `07-draft-preview.png`.
Capture04 is a transient during scrolling; it is not final screen proof or
evidence of a persistent dead app. The available runtime returned to working
Training after closing the preview. The Mac subsequently locked, and no unlock
request or repeated simulator attempts were made.

## Exact sources and untouched destinations

| Destination | Observed state |
| --- | --- |
| Tested canonical mobile DEV | `293c5b0a081db06c677bd259f442509fc7f7cc91`, `dev/canonical-mobile`; tracked source clean before audit documentation |
| Canonical backend DEV | `35027c051cb22dd9611ee7b3c0cf3ada8eb803f3`, `dev/canonical-backend`; pre-existing tracked dirty work preserved |
| TestFlight release checkout | `57de0daf66a10579a92a1cb983bf0a88ead035fd`; untouched |
| Actual latest TestFlight OTA | iOS `01a11340-9ccc-7498-a71d-77a367aa6f5f`, group `d94afb31-3d19-4265-9040-0c2566c490b3`, source `59641028e514c3edc957c95de2d4882f2f3bf3e0`, runtime2.1.0; read only |
| Actual Production channel | `production` still maps to `production-live-2.0.2`; latest group `0cceb494-ae13-4c9a-931c-b583976707e5`, source `3d5816a1b824eff00b9ce605f8d544a1264c6376`, runtime2.0.2 on iOS and Android; read only |
| Actual recognition backend health | Ready; equipment-isolated policy v3; manufacturers isolated, Other separate, first machine baselines quiet; serving source `751a1173b301cb382557c5cbda59e4fdf72633b2`; no new deployment |
| Optional Education checkout | `0afa7990a87cf43396bc28d322de9fb1b679d5f4` plus preserved pre-existing work; untouched |

The artwork restoration/OHP state is in canonical DEV, not stranded in a
temporary worktree. No temporary worktree was created, reconciled or deleted by
this read-only audit. The lifecycle inventory reports63 existing entries,
including7 ambiguous entries; it does not authorize deleting their unique work.
Historical195 non-baseline review thumbnails remain preserved and are not a
release blocker. No new removal or product decision was invented.

Only this audit's report and evidence are retained by the closeout commit.
It changes no tested product bytes or release-gate source. Failed checks remain
failed and the listed release findings remain open.

## Required state-machine closeout

- **What state machine did this touch?** None changed. Read-only assessment of
  existing Session lifecycle/execution presentation, account/role access,
  artwork eligibility and source/release validation states.
- **What adjacent systems could be affected?** Training, Program map, Calendar,
  Session preview/Logger, Programming/search, Education/Settings, recognition
  save/history/delivery and version-scoped native artwork inclusion.
- **What existing workflows were validated?** Full accepted/critical contracts,
  Session mutation/persistence and zero-load APIs, exact-equipment PR save/history,
  directory search, account/access APIs, complete protected artwork resolution,
  independent iOS/Android artifact inclusion, Draft preview and updated Settings.
- **Why can we be confident this did not introduce a regression?** This task
  changed no product code, gate, owner data or published destination. It retains
  failed evidence, distinguishes local/observed/live states and leaves actual
  native/source certification open rather than declaring a false release GO.
