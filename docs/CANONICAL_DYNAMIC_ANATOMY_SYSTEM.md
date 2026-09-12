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

## Root cause of the retired systems

The first retired system used one approximate front path set and one approximate
rear path set, transformed those paths between presentations, and allowed
consumer-specific scale corrections. The attempted v2 correction removed the
transforms but still painted opaque SVG shapes over a raster sculpture. Even
when a path sat on the correct canvas, it replaced the master material and added
its own outline. The eye therefore read a sticker laid over a mannequin instead
of an illuminated muscle. Shared coordinates alone did not solve material
continuity.

## Registered architecture

The renderer now uses a raster-master/registered-segment architecture. All four
approved graphite masters are transparent 418 × 941 PNGs:

- `masculine-front-v1.png`
- `masculine-rear-v1.png`
- `feminine-front-v1.png`
- `feminine-rear-v1.png`

Each master has two deterministic, master-derived 418 × 941 material layers:

- `*-primary-material-v2.png` — violet illuminated gunmetal;
- `*-secondary-material-v2.png` — magenta illuminated gunmetal.

The generator preserves every source alpha pixel and remaps source luminance
into a controlled material ramp. The original fiber texture, contour lighting,
separation ridges, and dimensional highlights therefore remain in the colored
layer. `npm run build:anatomy-materials` reproducibly rebuilds the eight layers.

`anatomy-mask-registry.tsx` contains four independent segment registries in the
same native coordinate space. Every governed muscle ID is explicitly present
in every registry; a muscle that is not visible from a view has an empty path
list. Bilateral compartments are stored left first and right second, remain
separately addressable, and are never mirrored or transformed at runtime.

`MuscleMap.tsx` owns the complete render stack:

1. registered graphite master image;
2. one same-coordinate alpha segment mask for each active governed muscle;
3. the matching magenta or violet material master revealed through that mask;
4. a restrained graphite seam-recovery pass.

There are no runtime fill colors, outline strokes, per-muscle coordinates, or
screen-specific corrections. The material and base images have identical
dimensions and alpha silhouettes; a segment changes which pixels of that same
sculpture are visible.

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

`MuscleMap` has two explicit modes that share the same registered masters,
segment masks, material layers, and framing system:

- `semantic` renders governed primary and secondary roles for programming,
  Session, week, and muscle-group contexts;
- `exposure` renders a normalized value for every governed muscle supplied by
  an evidence owner. Exposure mode does not apply semantic role caps, and it
  never turns prescriptions into performed evidence.

The Accessories exposure owner is the archive projection. One completed
Accessory `SetLog` in the selected period contributes one exposure unit to the
exact movement's governed primary muscle. Secondary muscles are intentionally
not assigned fractional work because Strength Ledger has no validated
physiological dosage model for that inference. The metric is therefore a direct
performed-working-set count, not tonnage, planned work, or an estimated stimulus.

`normalizeAnatomyExposure` anchors the highest positive count at `1.0` and uses
`sqrt(count / maximum)` for the remaining values. This preserves rank and equal
values, makes a single trained muscle unambiguously `1.0`, returns no heat for
no evidence, and keeps lower real values legible under an extreme outlier. The
palette stays inside graphite, dark violet, violet, bright violet, and a
controlled violet-magenta peak. The ranked Accessories rows use the same
normalized values and ramp as the body.

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
| Accessories muscle library and Ledger muscle drill-down | muscle aggregate | `MuscleMap`; library highlight arrays remain stable across display-unit changes |
| Session Workspace muscle discovery | muscle aggregate | `GovernedMuscleThumbnail` |
| Session Logger, including standalone and Superset movements | exact movement with compact targeted-muscle context | `CanonicalMovementArtwork`; `accessoryPresentation="muscle-focus"` keeps the governed regional cue left of the name, including when an approved exact hero is visible |
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
- Automatic/masculine/feminine preference resolution;
- bilateral/left/right segment inspection;
- primary, secondary, and inactive muscle roles;
- all governed muscles;
- thumbnail, card, and hero sizes;
- square, wide, and portrait containers;
- explicit Primary / Secondary and Exposure Heatmap modes;
- a controlled Chest 100%, Lats 80%, Triceps 60%, Quads 40%, Calves 20%
  exposure fixture, plus a dense realistic Accessory fixture;
- Chest + Triceps; Chest + Front Delts + Triceps; Lats + Biceps; Lats + Upper
  Back + Rear Delts; Upper Back + Traps; Side Delts; Quads + Adductors;
  Hamstrings + Glutes; Glutes + Abductors; Calves; Abs + Obliques; Lower Back;
  dense Push, Pull, and Lower Sessions; and a full multi-muscle Accessory block.

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

`npm run audit:anatomy-geometry` emits one isolated-segment sheet for each of
the four registered masters. Every governed region is shown alone in its
actual master coordinate space; regions that are not visible from that view
are deliberately dim. Run this audit after any master or mask edit and inspect
all four sheets before product screenshots.

## Permanent invariants

- One 418 × 941 coordinate system per master and its registered paths.
- No correction transforms in the segment registry.
- No circles, ellipses, or rectangles standing in for muscle geometry.
- No per-screen anatomy overlay maps or private figure transforms.
- Highlights never escape the alpha silhouette.
- Base and material layers must have byte-identical alpha channels.
- Master texture and seams remain visible inside highlights.
- Flat SVG fills and sticker outlines are prohibited.
- Feminine geometry is independently authored, not transformed masculine
  geometry.
- Missing identity fails closed under the existing exact-movement artwork law.
- Any new consumer is added to this inventory and the executable guard.
- Exposure heatmaps and semantic role views must use the same segment registry;
  a screen-specific heatmap geometry map is prohibited.
- A trained muscle's ranked evidence row and body segment must use the same
  normalized exposure value.

## Runtime and memory policy

The application decodes four base masters and two material variants per active
presentation/view only as requested by React Native's asset loader. Material
masters are shared and cached across muscle segments; a screen does not decode
one colored full-resolution bitmap per muscle. Only governed active segment
masks are mounted (currently capped by role normalization), and list consumers
use cropped thumbnail/card viewBoxes rather than separate high-resolution
compositions. No 4K layer is decoded in a scrolling list.
