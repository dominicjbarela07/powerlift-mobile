# Complete free-weight head/gaze audit

September 11, 2026 · canonical DEV · source commit `888c58c302112960ccc2c08b6067893ab5f20b2a`

**All 198 registered free-weight images were visually reviewed. Twenty-two were corrected; 176 retain identical master, app and thumbnail files.** This completes the user's broader request following the initial High-Bar Squat correction. The earlier visual review missed independent sideways and over-shoulder head turns; this pass explicitly judges head direction against the torso and movement plane.

## Corrections and direct comparisons

| Batch of origin | Corrected governed IDs and movements |
| --- | --- |
| Push (10) | 90 Bradford Press; 103 Dumbbell Lateral Raise; 104 Seated Dumbbell Lateral Raise; 106 Lean-Away Dumbbell Lateral Raise; 107 Lying Dumbbell Lateral Raise; 109 Partial Dumbbell Lateral Raise; 110 Lu Raise; 111 Dumbbell Upright Row; 112 Wide-Grip Barbell Upright Row; 297 Single-Arm Dumbbell Overhead Triceps Extension |
| Pull (5) | 131 Rear Delt Barbell Row; 150 Dumbbell Archer Row; 205 Chest-Supported Kelso Row; 237 Behind-the-Back Barbell Shrug; 241 Chest-Supported Kelso Shrug |
| Completion (7) | 259 Single-Arm Preacher Curl; 327 Behind-the-Back Wrist Curl; 337 Ulnar Deviation; 349 High-Bar Squat; 360 Lateral Lunge; 526 Landmine Rotation; 527 Russian Twist with Weight |

Every corrected image was inspected individually at generated resolution and again in the following four comparison sheets. BEFORE panels come from the source commit, not from overwritten local files.

- [Comparison 1: presses and raises](comparisons/group-01.jpg)
- [Comparison 2: raises, rear-delt/archer/Kelso rows](comparisons/group-02.jpg)
- [Comparison 3: shrugs, curls and wrist work](comparisons/group-03.jpg)
- [Comparison 4: squat, lunge and rotations](comparisons/group-04.jpg)

[All 198 individual decisions](FULL-AUDIT.md) and [machine-readable decisions](audit-decisions.json) record retained as well as corrected images. Seventeen audit sheets cover the full inventory. The initial single-squat correction preceded those sheets, so ID 349's evidence points to its original-versus-corrected comparison instead. Camera angle alone is not a defect: natural three-quarter views and supported torso orientation are retained. Exercise-defined neck flexion, extension and lateral flexion (580/581/582) are preserved. This is a head/gaze review, not a claim to revalidate every exercise's entire repetition mechanics.

## Generation and durable asset provenance

Mode: **built-in image generation, image edit**. Twenty-two accepted edits: the initial High-Bar Squat correction plus 21 subsequent individual edits. Each call receives the immutable original Dumbbell Incline Bench Press master first, and the specific existing movement image second. The prompt limits the correction to head/neck/gaze while preserving pose, equipment, composition, dark studio and violet lighting. All results were explicitly reviewed before materialization.

- [Exact prompts, reference paths and original generated output paths](attempts/) for the 21 sweep edits.
- [Initial squat correction prompt and output](../free-weight-completion-2026-09-11/attempts/349-2.json).
- [Individual acceptance reasons](reviews.json).
- [Complete old-to-new hashes and all 66 destination paths](correction-manifest.json).
- [Original 198-image manifest snapshot](inventory-before.json).

Accepted masters reside under `assets/images/movement-artwork/free-weight-v1/masters/`; app and thumbnail files reside under `assets/images/movement-artwork/free-weight-v1/`. App files remain 512 × 512 and thumbnails 192 × 192. Python/Pillow only copies accepted results, creates size derivatives and composes evidence sheets; it does not edit artwork content. Original generated files remain at the paths in their receipts.

The original ID 33 control's SHA-256 remains `e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe`. Historical Push/Pull manifests are unchanged. A build/test helper permits only exact reviewed old-to-new transitions for the 15 affected earlier assets. The Completion materializer applies the same correction receipts, preventing accidental restoration of rejected head poses. All 176 other image triples are checked against the source snapshot. IDs, expected keys, muscle metadata, consumer paths and registry membership stay unchanged.

## Canonical native visual gate

The existing literal `npm start` process served canonical DEV at port 8081 with local changes. Its startup log reports SOURCE PREFLIGHT PASS and a nonblocking dirty-tree message. It originally started at `f43cd2c`; that startup SHA is historical, not a claim of a fresh launch at the current commit. PID 37284's working directory was rechecked as `/Users/dominic/powerlifting_app_dev/powerlift_mobile`. Expo Go was cold-reloaded to load the changed filesystem assets.

Actual iPhone 17 / iOS 26.2 screenshots supplied the before/after review. The three weakest areas and corrections were:

1. Rear-facing poses exposed a face over a shoulder. Squat, rear-delt row and behind-the-back shrug now show head orientation consistent with the rear torso.
2. Raises used an independent upward/rightward cosmetic gaze. Centered head/neck alignment brings attention back to the movement.
3. Rotation images looked opposite the implement or added an independent shoulderward glance. Head direction now follows the depicted action without changing the torso phase.

| Exact History | First native pass | Inspected second pass |
| --- | --- | --- |
| 103 Dumbbell Lateral Raise | [Before](native-before/103.png) | [After](native-after/103.png) |
| 131 Rear Delt Barbell Row | [Before](native-before/131.png) | [After](native-after/131.png) |
| 237 Behind-the-Back Barbell Shrug | [Before](native-before/237.png) | [After](native-after/237.png) |
| 526 Landmine Rotation | [Before](native-before/526.png) | [After](native-after/526.png) |
| 349 High-Bar Squat | [Before](../high-bar-squat-head-alignment-2026-09-11/native-before.png) | [After](native-after/349.png) |
| 107 Lying Dumbbell Lateral Raise | Original in comparison 1 | [After](native-after/107.png) |
| 150 Dumbbell Archer Row | Original in comparison 2 | [After](native-after/150.png) |
| 259 Single-Arm Preacher Curl | Original in comparison 3 | [After](native-after/259.png) |

All eight final native screenshots were inspected. ID 103 retains its existing 15 exposures / 45 sets. Empty histories remain empty. The initial cold-start capture `103-cold-start-splash.png` is retained as an unsuccessful capture, then replaced for acceptance by the fully loaded `103.png`.

These screenshots were reached through native deep links with the existing athlete 12 / saved Session 1498 preview context. No Session creation, swap, mutation or SetLog write occurred. The prior broader family task's final interactive picker/expanded-card/tap-return gate remains open: Computer Use returned `cgWindowNotFound`. This narrower asset correction's before/after inspection does not claim to complete that unrelated interaction gate.

## Validation and affected systems

- **201/201 accepted behavior contracts PASS**, including family hashes/dimensions, immutable control, all 198 governed identities, contradiction rejection, substitutions, free swaps, equipment, History, subject ownership and release protections. Existing 49 historical quarantines across three groups remain unchanged. [Full output](accepted-behavior.log).
- **TypeScript PASS**, exit 0, no diagnostics. [Validation receipt](validation-results.json).
- New focused correction guard checks the exact 22 approved identities, 176 byte-identical triples, unchanged metadata and destination paths, all current hashes, prompt/reference receipts and rejection of contradictory identity or tampered historical hashes.
- No runtime source code, identity resolver, relationship/auth/workspace state machine, billing, routing, anatomy geometry or release configuration changed. Adjacent artwork consumers receive the same governed asset paths. Regression confidence comes from exact identity/hash checks, unchanged runtime code and inspected native output; no broader navigation or mutation claim is made.

**NO TESTFLIGHT. NO PRODUCTION.** No build, OTA, channel, backend deployment or Production mobile 2.0.2 runtime was changed by this correction task.
