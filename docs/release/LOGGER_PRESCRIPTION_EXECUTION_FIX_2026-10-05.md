# Active prescription execution repair — October 5

Saving an accessory prescription changed the base Sets/reps/RIR fields, but an
existing `performed_*` execution override stayed stale. The canonical logger
correctly prefers that execution prescription, so a successful save closed the
editor while leaving the old target on screen. EZ-Bar Curl 6–10 → 8–12 reproduced
this failure in both the real authenticated API and the canonical DEV simulator.

The save service now synchronizes an existing execution override only when its
corresponding prescription field is edited. It does not introduce new overrides,
rewrite completed Sets, alter movement/equipment identity, or broaden permissions.
The regression test covers reps, Sets and RIR, immediate response, fresh Session
read, reopened editor, every untouched item column and every completed Set column.
It failed three subcases on the original service and passes with the repair.

A previously failed save can also leave base 8–12 and execution 6–10. The old
editor then reopened with base 8–12, making reapplying that target a client no-op.
The read snapshot now projects the same live Sets/reps/RIR the logger uses, while
versioning both base and execution state. Reads do not repair or rewrite data.
A separate real API regression failed on that mismatch and now passes; the real
DEV client likewise reads 6–10, saves 8–12 and reopens with 8–12 while preserving
every completed Set column. The full prescription suite has 12 passing tests.
The initial write repair was shipped at `f1a4a628ba3fe4a456ef249c6cd9acdda4767397`;
the final read/write repair is the cumulative revision verified below.

The production push originated from `/Users/dominic/powerlifting_app`, using the
installed source-pinned guard. Source `210559e431df3927ab7286f9d1c4e895129b6439`
is verified live by the server's public readiness endpoint. The existing
TestFlight 2.1.0 client calls this repaired endpoint; no client OTA is necessary.
128 candidate tests pass, independent manufacturer-isolation acceptance passes,
and all 104 frozen 2.0.2 responses on each of iOS/Android remain identical.
Models/migrations and Production Mobile release channels were not changed.

Real DEV validation observed 8–12 immediately after Save, remaining Set targets
updated, completed 55 lb × 8 @ RIR 1.0 retained, editor reopened with 8–12 and
Session reopened with 8–12. Synthetic QA evidence is retained in
`LOGGER_PRESCRIPTION_EXECUTION_FIX_2026-10-05.json`.

The separate compact control layout is DEV-only and requires owner sign-off
before later publication. This backend release includes no mobile UI changes.
The production push guard permanently includes the complete active prescription
suite for future shared-backend releases. Existing unrelated DEV changes remain
preserved; the exact shipped repair and regression bytes exist in canonical DEV.
