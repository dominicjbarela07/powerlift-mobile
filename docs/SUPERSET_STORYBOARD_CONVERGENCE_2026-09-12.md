# Canonical Session Logger superset convergence

Approved source: backend DEV `docs/storyboards/session-logger-v3/revision-2/d-navigation.png`, its README, and `docs/CANONICAL_SESSION_LOGGER_V3_AUDIT_2026-09-10.md` section 13. Revision 2 supersedes the original storyboard.

## Drift and correction

The initial V3 route integration retained the older `SupersetRoundWorkspace` with standalone member workspaces, duplicated progress and timelines, and a floating `Log superset round` entry into the batch logger. Subsequent material/equipment fixes preserved that structure. TestFlight matched that canonical source: this was an incomplete storyboard implementation, not a release-only fork or feature flag.

The shared workspace now renders ordered compact rows, each with its own governed artwork/fallback, prescription, equipment state and member label. A restrained group rail and round segments replace the large layered card. Pre-Session uses the same composition with contextual tools revealed by selecting a member. Active execution emphasizes one member; the canonical floating footer owns the only logging action and opens the existing individual accessory Logger. The unreachable alternate nested-card branch is removed.

## Evidence and progression

`superset-workspace-focus.ts` derives selection and the next action from `buildSupersetRoundModel`. Manual inspection persists across unchanged evidence (including units, focus and refresh); accepted Set ordinals invalidate that inspection and suggest the earliest required missing member. Selecting a different incomplete member remains possible for intentional out-of-order work. Inspecting completed evidence leaves the footer targeting the next incomplete member explicitly.

A save is never a synthetic group save. A1 accepted → A2 current, no rest; the last required member accepted → existing rest picker → next round. Four prescribed sets for A1 and three for A2 means four rounds; only A1 appears in the fourth round's required entries. Copy explicitly says A1 only that round. Three or more members use the same ordered model. A finished group routes the footer to movement selection.

Equipment, Swap/approved Sub, History, edit and latest-set delete still call the existing canonical exact-item paths. Only selected-member saved evidence is expanded on demand. Artwork comes from canonical effective movement identity and its existing human-approval gate; no new images are generated or promoted. Existing post-Session individual evidence and group snapshots remain unchanged.

Coach Athlete Preview uses this same component with mutation capabilities disabled. No auth, relationship, entitlement or account-mode transition was modified.

## Validation

- 206/206 accepted behavior contracts; existing 49 historical quarantines unchanged.
- 58/58 release-critical areas, including new superset focus/round/rest tests.
- TypeScript passes; targeted lint has zero errors (132 existing route warnings).
- Actual canonical `npm start` simulator: before screenshot, first compact pass, corrections to artwork size/current typography/round contrast, second inspected pass.
- Two-member pre/active, long-name wrapping, three-member pre/active, independent A1/A2 save, no intermediate rest, round-completion rest picker and Skip Rest return, machine selection, exact History return, saved-set editor and delete controls, self-coached Swap picker and confirmation, unequal fourth round, navigation away/return and shared read-only Coach Preview inspected.
- DEV API/storage checks validate exact canonical/performed IDs and independent equipment; actual edit to A1 and latest A3 deletion/restoration leave B evidence unchanged. Coach Preview writes return 403. API fixture setup supplied rounds 2–3 for the unequal-round screenshot; those rounds were not claimed as manual simulator saves.
- Preview readiness/start remain disabled. Native runtime 2.1.0/build 28 and Production 2.0.2 boundaries are verified separately by the guarded OTA workflow.

Screenshots, API evidence, precise visual comparison and release identifiers are in backend DEV `docs/validation/superset-convergence-2026-09-12/`.
