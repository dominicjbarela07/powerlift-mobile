# Exact movement ownership through Equipment

Equipment configures the physical implementation of the pressed Session item. Swap
is the separate command that changes its canonical movement identity.

## Root cause

The active Logger uses `resolveLoggerMovementIdentity(item)` and its effective
canonical name. The equipment sheet previously read `identityPickerItem.movement`,
the stored programmed text. A cable prescription swapped to an exact machine
movement could consequently show Machine in the Logger and Cable in the sheet.
That heading binding was the first demonstrated incorrect transition.

The superset action already finds the pressed member by WorkoutItem ID; it does
not select the group's first/current member. The live equipment endpoint already
derives usage from the effective canonical ID. Its manufacturer/type records are
physical configurations, intentionally independent of the movement family. An
authenticated API reproduction confirms that the old heading defect does not
itself replace the stored canonical subject or merge Machine/Cable history.

Related weaknesses addressed: unchecked response subject, delayed responses across
sheet entries, stale save completion, overlapping saves, programmed preview context,
universal loading options and a legacy client branch capable of submitting a movement
ID instead of manufacturer/type. No backend deployment or schema change is required.

## Subject contract

`lib/equipment-flow-subject.ts` owns the immutable subject:

`{ itemId, movementDefinitionId, movementKey, displayName, domain, allowedTypes }`

The ID/name originate from the same effective Logger identity. Contradictory declared
IDs, unresolved substitutions, missing governed identity, physical equipment posing
as a movement and unsupported taxonomy fail explicitly. Names, muscle groups and
aliases cannot discover or reconstruct a movement subject.

Every entry has a separate ownership reference bound to the existing account/Session
execution scope. Opening/confirming, loading, saving and canonical refresh must retain
the same item ID, movement ID/key and equipment domain. The existing server
`usage_movement_definition_id` must equal the pressed subject before choices appear.
Closing/reopening, switching members or accounts invalidates older asynchronous work.

The heading uses the captured canonical name. Cable loading choices are labeled as
cable stations; they retain the existing API's manufacturer plus plate-loaded/
selectorized physical-loading contract. Explicit plate-loaded/selectorized movement
definitions restrict the corresponding loading choice. This does not invent a list
of movement-specific manufacturers: the existing governed registry remains shared.

Live writes contain **manufacturer_key + equipment_type**, and explicit correction
intent where applicable. They never submit a replacement movement ID. One save runs
at a time. The response must contain an actual equipment configuration; no optimistic
manufacturer row is substituted for a missing response. Reconciliation merges into
the latest item, retaining concurrently accepted Sets, and then confirms the exact
movement/equipment from a successful canonical Session refresh before continuation.

History, comparable exposure and artwork continue consuming the existing effective
movement subject. Programmed intent and immutable performed snapshots are preserved.
Completed-evidence correction and future-set selection keep their existing semantics.

## Regression evidence

- The new mobile test executes the actual route open/load/save/close handlers with
  delayed A/B requests and saves, duplicate taps and concurrent accepted evidence.
  It also covers identity collisions, missing/contradictory subjects, display-name
  traps, exact equipment domains, artwork identity, restoration and account changes.
- An authenticated isolated backend test creates a cable A and a cable→machine Swap
  on B in one superset; it verifies independent picker IDs, manufacturer/type writes,
  canonical refresh, real SetLog persistence, exact usage/history and immutable prior
  snapshots after a later equipment change. It also runs against the deployed backend
  source, using temporary SQLite only.
- A read-only DEV sweep covers 203 equipment-required canonical definitions: 88 machine
  and 115 cable, with zero identity drift. No live customer evidence is rewritten.
- Full mobile accepted/release-critical suites, TypeScript, lint, dirty-tree Metro
  and the iOS bundle compile are release gates. The broader backend suite has one
  independently reproduced pre-existing query-count failure (12 queries vs limit 10).

The exact customer's affected Session was not identified in the attachment. The DEV
catalog has the cable movement but no globally registered Machine Overhead Triceps
Extension. The precise swapped case is therefore an explicit isolated fixture, not a
claim to have inspected or repaired the customer's live records. Simulator taps remain
pending while the Mac is locked; deterministic execution is not called screenshot QA.

State machine: Equipment entry/request/save/reconciliation ownership. Adjacent systems:
effective identity, superset focus/rest, equipment history, artwork, saved Sets and
account/Session navigation. Their contracts and API persistence are exercised. No auth,
onboarding, billing, relationship, entitlement or backend mutation implementation changed.

**TestFlight OTA only. No new native build. No Production changes.**
