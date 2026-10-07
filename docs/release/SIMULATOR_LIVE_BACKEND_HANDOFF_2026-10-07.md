# Native simulator handoff against the live backend — October 7, 2026

Owner request: open the Production mobile candidate on the simulator against the
actual live Production backend, leave it at login for owner takeover, and repair
`getValueWithKeyAsync` failing with a missing entitlement. This is local simulator
preview/repair authorization; it is not a Mobile3 store submission or release GO.

## Cause and repair

The pre-existing simulator shell lacked both embedded simulator keychain
entitlement sections. Its native SecureStore read failed before authentication
could complete. It also contained an older embedded JavaScript bundle: pointing
Metro at the Production checkout did not change that shell's running source.

Preserved the original native bundle outside the repository. Repaired only the
local simulator clone with private application keychain entitlements embedded in
`__TEXT,__entitlements` and `__TEXT,__ents_der`, matching simulator linker behavior.
Both original architecture section contents remained unchanged; the added sections
use reserved zero padding. Signed the host binary with a plain ad-hoc signature.
The initial attempt to put iOS entitlements in the host signature failed launch;
that failed attempt is retained in evidence and is not counted as successful.

Embedded the exact named Production checkout source at
`464f0919534afa8c3058e889626763e7954131d1`, using the explicit Production3/art/runtime
switches and `EXPO_PUBLIC_API_BASE=https://app.strengthledger.fit`.
Final normal entry point is `node_modules/expo-router/entry.js`, development mode
false. Installed bundle SHA256:
`302f88c61d660fe08e73f942e3c00e4332dfbb6b0dc5351d12657b3e3b98cf99`.
The existing native shell version remains2.1.0; this is a local candidate preview,
not a newly built or certified3.0 native/store binary. Production2.0.2 is untouched.

## Actual verification

An isolated local entry wrapper ran Expo SecureStore in the actual installed app
with a unique disposable key: missing read returned null, write/read roundtrip
passed, deletion passed and a subsequent read returned null. No customer auth key
was accessed and no customer login was submitted. The same actual native runtime
read `https://app.strengthledger.fit/health/recognition`, status200, readytrue,
serving SHA `d4b6a8b22549a9853db71fbbd0485c708471519f`.

Removed the temporary wrapper from the final bundle, restored the normal entry,
verified the installed bundle hash, checked the signature, and included all1009
unique bytes from the validated candidate iOS export, including487 unique approved
movement images. Three navigation image variants absent from native name-based
copying were additionally preserved as hash-addressable resources. No replacement
art, asset removal, auth fallback or application semantics change was introduced.

CUA observed the final clean candidate at the welcome/login screen with blank email
and password fields and no entitlement error. The owner can take over there.
Customer authentication and full native/store certification remain owner/native
release validation; this repair does not infer those from anonymous health checks.

## Required check for future explicitly requested simulator handoffs

Use `scripts/verify-ios-simulator-handoff.py --app <installed-app-path> --receipt
<fresh-candidate-runtime-receipt>`. The receipt must come from the named checkout's
actual embedding and an in-app disposable native SecureStore/live-health probe.
A server environment, Metro manifest or visible login screen alone is insufficient.
Inspect embedded simulator entitlements, not just `codesign -d --entitlements`.
Keep store/device signing separate; never commit simulator-only entitlement hacks
into device provisioning or replace secure storage with plaintext fallback.

The guard passed for the actual installed clean candidate and deliberately failed
for the original missing-entitlement shell, a stale bundle checksum, and a local
backend address substituted for the live address. The probe is absent from the
final handoff. Guidance and guard are retained in canonical DEV and the Production
candidate checkout. Respect owner no-simulator instructions whenever simulator
work was not subsequently requested.

Tracked evidence: `../validation/simulator-live-handoff-2026-10-07/`.
Complete local build/repair logs and preserved original bundle:
`/Users/dominic/Documents/Codex/2026-10-03/re/outputs/production-candidate-simulator-2026-10-07/`.

## State-machine closeout

Touched local simulator source/signing/handoff state only. Adjacent systems:
keychain, Auth bootstrap, native assets and backend targeting. Verified actual
native secure storage, live anonymous health, installed source hash and final login
appearance. No owner data, backend code/schema, live mobile publication, original
source pins, other approved screens or product decisions changed. A new store
binary/customer workflow is not certified by this local preview.
