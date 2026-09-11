# Free-weight push movement family — DEV implementation and validation

The family contains **51 exact canonical movements**: 17 chest, 12 triceps, 12 front delts and 10 side delts. The approved incline-dumbbell image is unchanged; 50 new reviewed images are registered by MovementDefinition ID.

**Implementation is in canonical DEV. Final acceptance is limited by one remaining interaction check: the movement-search picker could not be operated in this run.** Native Logger, Session Workspace and Movement History were inspected in two screenshot passes. The picker API and exact artwork resolution pass for every qualifying ID; this is not a substitute for its missing interactive visual check.

## Inventory and selection

[Complete grouped inventory with every ID/name/implement/status/PNG](INVENTORY.md) · [Full metadata, aliases, retirement/ownership audit and exclusions](taxonomy-audit.json) · [Master/app/thumbnail path and SHA-256 manifest](asset-manifest.json).

A read-only transaction against local DEV audited all 633 definitions. Selection uses stored governed primary taxonomy, never display-name or secondary-muscle inference:

```sql
SELECT id, key, display_name FROM movement_definition
WHERE identity_status = 'canonical' AND retired_at IS NULL
  AND material_parameters_json::jsonb #>> '{accessory_taxonomy,execution_family}' = 'FREE_WEIGHT'
  AND material_parameters_json::jsonb #>> '{accessory_taxonomy,primary_muscle_group}'
      IN ('chest','triceps','front_delts','side_delts')
ORDER BY id;
```

All 51 selected rows are active canonical public/global identities. Weighted Push-Up qualifies under stored FREE_WEIGHT; Weighted Dip is BODYWEIGHT and excluded. Missing-primary legacy definitions and unrelated Core identities are excluded. The audit preserves ambiguous generic equipment and sidedness rather than changing database identity. Squeeze and Hex Press retain separate catalog IDs despite overlapping mechanics.

## Generation, original control and results

- Existing artwork audit: **1 KEEP, 0 REGENERATE, 0 REVIEW**; the other 50 definitions lacked exact photos and used existing focused-muscle fallbacks.
- **79 candidate calls = 50 initial candidates + 29 refinements.** Individual review accepted 50 and rejected 29; every attempt has a final decision. No pending final asset.
- Original ID 33 is byte-identical, SHA-256 `e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe`.
- Every generation/refinement used the original incline image as style control. Edit targets and two first-party mechanics references never became a new style baseline. Early attempt records omit the complete input-reference array; the original style control is identified throughout, and later records retain all input paths.
- Native masters are preserved; only unaltered Lanczos downsizing creates 512-pixel app and 192-pixel thumbnail PNGs. No vector substitutes, anatomy overlays, text or manufacturer branding.
- [Durable visual grammar and anti-drift procedure](../../FREE_WEIGHT_MOVEMENT_ARTWORK_SPECIFICATION.md): dark studio, graphite apparel, natural athlete/skin, realistic neutral metal, textured floor, restrained violet rear rim; movement-dependent camera with full equipment/figure framing.
- [Initial plan and final accepted-prompt index](generation-plan.json), [individual reviews](reviews.json), and [eight direct-original family checkpoints](family-review.md). The resulting family has consistent photographic/material treatment while varying support, implement, grip and movement phase.

A single still cannot establish a pause, alternating sequence or full rolling repetition. Tiny tiles communicate silhouette and support; grip details remain clearer in the larger exact-movement view. The final art is individually reviewed, not a claim of third-party biomechanical certification.

## Canonical integration and state safety

The existing `canonical-movement-artwork.ts` resolver now owns an explicit numeric-ID table with expected governed key and primary muscle. The existing asset map contains all 51 independent paths; the shared `CanonicalMovementArtwork` renderer is retained. No name/alias matching or generic press sharing selects these assets.

Effective/performed canonical identity remains authoritative. ID/key/primary contradictions fail closed, including nested performed/programmed identity contradictions that previously could fall through to other outer data. Unresolved substitutions cannot display the original prescription as the performed movement. Core IDs are a separate domain, and unrelated machine/custom/legacy fallback behavior remains covered.

**State machine touched:** artwork resolution across programmed, effective, performed-canonical, governed performed, resolved-legacy and direct-picker identities. No identity transition, persistence schema or SetLog write contract was changed.

**Adjacent systems:** Logger/coach preview, Session authoring, approved swaps, self-coached swaps, equipment selection, exact History, Accessories/Ledger artwork and the shared renderer. Three presentation-only frame sizes were adjusted; auth, athlete/coach relationships, workspace ownership, entitlement, onboarding, aggregate anatomy and release configuration were not modified.

**Why regression confidence is reasonable:** 51-ID coverage tests check stable IDs/keys/primary taxonomy, conflicts, missing identity, swaps, excluded/Core isolation, unique files and every PNG hash/dimension. Real local search DTOs resolve all 51 images; an actual draft Session serialized eight matching effective identities. Existing accepted contracts exercise authoring/navigation, equipment, substitutions, Session lifecycle and artwork consumers. Native screenshots confirm the served filesystem changes. Interactive picker navigation remains explicitly unvalidated here.

## Native visual gate

Canonical iPhone 17 / iOS 26.2, Expo Go, `exp://127.0.0.1:8081`, live local API, authenticated coach preview for athlete 12. These are unaltered native screenshots, not storyboard substitutes.

| Surface | First pass | Weak area and correction | Second pass |
| --- | --- | --- | --- |
| Session Logger plan | [Before](native/logger-pass1.png) | 42-point row image underrepresented arm/support geometry; increased to 52 points. Full labels remain visible. | [After](native/logger-pass2.png) |
| Session Workspace/programming | [Before](native/workspace-pass1.png) | 48-point image was undersized beside multiline title/prescription; increased image and owning frame to 64 points. | [After](native/workspace-pass2.png) |
| Exact Movement History | [Before](native/history-pass1.png) | 86-point image left unused width in a 96-point frame; made both dimensions 96 and prevented shrink, retaining title width. | [After](native/history-pass2.png) |

Second-pass inspection confirms coherent original/new art, complete visible figures/implements and intact movement labels. Logger shows chest press, seated/standing dumbbell shoulder press, plate front raise and side-delt lateral raise together. Exact History shows the new barbell triceps isolation. [Existing incline History](native/existing-history-33.png) still shows its original image, 8 exposures and 32 sets. The new EZ-Bar Skull Crusher correctly has zero recorded exposures; no evidence was fabricated to populate the screen.

The isolated **draft Session 1732** held IDs 33/79/80/84/103/289/292/297. It was never assigned, started or logged. [Serialized identity proof](qa-session-serialized.json) and [creation/cleanup receipt](qa-session.json) show only this task's draft; cleanup verified zero SetLogs and deleted that draft through the DEV API. Simulator was returned to existing saved Session 1498.

**Remaining validation:** movement-search UI interaction and live back/selection operations could not be exercised. Computer Use repeatedly returned `cgWindowNotFound`, including after Simulator restart and device reboot; native `simctl` screenshots/deep links continued to work. Browser bootstrap reported no available browser and discovery returned an empty list. [Real search API proof](qa-search-serialized.json) confirms 17/12/12/10 correct scoped results and shared-resolver coverage, but a visible/unlocked controllable Simulator is still needed for the final picker visual check. No navigation or mutation pass is claimed from screenshots alone.

## Runtime and checks

Literal `npm start` on the intentionally dirty canonical DEV tree reported:

```text
[canonical-dev-metro] SOURCE PREFLIGHT PASS
[canonical-dev-metro] Working tree contains local changes; Metro will run against current filesystem state.
branch: dev/canonical-mobile
clean: false
Starting Metro Bundler
Waiting on http://localhost:8081
```

[Full startup receipt](metro-startup.log). The simulator connected and rendered the new asset files in the second pass. Existing Expo patch-version notices were informational; dependencies were not changed.

- **198/198 accepted behavior contracts passed**; 49 existing quarantined historical harnesses remain unchanged. [Full output](accepted-tests.log).
- `npx tsc --noEmit`: PASS after final runtime changes.
- Targeted ESLint: zero errors; 17 pre-existing warnings in SessionEditingWorkspace's unchanged code.
- Final focused family test also passes against all 51 real search DTOs and the eight real serialized Session identities.
- One old source-regex test initially pinned the collapsed image to exactly 48. Updated it to check the shared renderer in the correct collapsed/expanded function, then reran the full suite successfully; no test was quarantined or disabled.
- `git diff --check`: PASS. No package/runtime/environment changes.

## DEV handoff

Mobile source is committed/pushed on `dev/canonical-mobile`; the corresponding PT-first ledger entry is on `dev/canonical-backend` in `docs/development-log/2026-09-11.md`. Commit hashes are reported in the task response and ledger. Local raw audit artifacts and unrelated backend changes are excluded from staging.

**NO TESTFLIGHT. NO PRODUCTION.** No OTA publication, release projection, channel mutation, build upload, backend deployment or Production mobile 2.0.2 change occurred.

## Rejected candidates

Every rejected attempt and its specific correction remains inspectable below. The accepted replacement for each ID is in the manifest.

| Canonical ID | Attempt | Rejection reason |
| --- | --- | --- |
| 32 | 1 | Far shoe clipped at right edge. |
| 35 | 1 | Dumbbell axes vertical rather than horizontal neutral-grip pressing. |
| 35 | 2 | Corrected axes but reverted to pronated/flared press, not neutral grip. |
| 36 | 1 | Far shoe at image edge; crop resilience inadequate. |
| 38 | 1 | Inner hex dumbbell heads merged into one shared central head; not two real independent dumbbells. |
| 42 | 1 | Bar sleeve and far shoe meet/clipped at frame edges; needs crop margin. |
| 43 | 1 | Bar is a mid-press height, not the distinctive near-chest Spoto pause; left sleeve also clipped. |
| 43 | 2 | Near-chest bar gap now correct, but far shoe is clipped; retain mechanics and correct only framing. |
| 45 | 1 | Generated an incline bench instead of horizontal guillotine setup; bar remains too high. |
| 45 | 2 | Flat bench and wide high-chest path corrected; far shoe still clipped and needs framing-only refinement. |
| 47 | 1 | Initial prompt specified the camber on the wrong side of the grip. Manufacturer's pressing reference confirms raised central chest-clearance section between hands, with hands on lower outer straight grips. Rebuild geometry; do not reuse this candidate. |
| 47 | 2 | Functional camber now correct, but unnecessary tall rack uprights were copied from geometry reference and clip at top; remove rack only. |
| 79 | 1 | Upright seated overhead press is correct, but a small bright logo-like chest mark violates unbranded apparel; remove mark and improve top margin. |
| 45 | 3 | Framing fixed but model raised bar toward lockout, losing the high-chest guillotine cue; return to attempt2 mechanics for targeted framing edit. |
| 86 | 1 | Press mechanics and bar continuity are coherent, but left landmine base is cropped by square edge. |
| 105 | 1 | Supported incline and framing are coherent, but supinated-looking grip and arm plane resemble incline fly too closely. Needs pronated lateral-abduction view. |
| 106 | 1 | Body leans toward the support with feet away, the inverse of lean-away mechanics. Top of post also exits frame. Needs feet beside post and torso leaning outward. |
| 110 | 1 | Lu arc and plate grip are correct, but molded letters/numerals appear on plates, violating no-text/no-brand artwork rule. |
| 290 | 1 | Elbows/upper arms remain too vertical and bar too high, resembling a skull crusher rather than JM hybrid. Need forward lower upper arms and bar near upper chest. |
| 290 | 2 | Side view improved upper-arm angle, but loaded bar remains above forehead rather than close to upper chest; still too similar to skull crusher. |
| 291 | 1 | Straight bar is plausible but elbow flexion too shallow to clearly read skull crusher, and far shoe is clipped at right edge. |
| 292 | 1 | EZ bar identity is distinct and extension phase plausible, but far shoe exits right edge; deepen elbow fold for a more characteristic near-head phase. |
| 293 | 1 | Neutral-grip dumbbells and deep elbow hinge are plausible with natural overlap, but far shoe is clipped. Needs framing only; retain pose. |
| 290 | 3 | Low upper-chest hybrid arm position improved, but bar became too short/dumbbell-like and hands nearly merged; needs unmistakable separated barbell grips. |
| 295 | 1 | Foot rollers are present but bench slopes in incline orientation; head is higher than hips. Regenerate true head-low decline from side. |
| 290 | 4 | Barbell restored but pose reverted to ordinary close-grip pressing with vertical forearms; far shoe cropped. Need actual JM mechanics reference rather than repeating text-only correction. |
| 298 | 1 | Weights above face instead of inward onto upper chest, bench still inclined, and each dumbbell has mismatched head sizes. Regenerate flat-bench bottom Tate position. |
| 300 | 1 | Correct two-hand single dumbbell and bent-elbow overhead pullover position, but far shoe clipped at right. Framing-only correction required. |
| 290 | 5 | Style, full framing and barbell improved, but forearms remain too upright and bar stays over the face. It reads as a skull crusher rather than the inventor's low chin/throat JM transition. |
