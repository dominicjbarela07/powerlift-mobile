# Self-Coach mobile Phase 1

## Owner authorization and scope

The owner approved the four v2 storyboard illustrations and directed “Approve these illustrations. Let’s begin phase 1”. The approved references are the first-workout, planning, Ledger and return/recovery v2 boards in `docs/design/self-coach-mobile-rebuild-storyboards/`. This records design-reference approval. Catalog movement-art review remains governed by its own exact-image approval records.

Implement Phase 1 in canonical DEV for Mobile 3.0. Deliver the complete training loop through normal Self-Coach entry points, including the shared dark/purple design system, retained floating glass dock with labeled Train/Plan/Progress destinations, contextual Train states, immediate workout start, unified exercise search, direct set logging/editing, compact rest, completion, resume and repeat. Include missing-target correction, standalone reuse and local retry recovery where they are dependencies of that loop. Carry all existing capabilities into the appropriate reachable destinations while the later Plan and Ledger implementation phases proceed.

## Acceptance

The owner reaffirmed the product terminology rule in the instruction “I don't work out. I train. So these are training sessions, not workouts.” The rule is already in the parent release constitution. Correct Phase 1 copy, accessibility, Education, adjacent API messages and other product copy found in the audit in canonical DEV. Recognize legacy generated default titles at display time. Retain the exact approved storyboard assets, protected Education source lineage, and existing Session behavior. Verify the corrected copy in the running app and retain a regression check.

A fresh verified Self-Coach can start training without a program wizard, find an exercise across the governed catalog, record a real set, edit it, finish, reopen the saved workout and repeat it. An interrupted workout resumes the same persisted identity. Save feedback distinguishes pending, confirmed and failed states, retains input and prevents duplicate evidence. Original comparison policy, zero-load validity, assistance direction, exact movement/variant history and equipment separation remain acceptance requirements.

Use the approved v2 first-workout and recovery boards as the direct Phase 1 visual references. Inspect actual canonical DEV screenshots, identify three weak areas, correct them and inspect a second pass. Validate normal Self-Coach, Athlete and Team Coach navigation boundaries, plus actual handler/API save and resume contracts. Record source tests, actual device observations and remaining gaps separately. Destination is canonical DEV and the running development app.

## Architecture and preservation

AuthContext and the server own identity, self-link, readiness, workspace mode, entitlement and execution capability. Reuse the canonical mutation, request journal, equipment setup, recognition and history contracts. Keep the canonical floating glass dock and its platform/reduced-transparency/keyboard behavior. Use existing approved movement artwork by canonical movement identity. Preserve all existing DEV work and release protections. No new native build or publication is included in Phase 1 authorization.

## Approval evidence

Exact board hashes and owner text are recorded in the adjacent `SELF_COACH_PHASE_1_APPROVAL_2026-11-10.json`.

## Implemented in canonical DEV

- **Train** opens on the current action: start, resume, open a saved workout or continue planning. Starting a standalone workout opens exercise search directly. Governed Core lifts, exact variants and accessories share one search; equipment and prescription tools remain available for exercises that require them.
- **Active workout** brings the exercise, approved movement art, exact history, weight and reps onto one surface. Tap a saved set to edit it. The compact rest control and labeled floating glass dock remain available. Straight sets in an unprescribed workout accept optional effort; existing prescription and equipment requirements remain in force. The logger keeps typed values when a save fails, reconciles pending saves, and binds edits and retries to their original set slots.
- **Workout saved** uses confirmed sets for the highlighted result, set count, exercise count and recorded volume. An explicit finish confirmation distinguishes unfinished slots from saved work. Quick Finish leaves performed duration unset; the detailed recap preserves the existing evidence and duration workflow.
- **Repeat** copies the workout structure to a new occurrence without rewriting the completed workout. **Save as routine** creates reusable structure. **Plan** lists routines and leads to existing schedule, program and meet tools. **Progress** opens the existing Ledger.
- First-use guidance now follows Train, direct set entry and Progress. The exact approved education change is recorded in `config/self-coach-phase1-education-delta.json`, with original visual assets and protected source evidence retained. The legacy movement-history estimate adapter now applies the same metric to the chart and summary, without changing stored sets.

## Visual comparison and iteration

Compared the actual iPhone Air app against the approved first-workout and return/recovery boards. The implemented layout uses dark plum surfaces, purple actions, visible iron and movement subjects, and open exercise and set rows. The first pass exposed cramped dock labels, a rest picker that interrupted logging, and loss of focus on the new exercise after adding it. The next pass resized the label area, moved the normal rest flow into the inline control, and focused the exact exercise just added. Inspection also corrected the iron crop, header continuity and misleading unfinished-workout copy. The final workout pass reduced vertical spacing so the cyan rest control clears the dock while the lifter and loaded bar remain visible.

## Evidence and boundaries

Local source: TypeScript, 23 mobile check groups and 57 distinct backend tests across seven groups passed. The final Phase 1 backend group was rerun after its fifth test was added. Coverage includes navigation role isolation, canonical save/edit/recovery, workout composition and prescription, zero-load validity, exact history, keyboard/sheet ownership, Education image transport and runtime lineage. Deliberate regressions rejected lost empty-workout recovery, altered protected Education evidence, and the legacy history summary inflated from 120 to 160. The final simulator history shows a 120 lb estimate in both the chart and summary, with the original two 100 lb × 6 Bench sets visible.

Persistence: six concurrent routine requests with one command key against DEV Postgres produced one routine and five replay acknowledgements. The completed source set rows were unchanged. Backend acceptance also verified standalone repeat and start, unauthorized owner denial, no fabricated targets or repetitions, bodyweight zero, and the guard against a second active workout.

Device observation: a verified Individual Self-Coach used the ordinary DEV app on iPhone Air, iOS 26.2. Verified first start without a program, exercise search/add, direct save, interrupted save with values retained, successful retry, same-workout resume after relaunch, in-place set edit, repeat set, bodyweight set, finish, detailed recap, save as routine, Plan discovery, and repeat of the completed workout. The completed fictional workout contains three sets across Competition Bench and Push-Up, with 1,200 lb of recorded external-load volume. The handoff account has that workout in Last workout, a named Strength day routine, and a second workout in progress.

The affected state machines are Individual destination routing and active, pending, saved and resumed workout state. Adjacent boundaries are AuthContext/readiness, equipment identity, canonical set history, recognition, templates and Education. The new presentation reuses the existing authorized handlers. Existing Athlete and Team Coach navigation and canonical logger contracts were exercised by regression checks; device observations here are for Self-Coach on iOS.

Delivery: local canonical DEV app and local DEV services. No push, store submission, Production deployment or live artifact claim. Android device observation, store certification and usability pilot remain outside this handoff. The full week agenda and routine authoring are Phase 2. The full Progress redesign is Phase 3. Contextual support delivery and wider resilience/accessibility certification are later-phase work.

Evidence directory: `/Users/dominic/.codex/work/self-coach-phase1-20261110/`. See `source-manifest.json`, `runtime-final.json`, `backend-tests.log`, `backend-phase1-final.log`, `mobile-test-results.json`, the final history regression logs, and `postgres-reuse-replay.json`. Simulator captures: `train-final.png`, `active-final.png`, `completion-second-pass.png`, `plan-final.png`, and `recovery-input-retained.png`.

## Simulator walkthrough

1. **Train → Resume session.** Enter weight and reps, then tap **Save set**. Tap the saved row to edit it. Use **Add exercise** to try the unified search.
2. **Finish → Save session.** The saved screen shows the confirmed result. Use **Save as routine** to name reusable structure, or **View session** for the original set evidence.
3. **Done → Train.** Open **Last session** to revisit it, or use **Repeat** once the current session is finished.
4. **Plan → Routines.** The saved **Strength day** routine is already available. **Your schedule** and **Programs & planning tools** lead to the current planning surfaces.

## Terminology correction

The copy audit corrected Phase 1 labels, accessibility text, Education, generated defaults and errors, along with older web labels and messages. New standalone Sessions and copies of the old generic title use **Training Session**. Train, the logger and the recap apply that title to the old generated default at display time. The exact Education correction is recorded separately in `config/self-coach-education-session-language-delta.json` and verified against the accepted Phase 1 source.

TypeScript, the Phase 1 terminology and handler guard, Education transport, Athlete Home and post-Session contracts, 42 targeted backend tests and syntax checks for the edited web templates and script passed. The guard deliberately rejects the superseded wording in JSX and accessibility labels. The broader backend run showed 37 programming and performance history failures that reproduced with the previous copy. One stale test assertion for a changed error message was corrected and passed in the targeted rerun. The logs are `session-language-backend.log`, `session-language-baseline.log` and `session-language-backend-targeted.log` in the evidence directory.

The iPhone Air DEV app displayed **Training Session**, **Resume session**, **Back to session**, **Finish session**, **Save session**, **Session saved** and **View session** in the connected flow. The app was left on Train. The corrected capture is `train-session-language.png`.

