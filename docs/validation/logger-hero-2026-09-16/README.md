# Canonical Logger art presentation — September 16, 2026

T-Bar Row is the locked reference. This change corrects presentation without changing movement identity, approved asset bytes, decisions or compact thumbnails.

## Cause and correction

T-Bar Row used focal geometry plus the full hero canvas fade. Incline Machine Chest Press used the approved contain metadata, but the renderer gave it a smaller square (62% of height) with only a 3.5% edge feather and an almost fully visible floor through 96% of hero height. The near-black studio background therefore read as a photograph rectangle.

The source is valid. This is a renderer defect exposed by opaque photographic backgrounds and varied source framing, not a reason to regenerate approved art. `MovementArtworkHero` now uses the same T-Bar Row canvas fade for every composition. Contained sources have more visual weight, keep their full frame inside the hero, and feather interior raster edges. Native source dimensions align that edge treatment to non-square exports. Focal placement, opacity, transitions, approval eligibility and target anatomy remain unchanged.

## All approved assets audited

[Per-asset measurements and hashes](asset-audit.json) cover 380 mappings / 380 unique images: all RGB, no alpha, 377 at 512×512 and three non-square exports. Every file matches its exact approval receipt. All have some non-black studio lighting/floor at their outer edges and require canvas integration. Contact sheets of all 380 were inspected. There is no new matte or artwork export to replace.

The three valid non-square exports are Machine Front Raise #94 (512×427), Machine Glute Bridge #432 (512×490), and Machine Lateral Raise #121 (512×469). Their actual raster bounds now own the edge feather. The two low bright-area heuristic flags, Ulnar Deviation #337 and Windshield Wiper #540, describe naturally narrow/upright and wide/floor compositions, not excessive blank padding; the latter was also checked natively. No source normalization or regeneration was necessary. Luminance measurements are screening evidence, not semantic segmentation or a new approval decision.

## Native visual gate

Canonical DEV Metro on port 8081, iPhone 17 simulator, existing DEV focal lab mounting the actual `SessionV3Movement` and `MovementArtworkHero`. The attachment supplied the written visual standard but no screenshot files; the baseline was captured from current canonical T-Bar Row and Incline Machine Chest Press.

The three weaknesses in the first pass were the visible photo boundary, small machine/athlete scale, and the separately visible floor/corners. The second pass corrects those through the shared renderer. Inspected T-Bar Row #197, Incline Machine Chest Press #49, Seated Dumbbell Shoulder Press #79, Standing Dumbbell Curl #256, Bulgarian Split Squat #354, Machine Glute Bridge #432, and Windshield Wiper #540. Full-size native screenshots show readable movement/action, consistent black integration and retained anatomy/prescription hierarchy. No image is stretched; contained machines retain their full source frame. Peripheral equipment/floor can fade atmospherically, as in T-Bar Row.

T-Bar Row before/final hero region `(0,735)-(1206,1480)` has **zero differing pixels**, after the final source-dimension change. This is a simulator comparison, not an assertion that the absent user screenshots were pixel-matched.

- [Incline press before](incline-before.png)
- [Incline press corrected](incline-final.png)
- [T-Bar Row unchanged](tbar-final.png)

## Lifecycle and regression scope

PRE and ACTIVE single-movement detail use `CoreExerciseLedgerCard` → `SessionV3Movement`; Coach Athlete Preview enters the same canonical workout renderer. Selected superset members use the same `MovementArtworkHero` with the existing superset canvas color. Compact Session plan, recap, Ledger and other thumbnails are unchanged.

The actual TSX contract renders all 380 approved sources in DEV and TestFlight modes, checks source PNG dimensions/aspect, common canvas fade, PRE/ACTIVE/remount, superset selection and fallback eligibility. The geometry test verifies full contained bounds, original aspect ratios, sufficient visual weight and locked T-Bar Row coordinates. TypeScript and all 222/222 accepted contracts pass in canonical DEV. The release publisher repeats accepted/protected/route/approval/native-compatibility checks before publication. The old consumer test needed its native source-dimension host mock updated; no contract was removed or quarantined.

Only presentation is modified. No movement-ID architecture, current identity, history, SetLog, equipment policy, authentication, account state or persistence changes. Adjacent lifecycle/Coach-preview authority remains covered by the existing accepted contracts. Final TestFlight visual verification belongs to the owner.

## Release

Canonical DEV commit/push and existing TestFlight OTA are authorized. No native build. Production unchanged. Publication IDs are recorded in the backend development ledger and task delivery receipt after the publisher verifies served bytes.
