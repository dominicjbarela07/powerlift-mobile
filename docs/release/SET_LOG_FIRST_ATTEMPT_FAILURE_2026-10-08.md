# Set log first-attempt failure — fixed and delivered, October 8, 2026

The client treated the first transport rejection as a failed Set save and asked
for another tap. All six canonical submit paths shared that single-attempt
lifecycle. The exact screenshot message is emitted when native fetch rejects
before a response is received. That does not establish whether the server
committed the Set, so recovery must keep the original immutable request identity.
The underlying carrier/socket failure was not observed on the owner's phone;
we do not claim to have diagnosed its infrastructure origin.

The canonical save now makes up to three total attempts for structured network
or timeout failures, separated by 300 and 900 milliseconds. The original tap
stays in Saving. Every retry rechecks that the Logger remains mounted and the
same account/Session owns the request. The exact payload, timing and journal
submission ID are retained. Permissions, conflicts, malformed responses and
cancellations do not retry. The original controller remains locked, and success
is consumed once. A persistent outage still returns a visible failure and keeps
the durable retry identity. Existing replay/recognition semantics are preserved.

The real shipping fetchJson and Session submit handler were executed with a
native connection drop before persistence and after persistence for all five
endpoint types. Both recovered within the same save action and produced one
Set and one acceptance. Double taps, repeated outages, Session ownership changes,
cancellation and missing durable identity were also covered. Running the new
regression against the old shipping handler deliberately failed on the first
accessory case. The regression is automatically discovered and mandatory in the
critical release suite. The owner-specific release scope independently rejects
missing artwork, unrelated product changes, invented baseline/source, missing
contracts and attempts to relabel earlier visual observations as proof of this
logic change.

Only three product paths differ from the fully verified prior TestFlight:
the canonical Logger, the new recovery helper, and the exact release holdback
receipt that proves the shared patch in DEV and the release projection. Artwork,
crops, movement identity, equipment/manufacturer isolation and all other product
files are unchanged. No backend code/schema deployment was necessary: the
currently serving backend already owns the durable idempotency contract. Its
exact source and existing machine-isolation policy were verified after delivery.
No customer Set was written or edited by this validation.

Validation: 276/276 accepted contracts; 85/85 critical areas; TypeScript passes
in the release and Production candidate; 26 actual Production-source persistence
and PR API tests pass. The new fault-injection test rejects the old code. A fresh
simulator run and behavior on the owner's physical phone have not been observed.
The owner-authorized contract-only scope and full delivered-artifact checks were
used, preserving the no-native-build restriction.

Delivered iOS TestFlight OTA: `01a11e0b-bea2-753f-b8a5-acb0b9554d90`. Group: `b3b3b872-3fd3-4433-86df-3b3e521b014f`.
Published source: `b552c708298882f7f095e3adfe393c6c0a6cface`. Runtime 2.1.0, compatible with installed build 28.
Served bundle: 31,928,210 bytes, SHA-256 `9132e51de5f21d0d8d7836c9312b604b0e7fa8185e2041ebd5488974f0d91c12`. Its bytes exactly match the
validated export and contain the recovery handler. The actual SDK-style
TestFlight channel request selects this exact update. All 998 served asset
entries / 992 unique asset hashes were downloaded and verified; missing or
corrupt assets: 0. All 487 original movement images, 490 approved mappings and
17 losslessly carried Education images remain intact. Unauthorized movement
image losses: 0. Production 2.0.2 iOS/Android updates and channel routing are
unchanged.

DEV contains the exact shared mutation patch. Production candidate and TestFlight
product fingerprints match: `eb0157e764eac8b17b87ebc69d6417e0b88a1a05a165cf014489af131e88227a` (2,766 product files). The durable
release checkout closeout passed; no temporary worktree was created or removed,
no restoration/fix is stranded, and both independent unfinished active drafts
were preserved and assessed. Existing owner build rights remain unchanged;
no native build or store submission was initiated. The next owner-initiated
Production 3.0 build from `/Users/dominic/powerlifting_app/powerlift_mobile`
includes this fix, using `production3-preparation`.

Immediate failure fixed: YES (deliberately reproduced transport failure)
Failure class identified: single-attempt handling of ambiguous Set transport failure
Blast radius audited: YES (all canonical Set logging paths)
Permanent regression/invariant protection added: YES
Protection failure-tested: YES
Equivalent known deterministic failures remaining: 0
Owner decision required: NO

The delivery is verified. Actual phone behavior remains an observation to make
when the owner loads the update; this report does not promise network availability.
