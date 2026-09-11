# Canonical free-weight movement artwork specification

September 11, 2026 · DEV only · One canonical free-weight family: push and pull/posterior branches

## Fixed master reference specimen

The approved [Dumbbell Incline Bench Press master](../assets/images/movement-artwork/free-weight-v1/masters/dumbbell-incline-bench-press-v1.png) is the immutable visual control specimen. SHA-256: `e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe`. Its native 1254 × 1254 pixels remain unchanged. Every generation and refinement receives this original as its first reference, including when a second image is supplied as an edit target. No descendant becomes a style reference for another movement.

## Locked visual grammar

- Environment: nearly black studio fading into a dark charcoal textured floor, faint environmental depth, no gym clutter or mirrors. Floor light stays below the athlete and metal highlights in visual importance.
- Photography: realistic commercial fitness photography, normal-to-short-telephoto perspective, roughly 60–70 mm lens feel, natural skin pores, fabric wrinkles, believable metal and grounded equipment shadows. No glossy plastic skin or painterly smoothing.
- Athlete: muscular adult with credible proportions, neutral expression and controlled exertion. Graphite sleeveless training shirt, black shorts and dark shoes; no branding, jewelry, decorative accessories or sexualized styling. The athlete is performing the exact movement, with its mechanics as the subject.
- Lighting: broad neutral key from upper left/front and restrained violet rim from rear right. Magenta may be a faint reflection, never a dominant color wash. Skin is naturally colored, graphite equipment stays neutral, and brushed metal reflects light coherently. No neon outlines or colored muscle overlays.
- Camera: adjust azimuth and height to expose the defining mechanics. Flat/decline/incline bench angle, grip orientation, arm path, seated/standing/floor support and unilateral/bilateral execution must be legible. Do not clone the incline composition for incompatible movements.
- Composition: one square image, one athlete and required equipment. Aim for 8–10% edge clearance and roughly 75–85% longest-axis occupancy; avoid cutting off shoes, weights, bar ends, bench supports or hands. Keep the implement and action large enough for mobile. Use the existing `contain` renderer and proportional frame corners.
- Equipment: matched dumbbells with continuous handles and two credible heads; straight or intentionally cambered bars with symmetric loading and collars; mechanically coherent benches with supported pads and connected frames. Different implements may have different silhouettes while retaining the baseline's metal treatment.
- Contrast: readable hands, implement, apparel boundaries and body position at 42–64 points. Preserve detail at 120 points and above. No bright shoe soles or floor pools competing with the action.
- Anatomy separation: no overlays or muscle evidence baked into movement artwork. Aggregate evidence remains exclusively in the existing Dynamic Anatomy System.

## Identity and inventory

The [read-only database audit](validation/free-weight-push-family-2026-09-11/taxonomy-audit.json) contains the exact SQL, all qualifying IDs, aliases, ownership, retirement state, primary/secondary muscles and equipment metadata, plus exclusion reasons. Selection requires `identity_status = canonical`, no retirement, `execution_family = FREE_WEIGHT`, and primary muscle in `chest`, `triceps`, `front_delts`, `side_delts`. Secondary involvement and names never qualify a row. There are 51 qualifying definitions (17/12/12/10 in that group order).

All qualifying rows are public/global. Private/custom and retired definitions are audited but not silently promoted. Core/legacy definitions without the requisite governed primary/equipment taxonomy remain outside this pass. Weighted Push-Up qualifies under its stored FREE_WEIGHT classification; Weighted Dip is stored BODYWEIGHT and remains outside. No taxonomy or performed evidence is rewritten to enlarge the list.

Artwork is registered by canonical MovementDefinition ID with its expected stable key and governed primary muscle. A conflicting identity must fail closed. Aliases and labels remain discovery/display data, never runtime artwork selectors. Similar but separate catalog entries retain independent IDs and file paths. If their mechanics genuinely overlap, documentation must say so rather than inventing a movement difference.

## Generation and acceptance procedure

1. Read the individual audited identity, equipment, sidedness and aliases. Record its distinguishing mechanics and the chosen representative phase/camera before generating.
2. Use built-in image generation, one call per candidate, with the original master attached. Independent candidates may run concurrently; acceptance is individual.
3. Inspect the full generated image for hands/limbs, grip, joint path, bench/support geometry, loading symmetry, realistic contact and crop safety.
4. Compare directly with the original master. Downsample only to the existing 512-pixel app and 192-pixel thumbnail PNG conventions; inspect the actual compact presentation. Never use cosmetic editing to conceal incorrect anatomy or machinery.
5. Reject/refine ambiguous mechanics, malformed equipment, missing contact, duplicate limbs, wrong grip/posture, crop loss, tiny subject, or material/light/style drift. Preserve each attempt and review decision in the generation manifest.
6. After approximately 5–8 accepted assets, inspect a contact-sheet family comparison with the original master repeated as the anchor. Correct drift against that original before the next group.
7. Inspect representative actual canonical `npm start` mobile surfaces, identify the three weakest visual areas, correct them and inspect a second native screenshot pass. Cover chest/triceps/front/side delts, barbells/dumbbells, seated/standing work across Logger, programming, search and evidence.

The single still represents a phase; temporal properties such as a Spoto pause, an alternating sequence or rolling extension cannot be fully demonstrated by one frame. Choose their most characteristic distinguishable phase, preserve the exact label and do not claim a still proves the complete repetition.

Only reviewed assets enter the canonical map. Masters, prompts, hashes, inventory paths, candidate/refinement counts and rejection reasons remain durable review evidence.

**NO TESTFLIGHT. NO PRODUCTION.**

## Mechanics references and catalog ambiguities

The following first-party demonstrations supplement the governed identity audit; they do not decide family membership:

- [Dave Tate / elitefts rolling extensions](https://elitefts.com/blogs/training/rolling-tricep-extensions): shoulder travel accompanies elbow extension, so the still uses the behind-head transition.
- [Paul Carter demonstrating the PJR Pullover](https://www.youtube.com/watch?v=7_qGnTUiRCc): the elbow bends in the lengthened position and extends to initiate the return. The representative image must not become a straight-arm pullover.
- [Elitefts JM Press demonstration](https://elitefts.com/blogs/training/elitefts-com-swiss-angle-grip-bar-jm-press): the upper-arm position and forearm fold distinguish the short hybrid extension pattern.
- [JM Blakley teaching his own press](https://elitefts.com/blogs/training/how-to-perform-the-jm-press-a-step-by-step-guide-from-the-inventor): the definitive correction uses elevated elbows, forearms folding back toward the chin/throat and wrists rocked back. The initial cue conflated elbow flare with upper-arm angle and led to rejected skull-crusher/close-grip-press candidates. Attempt 6 uses a side view to expose the raised elbow and folded forearm. The inventor's demonstration photograph is a mechanics-only reference; the original incline image remains the sole style reference.
- [Elitefts Spoto demonstration](https://elitefts.com/blogs/training/spoto-presses-rep-week-on-bench-press): the defining pause occurs off the chest. The image preserves a visible gap; a still cannot establish its duration.
- [Muscle & Strength Bradford demonstration](https://www.muscleandstrength.com/exercises/standing-alternating-front-back-barbell-press.html): partial overhead travel alternates front and rear positions. The representative phase keeps elbows bent and the bar clear of the head.
- [Ma Strength's exercise guide](https://chineseweightlifting.com/olympic-weightlifting-training-exercises/): the Lu/bumper-fly raise continues through a lateral arc to overhead using plates. The catalog leaves the free-weight implement generic; this artwork depicts that established plated version, without changing metadata. The same guide confirms the side-lying lateral-raise support and abduction plane.

Squeeze Press and Hex Press are separate catalog IDs with substantially overlapping mechanics. Their independent art shows round versus hexagonal dumbbell contact, not an invented change in movement history or recognition. Equipment values such as `free_weight` do not encode a unique implement; the generation plan records the implement chosen to depict the named governed exercise without changing its metadata.

The catalog builder defaults `sidedness` to bilateral unless a name explicitly says single-arm or alternating. Consequently Lean-Away and Lying Dumbbell Lateral Raise retain that stored value even though a supported repetition is naturally shown one arm at a time. The audit retains the discrepancy verbatim; this artwork task does not change loading, sidedness, taxonomy or historical evidence. An image of one side is representative execution, not an identity migration.

The [manufacturer's cambered bench-bar demonstration](https://elitefts.com/products/elitefts-black-4-cambered-bar) confirms the raised middle section creates chest clearance between the lower outer hand grips. The initial generated camber orientation was rejected after this check; future prompts must preserve the functional relationship, not merely an unusual bend. Product photography may be supplied as geometry-only reference, with the original incline photograph remaining the sole style control. No manufacturer logos, apparel or gym environment are copied into family artwork.

## Pull/posterior branch — same original control

The [fresh DEV pull audit](validation/free-weight-pull-family-2026-09-11/taxonomy-audit.json) reviews 633 definitions, finds 49 canonical FREE_WEIGHT candidates and qualifies 47 after semantic review: lats 10, upper_back 16, rear_delts 9, traps 9, lower_back 3. There is no distinct mid_back primary category. Good Morning 546 and Zercher Good Morning 548 are deferred with lower-body hinges. Barbell Back Extension 545, spinal-articulation Jefferson Curl 547 and Weighted Sorenson Hold 549 remain direct posterior-trunk work; Farmer Carry 240 remains governed traps-primary loading despite not being a literal pull. Biceps/forearm isolation, serratus reach, neck work and hamstring/glute hinges are separately documented future-family boundaries.

- Rows: expose torso angle, support/contact, elbow travel and implement. Pendlay uses a horizontal torso and floor origin; continuous barbell rows show loaded clearance. One-arm knee/palm support, three-point standing support, prone bench support and landmine end orientation must be visually distinct.
- Rear delts: hinge/prone torso and horizontal shoulder abduction distinguish reverse flys from upright lateral raises. Row variants retain bent elbows; flys retain softly bent, lengthened arms. Show posterior shoulder geometry without colored overlays.
- Pullovers: show a long shoulder arc, bench/torso relationship and soft elbow angle. Do not reproduce triceps-extension elbow mechanics under a lat-pullover ID.
- Shrugs: show scapular elevation/retraction under load with long elbows; ordinary relaxed weight holding is insufficient. Carry art shows gait and loaded posture. Kelso variants require their scapular rather than elbow-driven action.
- Posterior trunk: show supported hip/pelvis contacts and free external implement; spinal articulation and rigid-spine hip hinge are not interchangeable. Weighted Sorenson is a supported horizontal hold, not a hyperextension repetition.
- Family checkpoints: original incline master PLUS representative accepted push images PLUS every newly accepted group of roughly 5–8 pull images. Push examples are comparison context only, never substitute style inputs.

Generic catalog implement/sidedness defaults remain metadata, not permission to falsify the movement. Any representative unilateral mechanics despite a stored bilateral default, or overlap between separately governed names, must be disclosed in the pull audit notes. No historical identity, taxonomy, load convention or evidence is rewritten by artwork selection.

### Pull mechanics references and representative choices

- [Jeff Nippard's Pendlay / Helms demonstration](https://www.youtube.com/watch?v=axoeDmW0oAY): floor-origin rowing and the braced standing alternative require different support and torso silhouettes. Helms art must preserve the hinged, top-edge chest brace; an upright lean against the entire pad was rejected.
- [John Meadows / elitefts back demonstrations](https://elitefts.com/blogs/training/your-guide-to-a-mountain-dog-back): the Meadows loaded-end row remains distinct from a parallel one-arm landmine row and a two-hand attached row handle.
- [Janae Kroc's first-person interview, published under the name used at the time](https://criticalbench.com/interview_powerlifter_Matt_Kroczaleski.htm): Kroc rows are heavy one-arm dumbbell rows with a high-repetition identity. Artwork shows the standing braced top pull; a photograph cannot prove repetition count.
- [Dan John, published by On Target](https://www.otpbooks.com/dan-john-training-longevity/): batwings emphasize the contracted position with hands near the armpits. Do not depict them as straight-arm scapular shrugs.
- [Gareth Sapstead's rear-delt demonstration](https://t-nation.com/t/capped-delts-healthy-joints-a-complete-workout/281928): the prone swing represents an abbreviated outward arc, distinct from a full reverse fly.
- [Jon Hodgkinson's dumbbell exercise demonstrations](https://www.jonhodgkinson.com/golf-exercises-with-dumbbells/): archer rowing adds torso rotation at the top; the photograph retains the floor-supported plank and drawn-back working elbow.
- [Daniel Aipa demonstrating the Gorilla Row](https://archive.t-nation.com/training/tip-do-the-gorilla-row/): one kettlebell rows while the other remains grounded. The generic governed free-weight implement is represented by two kettlebells, without changing loading metadata.
- [Janus Performance's Kelso demonstration](https://www.janusperformanceconsulting.com/blog/kelso-shrugs-the-best-trap-and-upper-back-exercise-youre-not-doing) and [elitefts' bent-over scapular-row discussion](https://elitefts.com/blogs/training/beyond-the-barbell-row-5-game-changing-lessons-from-the-pendlay-row): Kelso action is short scapular retraction with long elbows. ID205 depicts supported barbell execution, ID241 supported dumbbells, and generic ID242 a bent-over barbell version. These are representative free-weight setups, not invented changes in identity.
- [Greg Everett's back-extension demonstration](https://www.catalystathletics.com/exercise/425/Back-Extension-Hyperextension/) and [his direct explanation of spinal versus hip extension](https://www.catalystathletics.com/article/1767/The-Back-Extension-Strengthening-the-Back-for-Weightlifting/): direct posterior-trunk extension can use a light bar across the upper back, with pelvis/thigh and ankle support. This supports including ID545 while deferring the standing Good Morning hinges.
- [GymnasticBodies / Christopher Sommer's Jefferson Curl description](https://www.gymnasticbodies.com/coach-christopher-sommer-new-tim-ferriss-book-tools-titans/): light external loading accompanies segmental spinal articulation on an elevated platform. The rounded spinal posture is intentional for this exact identity; it must not be redrawn as a rigid-spine deadlift or a maximal-load lift.
- [Town Athletics' weighted Sorensen hold](https://www.townathletics.com/blog/2020/3/16/pullup): horizontal supported posture with external weight at the chest. The catalog spells ID549 “Sorenson”; retain its stable key/name. The still identifies the setup, not elapsed hold time.

The catalog's paired names overlap in several places: Chest-Supported Dumbbell Reverse Fly / Incline-Bench Rear-Delt Fly (127/128), generic supported / incline dumbbell row (194/196), rear-delt / wide-elbow rows (129/130 and 131/204), and the Kelso entries. Each retains a distinct canonical asset and history. Camera, phase, support angle and permitted implement can vary honestly; do not assert an unsupported technique difference or infer performance transfer.

Archer, Meadows, Kroc and Three-Point rows carry the catalog builder's bilateral default even though the representative repetition is unilateral. Preserve this finding in the audit. Sidedness, per-hand conventions and historical performed snapshots require their own governed change; artwork does not silently correct them.
