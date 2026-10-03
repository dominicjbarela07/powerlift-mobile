# Strength Ledger Release Invariants — authoritative document

Before any TestFlight/release operation, read and enforce the canonical backend
document: `/Users/dominic/powerlifting_app_dev/docs/RELEASE_INVARIANTS.md`.

The tracked canonical source is
[Strength-Ledger-Dev / docs/RELEASE_INVARIANTS.md](https://github.com/dominicjbarela07/Strength-Ledger-Dev/blob/dev/canonical-backend/docs/RELEASE_INVARIANTS.md).
This file is a pointer, not a second constitution. Release verification reads
and checks the authoritative document through `STRENGTH_LEDGER_BACKEND_ROOT`.

The governing relationships are `DEV ⊇ TESTFLIGHT`, cumulative TestFlight,
explicit owner removals only, and same-workflow back-propagation. Run
`npm run release:verify-testflight` and use the guarded publisher/native wrapper.
Missing valid TestFlight state in DEV blocks release and must flow TestFlight → DEV.
