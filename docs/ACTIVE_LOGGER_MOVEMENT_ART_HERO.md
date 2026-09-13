# Approved movement art in compact and expanded Logger views

Canonical DEV currently has **195 exact approved free-weight assets**. The count
comes from the positive human receipt projection, not filenames or automatic QA.
The complete current audit is in
[approved inventory](validation/movement-art-consumption-2026-09-13/approved-inventory.json).

## Ownership and eligibility

`resolveApprovedExactMovementArtwork` remains the single positive eligibility
resolver: normalized governed movement ID, matching registered key and taxonomy,
current human-approved mapped candidate, valid app-byte receipt, and no denial.
`assertHumanArtworkGate` checks the review projection and actual file hashes when
canonical `npm start` runs. A missing/contradictory identity never inherits a photo
from a name, Session item ID, equipment ID or different performed movement.

`resolveMovementArtworkPresentation` separates two jobs:

| Presentation | Compact artwork | Atmospheric hero |
| --- | --- | --- |
| Compact plan/member | Exact approved image, otherwise focused anatomy | None |
| Expanded PRE movement/member | Focused target anatomy beside title | Exact approved image |
| Expanded ACTIVE movement/member | Focused target anatomy beside title | Same exact approved image |
| Expanded completed movement | Focused target cue | None; recap uses its own canonical image slot |
| Uncovered/pending/rejected expanded movement | Focused anatomy | None |

Session phase is deliberately absent from photographic eligibility. Superset
selection is per member: selecting uncovered equipment removes the previous
member's hero. The title cue is intentional anatomy and is never an eligibility
error. Logger callbacks, prescriptions, ordering, equipment, rest and lifecycle
writes are unchanged.

## Composition

`MovementArtworkHero` owns one absolute, pointer-transparent layer and uses the
existing foreground header bounds. It adds no layout height. The same approved
512px source is reused with stable artwork-key focal metadata in
`lib/movement-artwork-hero.ts`. Horizontal and vertical black fades protect the
left prescription and title. The subject target sits center-right below the title;
the lower figure fades out rather than extending the header. Sources are never
modified or regenerated.

Compact crops use `movementThumbnailGeometry`, from the same metadata owner.
Dumbbell Curl gets a modest upper-body crop with head clearance; validated bench,
row and split-squat crops use a smaller adjustment. Unreviewed crop compositions
retain the full source. Crop dimensions stay square and bounded. Images larger
than 80dp retain their existing full-image presentation; small cards use the
thumbnail derivative where resolution is sufficient, otherwise the approved
512px derivative. No independent screen registry exists.

The hero is memoized, uses memory/disk caching and candidate-bound recycling, and
has a 160ms image transition (zero under reduced motion). It subscribes to no
Session/rest timer and contains no write callbacks.

## Diagnostics and safeguards

Exact-art consumers report a deduplicated DEV-only warning when a positive receipt
exists for the canonical ID but the expected image is missing or ineligible.
The warning includes surface, ID, key, candidate and normalized source, without
athlete-facing copy. Intentional target anatomy and uncovered/denied movements
are excluded. A warning does not override failed identity or approval checks.

`test-approved-art-consumption.mjs` executes the real compact/expanded/superset
TSX consumers with native host elements represented as trees. It checks every
approved mapping, source import, PRE/ACTIVE/remount, independent coverage,
pending/rejected/missing receipts, thumbnail geometry and diagnostic behavior.
Native screenshots remain a separate visual acceptance requirement; see the
[validation record and outstanding checks](validation/movement-art-consumption-2026-09-13/README.md).

The hidden DEV focal lab remains a composition study, never an approval surface.
The existing `__DEV__` boundary still excludes this photographic family from
release bundles. This task authorizes **DEV only**, with no TestFlight or
Production publication and no new art generation.
