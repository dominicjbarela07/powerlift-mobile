# Ledger earned-medallion lettering correction — DEV

Owner rejects the malformed “SL” in the earned-PR medal. Correct the two letters
so they read cleanly at the actual118-point hero and62-point compact sizes.
Preserve the gold medal/rim/barbell composition, transparency, earned-PR rules,
source actions, compact Ledger spacing and all other artwork. Retain the original
v1 asset and create a versioned replacement. No new movement art or approval
manifest change, backend/data change, Production/TestFlight/native release.

The current source itself contains broken/staggered letter geometry. Use the
built-in imagegen edit workflow for this raster asset, inspect the replacement's
letter accuracy and both native display sizes, then use it in canonical DEV.
Keep generation provenance and exact selected asset hash. Validate asset alpha,
existing Ledger visual/art/source/navigation contracts and TypeScript. Push DEV,
verify exact source/runtime and leave Milestones open to the corrected medal.

Result: generated v2 uses two ordinary capital letters on one horizontal baseline.
Selected after inspecting the actual1254×1254 RGBA source and native118/62-point
presentations. The large Milestones medal and compact Records latest-PR badge
both visibly read SL. Their original earned evidence and qualifying-set actions
are unchanged. The original v1 PNG hash is still
`a64d3d86488322d3384c4ed6bac1f90403cda93c0df9466ed80f951d4e31bfad`.

Tool: built-in image_gen.imagegen, raster edit with transparency preserved.
Exact prompt, original source, generated source and selected hash are retained
in assets/images/ledger-cleanup/earned-pr-medallion-v2.generation.json. Runtime
uses the versioned v2 require, avoiding reuse of the old native cache key.
Only LedgerEarnedMedallion's asset selection changed; both current consumers
share it. Other movement/award/brand assets and old source bytes are retained.

PASS: dimensions, true RGBA alpha0–255 and transparent corners; preserved v1 hash;
actual Ledger material/art/source-qualification guards and TypeScript. Native
118-point and62-point captures are milestones-corrected.png and
compact-corrected.png in /Users/dominic/.codex/work/ledger-medallion-mark-20261030/.
Visual letter accuracy is based on inspected pixels at actual sizes, not an OCR
or filename assertion. Reuse the unchanged navigation/history/material evidence.
This is an asset correction, not a new scoring/qualification or account state
machine. No backend mutation, Production/TestFlight publication or native build.

Delivery: canonical dev/canonical-mobile based on
282773360b76d4645c1cbf3670a39dfde62a3ad3. Post-push source/remote/Metro identity is
retained in canonical-runtime.json in the evidence folder. Leave Milestones open.
