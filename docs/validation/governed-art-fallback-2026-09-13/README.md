# Governed movement artwork compatibility — September 13, 2026

Validated in canonical DEV at **2:46 PM PT (5:46 PM Eastern)**. TestFlight publication
and Production before/after receipts are recorded in backend
`docs/validation/testflight-governed-art-2026-09-13/`.

## Result and evidence limits

The shared normalizer now recovers missing governed taxonomy independently of the
free-weight image registry. Chest-Supported Machine Row resolves upper-back anatomy;
Machine Pullover resolves lat anatomy. Existing approved exact images remain governed
by current positive human approval receipts. No artwork was generated or modified.

**The original TestFlight screenshot/payload and Session ID were not available in
this attachment.** The brief described its seven movements. Existing DEV Session
1712 / item 17913 already serialized Machine Row 216 with complete upper-back
taxonomy and rendered correctly. No Machine Pullover row in the matching athlete
4/12 Sessions was found. Therefore this report does not claim an exact reproduction
of the original device payload or prove which server field was absent there.

The failure is reproduced deterministically by replaying incomplete semantic
references through the actual pre-fix resolver from DEV commit `58f643bd`:
`{effective_movement_definition_id:216}` and the equivalent ID 178 resolve neutral
with `missing_governed_taxonomy`. Both fixed results are focused anatomy. The same
failure occurs when a thin effective reference hides a richer programmed reference
to that **same** ID. See [full replay audit](catalog-thin-payload-audit.json).

## First incorrect transition

Session item → normalized art subject was the failing boundary for those reproduced
shapes. An authoritative ID survived, but taxonomy recovery consulted only the 195
approved free-weight identities. The other 376 accessories had no deterministic
recovery path. Preferred thin references also discarded same-ID metadata, and an
unsupported direct primary field could mask valid nested/family taxonomy.

The exact-image-null branch was already correct: it continued to anatomy. The
backend `definition_payload` and `movement_identity_provenance` already serialize
rich direct/nested taxonomy and authoritative effective identity. No backend
application/schema change or deployment was needed. Read-only source comparison
against remote main `f669b4f4da17c5ed0eb2a9ae3823ce9eee84ca33` confirms the relevant
rich serializer contract there as well. No Production DB inspection/mutation occurred.

## Identity matrix

These are **reconstructed DEV QA Session 1752** IDs, not the unavailable original
TestFlight Session. Programmed/effective IDs agree; no performed evidence was created.

| Field | Chest-Supported Machine Row | Machine Pullover |
| --- | --- | --- |
| QA Session item | 18123 | 18124 |
| Programmed / effective definition | 216 / 216 | 178 / 178 |
| Performed canonical definition | none | none |
| Canonical key | accessory_chest_supported_machine_row | accessory_machine_pullover |
| Family | accessory_upper_back | accessory_lats |
| Primary | upper_back | lats |
| Secondary | lats, rear_delts, biceps | biceps, upper_back |
| Equipment category | machine | machine |
| Approved exact image | no | no |
| Anatomy eligible | yes | yes |
| Pre-fix incomplete-reference replay | neutral / `?` | neutral / `?` |
| Fixed replay and native result | upper-back anatomy | lat anatomy |

Controls: T-Bar Row 197, Reverse Fly 126, EZ-Bar Curl 252 and Preacher Curl 259
retain approved exact art. Neutral-Grip Lat Pulldown 164 retains lat anatomy.
The [seven-row matrix](mixed-session-matrix.json) and [actual QA API payload](native-qa-payload.json)
retain the complete semantic trace. Working Lat Pulldown also failed under an
ID-only pre-fix replay: the failure class is payload completeness, not machine names.

## Full catalog result

| Classification | Count |
| --- | ---: |
| Active global canonical definitions | 601 |
| Approved exact accessory art | 195 |
| Focused accessory anatomy | 376 |
| Existing Core / variant art | 30 |
| Legitimate unresolved catalog entries | 0 |
| Erroneous unresolved with rich payload before | 0 |
| Erroneous unresolved accessories with ID-only payload before | 376 |
| Erroneous unresolved after, rich or thin | 0 |

No current catalog data defects were found or patched. Arbitrary unmapped/custom
identities and contradictory governed references remain neutral by design.

## Permanent contract and lifecycle coverage

The generated `config/governed-movement-art-taxonomy.json` contains public catalog
identity/taxonomy only. Typed stable IDs/keys recover missing metadata; ambiguous row
IDs, names and physical equipment cannot. Frozen taxonomy remains authoritative.
Enrichment from payload references requires matching IDs. Conflicting catalog keys
fail closed, including movements without photos. Existing artwork receipts and bytes
are unchanged; recovering a key never constitutes approval.

`test-governed-movement-art-taxonomy.mjs` exercises all 601 definitions and **6,852
accessory lifecycle contracts**: rich definition, ID-only, thin preferred reference,
same-ID enrichment, Logger adapter, performed identity, saved sets, recap measurement
and governed legacy mapping. Denied photography is separately tested against every
shape. Core uses the explicit Core foreign key and preserves variant semantics.
The release runner compares the projection against the current canonical DEV DB.

`test_governed_movement_art_serialization.py` verifies the entire seeded backend
catalog's serialized effective definition and taxonomy/family. Its real mobile API
test compares all seven reported movements before and after same-movement Swap:
ID, key, family, primary/secondary and equipment metadata are identical. The shared
catalog test then proves identical artwork from those identical definitions.

The consumer-convergence guard covers **18 consumers / 38 render sites** across
Programming/Session Workspace, pre/active Logger, expanded detail, supersets, Coach
preview, completed recap, review, History, Athlete Workspace, Ledger and pickers.
Training Hub/Calendar aggregate summaries retain their separate aggregate system;
their exact Session drill-ins use these same canonical consumers. See the maintained
[consumer/lifecycle inventory](../../CANONICAL_MOVEMENT_ARTWORK_LIFECYCLE.md).

DEV unresolved diagnostics now include surface, definition/effective/performed IDs,
key, family, primary, taxonomy presence/source, exact approval and provenance. Lost
known taxonomy emits a DEV invariant error, without a thrown render assertion.
TestFlight displays neither diagnostic copy nor DEV assertions.

## Validation and native proof

- TypeScript: PASS. Focused ESLint: zero errors.
- [Accepted contracts](accepted.log): **218/218 PASS**.
- [Release-critical areas](critical.log): **63/63 PASS**.
- [Backend identity/serialization/Swap checks](backend-tests-summary.txt): **20 PASS**.
- Whole catalog replay: **376 → 0** erroneous unresolved ID-only accessories.
- Positive human-art receipt/asset tests still pass, including pending/rejected,
  immutable taxonomy, mixed evidence, substitutions and generic row-ID collisions.
- Same-movement Swap equivalence: all seven movements via actual isolated API calls.
- Canonical `npm start` Metro on port 8081 served the dirty working tree; see
  [runtime lineage](canonical-metro.json).
- Native iPhone 17/iOS 26.2: [mixed Session plan](native-mixed-session.jpeg),
  [expanded Machine Pullover](native-machine-pullover.jpeg),
  [T-Bar Row exact hero with anatomy](native-tbar-exact-and-anatomy.jpeg),
  [EZ-Bar Curl exact hero with anatomy](native-curl-exact-and-anatomy.jpeg), and
  [second plan pass](native-mixed-session-second-pass.jpeg). Both reported machine
  rows visibly show anatomy with no `?`. No layout/master/overlay changes were needed.

The disposable Session was removed after leaving it. **17,932 existing SetLogs
unchanged; zero QA performed sets**. No original Session was begun, swapped or edited.
Coach context remains active. Native screenshots prove DEV rendering; original
TestFlight-device reproduction remains the limitation described above.

## Platform blast radius

Touched state machine: read-only identity → normalized artwork subject → exact,
anatomy or unresolved presentation. Adjacent consumers are Logger, Programming,
recap, saved evidence, equipment identity, Swap, History and Ledger. No auth,
billing, onboarding, relationship, navigation or write-authority implementation
changed. Full consumer tests, immutable/cross-subject negatives, backend API Swap
equivalence and native compact/expanded views validate this boundary. Existing
exact art remains positively approved; unsupported identities still fail closed.

**No new native build. No Production/backend deployment.** Compatible TestFlight
publication is authorized and tracked in the backend release evidence directory.
