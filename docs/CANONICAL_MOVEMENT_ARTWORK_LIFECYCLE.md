# Canonical movement artwork lifecycle

Every exact movement image is owned by `CanonicalMovementArtwork`. Its shared
`normalizeCanonicalMovementArtSubject` accepts explicit definition references,
effective/performed canonical identities, completed-recap measurement fields and
immutable performed evidence. Generic root `id` is deliberately absent: a Session
item, SetLog or physical equipment row cannot masquerade as a MovementDefinition.
Catalog/History/Ledger definition DTOs cross `canonicalArtworkInputFromDefinition`.
Logger and editing rows cross semantic references or `canonicalArtworkInputForLoggerItem`.

Saved performed canonical IDs and their matching snapshots take precedence over
programming intent. Conflicting saved IDs fail closed. Available frozen taxonomy
wins over current metadata; otherwise only the same canonical ID can enrich it.
Completed recap's `measurement.canonical_identity_key` is a canonical key, not display
copy. Exact registered IDs can supply missing primary taxonomy. Explicit historical
legacy mappings remain valid even when historical provenance retains its earlier
`legacy_unresolved` state. No label matching or history rewriting occurs.

Photo approval is separate from movement identity. The hierarchy is:

1. Exact mapped artwork with a positive human approval receipt and an available asset.
2. Focused governed muscle-region anatomy for known taxonomy, including governed legacy mapping.
3. Neutral unresolved diagnostic only for missing/contradictory governed identity.

Pending/rejected photos remove photographic eligibility, never muscle identity.
Retired photo registrations still validate immutable historical identity and permit
anatomy. DEV and the explicitly authorized TestFlight channel consume positive
human approval receipts; Production's existing runtime boundary remains intact.
An approved DEV photo is not automatically a release authorization.

`config/movement-art-consumers.json` inventories 18 consumers and 38 render sites.
The executable convergence guard requires explicit diagnostic surfaces, prohibits
root row IDs/object spreads at JSX artwork boundaries, and prevents screen-owned
question-mark art. Renderer diagnostics contain only semantic IDs, key, source,
surface and reason; they are DEV-only and deduplicated. No diagnostic copy is shown
to athletes.

## Governed taxonomy compatibility

`config/governed-movement-art-taxonomy.json` is a generated public-taxonomy projection
of the active global backend catalog, independent of the free-weight photo registry.
It contains no images, approval decisions, user identities or display-name mappings.
Explicit definition IDs (or keys inside typed definition references) recover missing
taxonomy, family, equipment category and canonical key. A generic Session/SetLog row
ID or top-level row key cannot acquire catalog identity. Contradictory governed IDs
and keys fail closed; a physical equipment identity never becomes a movement.

Frozen evidence taxonomy wins. A thin preferred definition may use richer metadata
from another reference only when its stable ID agrees. Otherwise the projection
supplies missing metadata for that exact governed identity. Invalid direct taxonomy
cannot mask supported nested taxonomy or a governed family. Canonical Core IDs use
their explicit Core foreign key and retain competition/variant semantics.

Recovering a key is not photo approval. Positive current receipts and matching assets
remain mandatory; pending/rejected photography retains focused anatomy. The current
catalog has 195 exact approved accessories, 376 anatomy accessories and 30 Core entries.

After a governed catalog change, run `venv/bin/python scripts/export_movement_art_taxonomy.py`
from canonical backend DEV and commit the resulting projection. The exhaustive
`test-governed-movement-art-taxonomy.mjs` tests every catalog entry across definition,
initial Logger hydration, performed references, saved evidence, recap measurement,
and deterministic legacy contracts. The release harness also checks the live DEV
catalog against the projection and refuses stale metadata. Backend serialization
and seven-movement same-Swap contracts live in `tests/test_governed_movement_art_serialization.py`.

Unresolved DEV diagnostics include definition/effective/performed IDs, key, family,
primary muscle, taxonomy presence/provenance and exact approval state. Known taxonomy
reaching neutral emits a DEV invariant error without throwing a renderer exception.
TestFlight has no internal diagnostic copy or assertions.

| Surface | Canonical entry / ownership |
| --- | --- |
| Pre/active Logger, focused movement, set-entry and navigator | Logger subject → SessionV3Movement, SessionV3Shell, SessionSetEntryContext |
| Superset and Coach preview of execution | Same per-member Logger subject → SupersetRoundWorkspace |
| Evidence Created | CompletedRecapMovement → shared normalizer, saved sets first |
| Shared athlete/Coach completed review and Plan / Compare | CompletedSessionRecap, including its canonical image-source helper |
| Programming Manager and Session Workspace | SessionEditingWorkspace and InlineSessionReorder; semantic effective identity |
| Search / Swap / approved substitutions | GovernedAccessoryPickerModal, ApprovedSubstitutionPicker, SubstitutionConfirmationSheet and Session Workspace catalog definition references |
| Athlete Workspace Performance | CoachAthletePerformance definition adapter; explicit Core variant IDs |
| Ledger index, Accessories and movement exploration | Shared definition adapter |
| Core Variants | Explicit Core movement ID, governed parent family, independent variant identity |
| Movement History | Typed canonical History definition adapter |
| Training Hub, Calendar Session cards and aggregate focus | Session summaries/aggregate anatomy, not independent exact-movement fallback engines; opening a Session reaches the canonical surfaces above |

The old AccessoryMuscleRegionMedallion has no consumers; the convergence guard
prevents its reintroduction. Aggregate anatomy remains under MuscleMap and its
existing consumer guard. This task changes no overlay/master geometry.

Permanent tests: `test-movement-art-lifecycle.mjs` and
`test-movement-art-consumer-convergence.mjs`, both automatically accepted contracts
and explicitly part of the cumulative release-critical gate. Coverage includes all
195 current exact registrations, legacy mapping, no photo, pending/rejected photo,
substitution A→B, equipment materialization, independent superset members, missing
keys, row-ID collisions, contradictory evidence and frozen taxonomy. A backend
recap contract verifies preserved canonical ID/key/taxonomy and unchanged input.

## Compact identity versus expanded target cue

Approved exact images now lead compact Session Plan and superset rows. Expanded
PRE and ACTIVE movements keep focused target anatomy beside the title and mount
the approved exact atmospheric hero independently. `resolveMovementArtworkPresentation`
owns that distinction; eligibility does not depend on whether training has begun.
This does not change the effective/performed identity or any Session transition.

The approved-consumption contract executes the actual TSX consumers for all current
positive receipts and all coverage states. Missing expected exact art produces a
DEV diagnostic, while intentional anatomy cues are excluded. See
[composition ownership](ACTIVE_LOGGER_MOVEMENT_ART_HERO.md) and
[validation status](validation/movement-art-consumption-2026-09-13/README.md).
