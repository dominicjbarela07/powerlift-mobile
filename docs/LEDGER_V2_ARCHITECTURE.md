# The Ledger V2 — Evidence and Route Architecture

## Product boundary

The Ledger is the athlete-owned evidence record. It renders canonical facts; it does not infer coaching advice, rewrite historical SetLogs, or expose coach-private programming.

## Existing evidence inventory

| Evidence | Canonical source | Ledger use |
| --- | --- | --- |
| Core strength and e1RM | `GET /athletes/mobile/progression` | Core-lift snapshot, observed progression, range context |
| Weight, rep-max, e1RM, and RPE records | `GET /workouts/mobile/accomplishments` and `/current-bests` | Latest entry, PR history, rep-max matrix, achievement detail |
| Sessions, sets, movements, media, meets | Bounded `/mobile/ledger/archive` endpoints | Journey, movement history, Archive, source-detail links |
| Blocks and programs | Immutable session `program_context` in Archive results | Journey chapters and contextual labels |
| General/core movement identity | `movement_definition` projection in Archive evidence | Competition lifts, independent variants, accessories |
| Accessory muscle region | Governed movement family, then legacy fallback | Muscle exploration and approved muscle artwork |
| Equipment | Immutable performed-equipment snapshot when present | Movement and set-detail context only; never canonical movement naming |
| Athlete units/bodyweight | Mobile progression response | Display formatting and contextual evidence |

The current APIs are additive, authorized, bounded, and sufficient for the V2 mobile composition. No schema migration is required for this release.

## Asset inventory

| Asset family | Location | Existing use | Ledger V2 use | Quality / approved |
| --- | --- | --- | --- | --- |
| Muscle-region artwork (25 files) | `assets/images/muscle-regions/` | Accessory movement taxonomy and medallions | Muscle Group overview and detail, resolved through governed family | Existing production artwork; reused |
| Canonical lift achievement art (3 files) | `assets/images/lift-icons/achievement-material-v2/` | Recognition and achievement surfaces | Audited; retained for existing recognition flows while V2 uses compact semantic lift marks | Existing production artwork; approved |
| Major-volume medallions (28 files) | `assets/images/major-volume-medallions/` | Deterministic volume achievements | Audited; not used as decoration without a qualifying canonical event | Existing production artwork; approved |
| Manufacturer marks (27 files) | `assets/images/manufacturer-logos/runtime/` | Performed-equipment presentation | Audited; V2 displays immutable manufacturer text/context only when the source snapshot exists | Existing production artwork; approved |
| Plate and logger render catalogs | `assets/images/plate-stack-catalog/`, `assets/images/logger-renders/` | Session Logger evidence visualization | Audited; source links preserve the canonical Session/SetLog renderers instead of duplicating them | Existing production artwork; approved |
| Ledger identity | Code-native `LedgerBookIcon` | New | Index/header bound-record metaphor | Purpose-built vector-like native UI; no raster placeholder |

No additional raster artwork was required. No placeholder asset ships in a production Ledger path.

## Route architecture

```text
/(tabs)/ledger/home
  journey
  strength
    strength/[movementKey]
  achievements
    achievements/[eventId]
  accessories
    accessories/[movementId]
  variants
    variants/[movementId]
  muscles
    muscles/[muscleKey]
  archive
    archive/[itemType]/[sourceId]
```

Substantial destinations are full-screen stack routes. Source Session and SetLog links terminate in the existing canonical Archive detail renderer.

## Performance contract

- The index composes bounded summary requests and never downloads full history.
- Accomplishments and evidence requests are capped at 50 rows.
- Archive lists use the existing signed cursor and explicit `Continue through history` pagination.
- Movement detail is scoped by canonical movement ID.
- Time filters change request ranges or server date boundaries; they never change labels only.
- Dense lists remain bounded and deeper evidence loads only after navigation.

## Fixture contract

Dense and sparse fixtures use the same typed snapshot consumed by production components. They may be selected only in development through `ledger_fixture=mature|sparse`; production always calls authenticated APIs.

## Mobile layout contract

Every Ledger route receives a full-width canvas. Page roots may not add horizontal gutters. Headers, evidence cards, chapter rows, filters, and other child surfaces own their intentional spacing.
