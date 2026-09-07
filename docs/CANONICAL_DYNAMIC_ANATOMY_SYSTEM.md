# Canonical Dynamic Anatomy System

## Product rule

Strength Ledger has one dynamic anatomy renderer. Full-figure anatomy is an
aggregate evidence surface for a Session, week, muscle group, or athlete
summary. One exact movement continues to use `CanonicalMovementArtwork`, as
required by the Individual Movement Artwork Law.

The distinction is semantic, not cosmetic:

- Aggregate evidence → `MuscleMap`, normally through
  `ProgrammingMuscleRegionArt` or `GovernedMuscleThumbnail`.
- Exact movement identity → `CanonicalMovementArtwork` and its governed Core,
  Core Variant, or focused Accessory asset.

No screen may recreate or reposition anatomy overlays locally.

## Root cause of the retired system

The previous registry used one approximate front path set and one approximate
rear path set. Feminine presentation was produced by translating and scaling
the masculine-like overlays as a group. Several consumers then applied another
private visual scale. Flat, high-opacity highlight shapes obscured the muscle
texture in the master artwork. Those three coordinate systems produced the
visible floating ellipses, spill outside the silhouette, cropped evidence, and
sex/presentation drift.

## Registered architecture

All four approved masters are transparent 418 × 941 PNGs:

- `masculine-front-v1.png`
- `masculine-rear-v1.png`
- `feminine-front-v1.png`
- `feminine-rear-v1.png`

`anatomy-mask-registry.tsx` contains four independent path registries in that
same native coordinate space. Every governed muscle ID is explicitly present
in every registry; a muscle that is not visible from a view has an empty path
list. Bilateral and segmented anatomy is represented by multiple paths rather
than by a generic oval.

`MuscleMap.tsx` owns the complete render stack:

1. registered master image;
2. secondary and primary paths, clipped by the alpha silhouette of that exact
   master;
3. a subtle redraw of the same master to preserve texture and anatomical seams.

The SVG `viewBox` crops and scales the master and its overlays together. The
framing bounds are unions of masculine and feminine registered geometry so a
valid crop for one presentation cannot clip the other. Consumers set only a
container size; they do not scale the figure.

## Governed coverage

The contract covers Chest, Lats, Upper Back, Traps, Front Delts, Side Delts,
Rear Delts, Biceps, Triceps, Forearms, Abs, Obliques, Lower Back, Glutes,
Quads, Hamstrings, Adductors, Abductors, and Calves. The existing governed
taxonomy also retains Serratus, Hip Flexors, and Neck.

Primary and secondary roles remain visually distinct. The renderer normalizes
IDs through the governed taxonomy; display names never select anatomy.

## Consumer inventory

| Product surface | Anatomy type | Governed entry point |
| --- | --- | --- |
| Athlete Home current/next Session | Session aggregate | `ProgrammingMuscleRegionArt` |
| Training Hub Session cards and current plan | Session aggregate | `ProgrammingMuscleRegionArt` |
| Block detail and Program timeline | Session/week aggregate | `ProgrammingMuscleRegionArt` |
| Calendar and Coach Calendar | Session aggregate | `ProgrammingMuscleRegionArt` |
| Coach Activity, Athlete Hub, and Athlete Hub sheet | Session/athlete aggregate | `ProgrammingMuscleRegionArt` |
| Post-Session hero and performed-muscle evidence | performed Session aggregate | `ProgrammingMuscleRegionArt` |
| Accessories development hero | period aggregate | `MuscleMap` |
| Accessories muscle library and Ledger muscle drill-down | muscle aggregate | `MuscleMap` |
| Session Workspace muscle discovery | muscle aggregate | `GovernedMuscleThumbnail` |
| Session Logger, including standalone and Superset movements | exact movement | `CanonicalMovementArtwork` |
| Swap Accessory confirmation and results | exact movement plus muscle aggregate browse | `CanonicalMovementArtwork` / `GovernedMuscleThumbnail` |
| Programming/Editor movement rows and picker | exact movement plus muscle aggregate browse | `CanonicalMovementArtwork` / `GovernedMuscleThumbnail` |
| Ledger movement cards, history, and Accessory progress cards | exact movement | `CanonicalMovementArtwork` |
| Post-Session movement rows and Coach movement review | exact movement | `CanonicalMovementArtwork` |

The executable `test:anatomy-consumer-convergence` inventory fails if another
file imports full-figure masters, imports overlay geometry, or establishes an
uninventoried direct `MuscleMap` boundary.

## DEV QA lab and handoff gate

DEV Settings exposes **Dynamic Anatomy QA Lab**. Its route is hidden from the
shipping tab bar. It provides:

- masculine/feminine and front/rear/dual controls;
- primary, secondary, and inactive muscle roles;
- all governed muscles;
- thumbnail, card, and hero sizes;
- square, wide, and portrait containers;
- Chest + Triceps, Lats + Biceps, Front + Side Delts, Rear Delts + Upper Back
  + Traps, Quads + Adductors, Hamstrings + Glutes, Abductors, Calves, Abs +
  Obliques, Lower Back, Full Upper Body, Full Lower Body, and Dense Session.

Before dynamic anatomy is handed off, capture and inspect at least:

1. masculine front;
2. masculine rear;
3. feminine front;
4. feminine rear;
5. one dense multi-muscle state;
6. thumbnail, card, and hero framing;
7. Accessories and at least one additional real product consumer.

Identify the three weakest visual areas, correct them, and capture the final
state. Passing a compile check without this visual pass is not completion.

## Permanent invariants

- One 418 × 941 coordinate system per master and its registered paths.
- No correction transforms in the mask registry.
- No circles, ellipses, or rectangles standing in for muscle geometry.
- No per-screen anatomy overlay maps or private figure transforms.
- Highlights never escape the alpha silhouette.
- Master texture and seams remain visible through highlights.
- Feminine geometry is independently authored, not transformed masculine
  geometry.
- Missing identity fails closed under the existing exact-movement artwork law.
- Any new consumer is added to this inventory and the executable guard.
