# Equipment picker historical context and cable art — DEV

The picker remains the existing canonical movement → manufacturer → allowed
equipment type → confirmed Session equipment flow. `WorkoutItem.movement_definition_id`
is the movement subject. The shared backend `equipment_usage_for_movement` now
projects `canonical_movement_exposures`, the same immutable SetLog evidence used
by Movement History, into manufacturer/type latest exposure summaries. No names,
global manufacturer recency, programmed item configuration, or comparable-load
inference establishes history.

The manufacturer step offers one most-recent quick-select only when a valid
movement-matched exposure includes a canonical equipment ID allowed for this
subject. It saves through the normal equipment endpoint with that ID as a
server-checked expectation. A stale or mismatched ID returns 409 before the
Session assignment. The usual refresh confirms the exact saved ID. The step
orders used manufacturers by performed recency; unused rows retain deterministic
ordering. Manufacturer and type rows show the History representative Set, RIR/RPE
when recorded, and last-used date. Unused types receive no borrowed performance.

Cable type cards reuse the approved selectorized stack image. The new generic
plate-loaded cable image received exact-image owner approval for TestFlight on
2026-09-25 (master SHA-256 `39b4147cac317f71b61d8e8f1859791e5482617944ace3d7695b4654c1c0cfad`).
It lives under `artwork-review/equipment-types/`
with its master, 80 px preview, exact prompt and hash-bound `review.json`.
The movement-art reviewer is for exact canonical movements, so a physical
equipment category is kept in a separate review track. Production artwork stays
on its unchanged channel.

## Visual gate

Inspected the canonical iPhone 17 / iOS 26.2 simulator from the current DEV
Metro source against a labeled QA Session. First pass found three weaknesses:
the missing quick-select on the initial render, a machine-only cable prompt in
the Logger, and a two-line manufacturer heading with cramped history copy.
Corrected the quick-select placement, cable copy, title scale and copy size,
then inspected the second pass. The final manufacturer, cable version and
Movement History screenshots were captured. The first two art generations
failed 80 px readability; the retained third candidate shows plates, pulley
and grip at picker size. Its exact internal load path remains a human review
point, explicitly recorded in `review.json`.

Native QA selected Watson / Selectorized Cable Station for Cable Curl, and
the canonical Session refresh confirmed equipment ID 649 with zero Sets added.
The manufacturer step showed Watson Sep 16 ahead of Life Fitness Sep 10; Watson's
version showed selectorized evidence and an unused plate-loaded choice, while
Life Fitness showed plate-loaded evidence and unused selectorized choice.
The second movement, Machine Chest Press, surfaced Hammer Strength rather than
Cable Curl's manufacturers. Movement History used the same SetLog records;
its recorded-load labels were aligned so 45.36 kg × 12 and 40.82 kg × 10
match the picker. The labeled QA Sessions and newly minted QA-only equipment
definitions were removed after inspection. The simulator returned to the
preexisting active Post-Session Review Walkthrough Session.

## Validation

- TypeScript and `git diff --check`: pass.
- Equipment art, recency, canonical picker, selection, equipment subject,
  session exposure snapshot and Movement History focused scripts: pass.
- Backend equipment usage suite: 10 tests pass, including exact-ID rejection,
  recency, movement/athlete isolation and parity with full History.
- Five targeted backend equipment identity tests: pass.
- Broader backend accessory identity suite: 76/79 pass. Three tests outside
  the changed picker projection fail: missing ankle-weight seed, Archer Row
  retirement history, and the previously documented 12-versus-10 query budget.
  The first two are not attributed to this change; their baseline status was
  not established in this pass.

State machine touched: equipment choice read → exact-identity write → Session
refresh. Adjacent systems validated: movement identity, History, saved SetLog
snapshots, comparability boundaries, equipment models, superset subject and
canonical art gating. Auth, onboarding, billing and relationship routing were
not changed.

The subsequent TestFlight promotion is recorded separately in the r39 release
validation. This file records the earlier DEV visual gate and the later exact
image approval.
