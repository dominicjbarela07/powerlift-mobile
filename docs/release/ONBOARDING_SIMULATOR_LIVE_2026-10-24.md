# Live onboarding simulator handoff — October 24, 2026

Owner request: “i want you to pop open the onboarding flow on the simulator it
should be poinnting to the live services. i want to ensure its smoothness”.

Acceptance: install the current released onboarding source in the existing iPhone
Air simulator, verify its actual native SecureStore roundtrip and Production health
request, run the installed-app handoff guard, and leave the signup entry open for
owner takeover. Inspect the actual screen. No account creation, payment, support
notification, Production source change, OTA publication or store build is requested.

Preserve canonical identity, backend-controlled readiness/access, approved artwork,
all released fixes and existing simulator account data. The initial standalone
shell still contains the October 7 bundle. Use an isolated, derived source archive
of published mobile source `afa5605b4ffc99ac80409e9ed72cb32689e9b2cc` to avoid
including independent DEV holdbacks or changing the owner's running Metro.
This is a local preview of the current 3.0 product inside the retained simulator
shell; its old native shell version does not certify a new 3.0 store binary.

Evidence required: exact installed bundle and asset hashes; fresh disposable
native probe receipt; live origin and serving SHA; embedded keychain/signature
verification; final observed signup screen. Keep temporary instrumentation out
of the final handoff bundle. No mutation to product state machines is planned.

Completed: the iPhone Air is open at **Create account**, with Self-Coach selected
and blank fields. The existing native simulator session was signed out through
the normal Settings confirmation. No account was deleted or signup submitted.

Installed clean bundle SHA-256:
`2f9e7e48c00139abd1ddb96319b0d49f23aed79d8b0cd3b6ba5ebb44b072761e`.
All 998 released asset entries are present by actual file-content hash. The
actual native disposable keychain read/write/delete check passed. Its native
Production health request returned HTTP 200, ready true, source
`72e1987fa086ae10ef42b10d0ee373e2b706a7de`. The installed-app guard passed embedded
keychain, signature, exact bundle, asset and live-origin checks. Deliberate stale
bundle and localhost receipts were rejected. The temporary probe is absent from
the final bundle, whose installed checksum was checked again after navigation.

Computer-use observed the final signup screen. Evidence is retained under
`docs/validation/onboarding-simulator-live-2026-10-24/`. Private derived source and
embedding logs are in `/Users/dominic/.codex/work/onboarding-simulator-live-20261024/`.
The owner can enter their details, continue to email verification and start the
Self-Coach trial. Athlete and Coach remain available account-type choices.

State-machine scope: no product transition implementation changed. Observed
normal live account restoration, Settings, logout, login and signup entry.
Adjacent verification, billing, support and native browser systems retain the
released implementation and prior release evidence; no new end-to-end live
signup/payment observation is claimed. This handoff verifies the simulator's
actual live transport/storage and requested screen, not every onboarding outcome
or physical-device/store certification. No backend or OTA release was performed.
