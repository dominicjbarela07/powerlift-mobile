# Programming Manager workspace subject ownership

Implemented in canonical DEV. Athlete Workspace → Training now owns one locked athlete through the existing, backend-verified `CoachAthleteWorkspaceContext`. The manager no longer repeats the athlete name, coached-athlete/block subtitle, avatar or dropdown below its title. Notes & Next Steps and the active Training Program move upward without replacement identity copy.

## Context and mutation contract

`lib/programming-subject.ts` resolves the subject from the workspace bootstrap when a provider exists. Conflicting or missing route selection cannot override it. An unresolved or contradictory workspace fails closed rather than falling back to another athlete or the authenticated user's own training. Standalone entry continues to resolve its route selection; Individual mode retains its self-programming behavior.

The manager uses that subject for training reads and passes it to program, block, week, Session creation, Session editing, notes, move/reorder and other programming actions. A mismatched training response is rejected before its program or Session data can become actionable. Request sequencing and a current-scope reference reject stale responses. The nested Training route and program editor are keyed by the workspace subject key so athlete/relationship generation changes discard old local selections and drafts.

In scoped mode, the athlete row and picker sheet are absent. The roster-loading effect and switching handler also refuse scoped entry. Global Coach Programming retains its picker, roster loading and switching route. The global Individual identity row is unchanged.

Session Workspace verifies the returned athlete before showing editable data. Scoped empty drafts receive no reassignment options, and the save boundary checks the existing athlete, draft athlete and any athlete metadata patch before sending mutations. Global empty-draft reassignment remains available under its existing rules. Backend authorization remains the security boundary and was not changed.

## Navigation and layout

Program creation/editing now uses a nested `training/create-program` route when entered from an Athlete Workspace. It reuses the existing program builder under the same provider and shell. Exit and successful-save return routes lead to that athlete's Training manager; route construction cannot override the locked athlete ID. Global and Individual builder entry/return destinations remain unchanged.

The workspace shell, floating dock and toolkit stay mounted. The embedded Session editor closes back to its mounted manager. Brief → Training and program-editor Exit preserve the same athlete. Scoped builder footer clearance accounts for the dock, safe area and toolkit so navigation/save controls remain reachable.

The first native implementation pass removed the duplicate identity and picker. Inspection identified three remaining weak areas: the oversized two-line title area, its tall Actions control, and content touching both screen edges. The second pass uses a 64-point minimum scoped header (previously 96), a single-line title at the tested phone size, a 40-point Actions control, and a 10-point content gutter. Notes/program content rises approximately 116 points relative to the original layout. The original global header styling is retained. A further builder screenshot caught and corrected its footer overlapping the persistent dock.

## Validation

- TypeScript `tsc --noEmit`: PASS.
- New executable subject/navigation/mutation suite: **8/8 tests PASS**, including conflicting route IDs, unresolved workspace, wrong/missing response identity, illegal reassignment, locked outgoing route parameters, global/Individual destinations and picker/handler suppression.
- Automatically discovered accepted mobile contracts: **189/189 PASS**. Existing tests that explicitly expected workspace athlete switching were updated to require the new locked contract; route-wrapper checks now require the subject key. No quarantine configuration changed.
- Release-critical invariants: **55/55 PASS**. These checks did not publish or build a release.
- Backend programming regression tests: **18/18 PASS**, using isolated test databases. Coverage includes program creation/update/ownership/relationship truth, Session save/retry, assignment/reorder/reload, week copy, block template application and denied non-owned access.
- Shared text-layout contract: PASS across 28 active surfaces, three phone classes and lb/kg stress values.
- Focused ESLint: zero errors. The three existing large screens retain exactly their prior warning counts (42, 4 and 3); new typed helper/routes are clean. See the [baseline comparison](evidence/programming-workspace-context-2026-09-10/lint-comparison.json).
- Live DEV API reads: athlete 12 returns program 21; athlete 4 returns program 18; Session 1727 belongs to athlete 12. Program 18 requested under athlete 12 returns **404**, not the other athlete's program. See [API proof](evidence/programming-workspace-context-2026-09-10/api-proof.json).

### Native proof

All captures use the canonical `npm start` Metro listener at port 8081, PID 73477, app/runtime 2.1.0, on iPhone 17 / iOS 26.2. The source certificate honestly reports the uncommitted DEV filesystem used during validation. See [runtime certificate](evidence/programming-workspace-context-2026-09-10/metro-runtime.json).

Maestro and direct inspection verified:

1. Scoped athlete 12 manager: workspace identity appears once, no Switch athlete control, no duplicate Coached Athlete subtitle; Notes & Next Steps and Muscle Mommy P1 follow the compact header.
2. Program Actions → Edit Muscle Mommy P1: same athlete, workspace header and dock; Exit returns to athlete 12's scoped manager.
3. Brief → Training returns to the same athlete and program.
4. Global manager: picker remains present; selecting athlete 4 changes the program to Bodybuilding Offseason and removes athlete 12's program from the screen.
5. Scoped Session 1727 opens for athlete 12; closing and refreshing return to athlete 12's manager with no global selection control or athlete 4 program leakage.

The repeatable flows are committed beside the screenshots. They expect the existing signed-in DEV simulator and the matching entry deep link. Program-editor form navigation is tested without saving changes to the seeded DEV training record. Backend mutation tests exercise actual writes in isolated test databases.

| Evidence | Screenshot |
| --- | --- |
| Original duplicate identity | [Before](evidence/programming-workspace-context-2026-09-10/before.png) |
| First implementation pass | [First pass](evidence/programming-workspace-context-2026-09-10/first-pass.png) |
| Final scoped manager | [Workspace manager](evidence/programming-workspace-context-2026-09-10/workspace-manager.png) |
| Scoped program builder with dock clearance | [Program editor](evidence/programming-workspace-context-2026-09-10/program-editor.png) |
| Preserved global picker | [Global picker](evidence/programming-workspace-context-2026-09-10/global-picker.png) |
| Global athlete switch | [Athlete 4 selected](evidence/programming-workspace-context-2026-09-10/global-athlete4.png) |
| Scoped Session editor | [Session 1727](evidence/programming-workspace-context-2026-09-10/scoped-session.png) |
| Same subject after return/refresh | [Refreshed manager](evidence/programming-workspace-context-2026-09-10/refresh.png) |

## State machine and blast radius

**Touched:** Programming entry mode → authoritative athlete subject → program/Session tools → refresh and return navigation. Workspace generation changes reset local tool state; scoped Session saves cannot reassign the athlete.

**Adjacent systems:** program/block/week selection and mutations, Session editing/reordering, program builder navigation, workspace dock clearance, global Coach picker and Individual/self programming.

**Existing workflows validated:** scoped and global native manager entry; same-athlete editor/Brief/Training returns; Session open/close/refresh; global athlete switching; global/Individual route resolution; backend program ownership and Session/week/block mutation contracts.

**Regression confidence:** existing backend authority and relationship gates remain intact; typed subject tests cover conflicting and missing identity; stale responses are invalidated; native screens show correct subject and navigation; mobile and backend regression suites pass. No auth, onboarding, billing, entitlement or relationship mutations were introduced. Native testing did not save changes to the seeded DEV training record.

DEV commit and PT-first delivery record are recorded in the backend development ledger for September 10.

**DEV ONLY. NO TESTFLIGHT. NO PRODUCTION.** No release build, OTA, deployment or promotion.
