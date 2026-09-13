# Equipment category close-ups — DEV

Completed September 13, 2026, 9:31 AM PT (12:31 PM Eastern).

The owner's final framing direction is authoritative: **a close-up of the plate load, and the weight stack and pins**. Exactly two category images are integrated. No movement, manufacturer-specific, cable, free-weight or bodyweight artwork was added.

## Final assets and ownership

| Governed key | App asset | Selected visual |
| --- | --- | --- |
| `plate_loaded` | `assets/images/equipment-types/v1/plate-loaded.png` | Two concentric mounted plates, a straight loading horn and visible supporting machine structure. |
| `selectorized` | `assets/images/equipment-types/v1/selectorized.png` | Rectangular stack slabs, guide rods and a centered inserted selector pin with retention cord. |

Both are square, unbranded, text-free close-ups with graphite/steel materials, near-black surroundings and restrained violet detail. Original generated masters are in `assets/images/equipment-types/v1/masters/`; the app uses 512px copies. Only mechanical resampling was used for derivatives; all content changes used built-in ImageGen. [Asset manifest](asset-manifest.json) records exact paths, dimensions, SHA-256 hashes and selected generation paths. [Exact prompts](prompts.json) preserve generation and correction instructions.

`lib/equipment-type-artwork.ts` owns the typed mapping using the existing `MachineEquipmentType` keys. `EquipmentTypeChoice` only renders and invokes the existing callback. The workout route enables these cards for DEV machine subjects. Cable and release presentations retain their existing rows; the map is null and its image requires do not execute when `__DEV__` is false. No release bundle or release deployment was created.

The existing manufacturer → allowed type → confirmed equipment save sequence remains intact. No changes were made to the manufacturer registry, search, permitted types, current/used calculation, request payload, model handling, exact comparison policy or movement identity resolution. Single-type subjects receive one horizontal card.

## Candidate record

Generated source files remain under `/Users/dominic/.codex/generated_images/01a08943-0eb2-7290-8c5d-18b31580104e/`.

- Plate initial `exec-a5a51ec4-08e1-4f88-abb0-727240513041.png`: whole-machine composition superseded by the owner's close-up correction; not mapped.
- Plate close-up `exec-6660428b-802d-4d29-afed-c9329650c36f.png`: selected. Both mounted plate rims and the sleeve tip fit within the square; the machine bracket establishes attachment.
- The initial full-machine selector request was canceled when framing changed; no full-machine selector asset is mapped.
- Selector close-up `exec-73fd590d-9168-4073-bb66-a7ced1945eaa.png`: withheld because the pin socket was offset from the hole column.
- Selector correction `exec-163effcb-4622-4e06-8010-a9a25806e1a9.png`: withheld because an offset steel neck remained.
- Selector final `exec-4fa699fc-bfa6-44bd-959b-cb1c00025a71.png`: selected after making the pin compact, flush and concentric with the hole column.

These are equipment-category illustrations. No human movement-art review decisions were created or modified, and all 195 approved movement mappings remain untouched.

## Actual mobile visual gate

Canonical `npm start` ran from the dirty DEV checkout, passed lineage validation and served the current filesystem on port 8081. See [runtime proof](runtime-proof.log). Inspected Expo Go on iPhone 17, iOS 26.2, against the real local DEV API.

The first native pass exposed three weak areas: the label container collapsed beneath the images; the two-line question dominated the sheet; the fixed-height sheet left excessive empty space. Removed the collapsing text flex, shortened this DEV type-step heading to “Equipment type,” and sized the sheet to its content. The second pass confirmed readable labels and close-ups. A final alignment refinement reserves equal description height so current/used labels and chevrons align.

- [First native pass](picker-pass-1.png)
- [Second native pass](picker-pass-2.png)
- [Final native picker](picker-final.png)
- [Plate current after reopening](plate-current.png)
- [Selector current after reopening](selector-current.png)
- [Plate at 80px](plate-loaded-80.png), [stack at 80px](selectorized-80.png)

Inspected all final images without clipping. Mounted discs versus stacked slabs remain distinct without labels at 80px. The selector's violet pin is still visible. The two cards use the same image scale, square containment, surface, typography and lighting family. The manufacturer brand is existing UI, not baked into the category art.

## Validation and limits

- Five focused mobile checks pass: category map/assets/release guard, canonical picker, equipment gating, superset context and completed-session correction. [Results](mobile-test-results.json).
- TypeScript passes. Focused ESLint has zero errors; the existing large workout route retains warnings.
- Backend: seven equipment usage/history tests and three identity/model/immutable-history tests pass. Logs and native API snapshots are in backend `docs/validation/equipment-type-art-2026-09-13/`.
- The older `test-equipment-selection.mjs` still fails its source-pattern assertion for the logger's secondary action row. The inspected `core-loggers.tsx` is byte-for-byte unchanged from HEAD, and the same pattern fails against HEAD. This preexisting failure was not suppressed or represented as passing. [Baseline proof](preexisting-test-failure.json).
- Real native taps saved `arsenal_strength:plate_loaded` and `arsenal_strength:selectorized`, then reopening showed the correct CURRENT state on each respective card. Back returned to the manufacturer list. Canonical/effective movement ID **48**, its complete serialized identity and WorkoutItem **18094** stayed unchanged; distinct physical equipment IDs were **647** and **27**. The backend reused the existing selectorized identity and created the valid DEV plate equipment configuration through its normal API. The comparison policy remained `exact_implementation`.
- Testing used only an isolated DEV draft, Workout **1744**, for the authenticated DEV athlete. Zero performed sets were created. The draft was deleted after validation. Model-history and immutable performed-evidence coverage came from backend tests, not invented native SetLogs.

State machine touched: the presentation of the existing subject → manufacturer → allowed equipment type → confirmed equipment context flow. Adjacent systems are equipment usage/history, comparability, exact models, superset continuation and immutable performed identity. Confidence comes from the unchanged subject/write handlers, focused regressions, actual saved API responses, reopened native states and inspected screenshots. No auth, relationship, onboarding, entitlement or workspace implementation changed.

**DEV ONLY. NO TESTFLIGHT. NO PRODUCTION. Production 2.0.2 mobile runtime untouched.**
