# DEV approved movement artwork consumption — 2026-09-13

**Implementation and automated checks complete; targeted interactive native sign-off remains incomplete because the Mac locked.** No TestFlight or Production action. No new artwork generated. The exact outstanding native checks are listed below; this record does not claim full visual acceptance.

## Root cause and change

Dumbbell Curl (canonical MovementDefinition **253**, key `accessory_dumbbell_curl`) had a valid current human receipt (`existing-253-5549d5db5080`) and mapped asset. The SessionV3Movement compact row explicitly requested `muscle-focus`, bypassing the exact photo. Expanded detail only mounted the hero when `active && !complete`, excluding PRE detail. SupersetRoundWorkspace repeated both overrides. This was a consumer error, not an approval, registry, identity, cache or asset generation failure.

Compact rows now request canonical movement imagery. A shared presentation selector gives expanded PRE/ACTIVE details a focused anatomy cue plus the approved exact hero. Superset selection applies the same rule independently to each member. The existing positive eligibility resolver and human approval byte gate remain authoritative. No independent registry or name matching was added.

## Audited chain and consumer sweep

[approved-inventory.json](approved-inventory.json) records all **195** current positive exact-art receipts, canonical IDs/keys, movement names, live serialized taxonomy, source and thumbnail paths, candidate IDs and app hashes. Every live DEV definition resolves to its same current human-approved receipt. `assertHumanArtworkGate` verifies review history → approved mapped candidate → actual file bytes → runtime projection. The TSX contract verifies the actual registry requires point at those same approved derivatives.

| Surface | Result |
| --- | --- |
| Session Plan | Corrected hard-coded anatomy; approved exact thumbnail now wins |
| Expanded PRE / active Logger | Anatomy beside title plus approved hero in existing header |
| Superset / Coach execution preview | Same per-member compact/expanded selection law; no active-only eligibility |
| Session Workspace / Programming Manager | Already uses shared canonical renderer; preserved semantic effective subject |
| Coach Session editing / reordering | Already uses shared renderer; no separate anatomy override |
| Completed recap / Evidence Created | Already uses canonical saved-identity renderer; unchanged |
| Search / Swap / substitutions | Already uses canonical definition references; unchanged |
| Movement History | Already uses canonical definition adapter; unchanged |
| Aggregate Session/anatomy surfaces | Intentionally aggregate; no exact-photo substitution |

The executable consumer inventory still covers **18 files / 38 render sites**. Only the two intentional expanded target-cue contexts differ from the default exact-art hierarchy. Known uncovered machine/cable identities retain focused anatomy; missing/contradictory governed identity remains neutral.

## Visual convergence performed

Canonical `npm start` ran from the intentionally dirty canonical DEV branch and passed source and human-art preflight. Native screenshots came from iPhone 17 / iOS 26.2 / Expo Go connected to port8081, not a web mock.

- [Original Session Plan](before-plan.png): Curl incorrectly uses biceps anatomy.
- [Original Curl PRE detail](before-curl-pre.png): anatomy only, empty hero region.
- [First corrected PRE detail](pass1-curl-pre.png): exact hero appears.
- [First corrected mixed plan](pass1-mixed-plan.png): four approved movement photos appear.
- [Final mixed plan](final-plan.png): Curl, Incline Dumbbell Bench Press33, One-Arm Dumbbell Row154 and Bulgarian Split Squat354 retain exact compact imagery.
- [Second Curl active screenshot](pass2-curl-active.png): focused anatomy plus exact hero, unchanged foreground hierarchy and header height.
- [Active Curl superset member](superset-active.png): anatomy cue plus exact hero, independent machine member retained.
- [Compact mixed superset](superset-plan.png): exact Curl thumbnail beside uncovered Machine Shoulder Press91 anatomy.

Three weakest visual areas identified and corrected after the first pass:

1. The Curl figure crowded the title. The shared hero target moved below the title and the upper fade became stronger.
2. A faint rectangular image edge remained visible. Horizontal/vertical masks now blend the image more fully into the dark surface while preserving the action on the right.
3. The Curl compact figure was too small. Stable-key thumbnail metadata now crops toward the action with explicit head clearance. The verified bench/row/lower-body crops use a smaller adjustment. Untuned images retain full-source crops; images larger than80dp remain unchanged.

All placement uses equal width/height; no source image is stretched or edited. Hero layers remain absolute and pointer-transparent with bounded dimensions, cache/recycling and reduced-motion behavior. The existing header does not gain height.

## Validation

- **212/212** automatically discovered accepted behavior contracts pass; the existing49 historical quarantines are unchanged.
- **60/60** cumulative critical regression areas pass, including the new consumption contract.
- TypeScript and changed-file lint: no errors. Whitespace check passes.
- `test-approved-art-consumption.mjs` executes actual SessionV3Movement, SupersetRoundWorkspace and CanonicalMovementArtwork TSX with native host elements represented as trees. It covers all195 mappings, compact/photo, expanded/anatomy+hero, PRE/ACTIVE/remount, mixed superset selection, missing/pending/rejected approval, uncovered91/120, bounded crops, and DEV diagnostic suppression/deduplication.
- Positive approval, immutable identity/recap, equipment, rest, Session lifecycle, History, Programming and routing contracts remain passing. Source-byte human approval checks are unchanged.
- All **1,749** protected artwork/review files hashed before this task remain byte-identical; [preservation receipt](source-preservation.json).

The three isolated DEV QA Sessions1746–1748 were removed without any saved sets. All17,932 original SetLogs remain byte-identical; original W7 SARMS1711 was never begun or edited. See [cleanup receipt](qa-cleanup.json).

## Remaining native validation — blocked on Mac unlock

The computer-control tool reports: “The Mac is locked and automatic unlock could not unlock it.” An unlock request was sent while independent work continued. Background simulator captures and normal DEV API fixture setup remained available, but they do not substitute for the missing interaction checks.

Still required before calling the task visually complete:

- Final PRE expanded Curl after composition tuning; tap continuity after remount.
- Expanded PRE and ACTIVE bench33, row154 and lower-body354.
- Expanded uncovered Machine Shoulder Press91 and Cable Upright Row120.
- PRE selected superset member and interactive selection from approved Curl to uncovered machine, including clean hero removal.
- Coach preview using the same requested composition, with read-only controls preserved.

## State-machine / blast-radius assessment

The change touches artwork presentation as Session phase and selected member change. It does not modify Session lifecycle transitions, subject selection, identities, performed snapshots, writes, prescriptions, equipment, ordering or rest. Adjacent consumers share CanonicalMovementArtwork, so tests protect their eligibility, fallback and saved identity. No auth, onboarding, billing, relationship or entitlement behavior was changed. Compile checks are supplemented by real TSX consumer execution, live-definition/approval audit, source hashes and the native screenshots above. Confidence in full visual convergence remains explicitly limited until the outstanding native pass is completed.

**DEV ONLY · NO NEW ART GENERATED · NO TESTFLIGHT · NO PRODUCTION.**
