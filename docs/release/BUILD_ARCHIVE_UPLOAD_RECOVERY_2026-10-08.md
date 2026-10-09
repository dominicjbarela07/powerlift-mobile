# Production 3 build archive upload recovery — October 8, 2026

## Task acceptance

The owner started `eas build --platform ios --profile production3-preparation`
from `/Users/dominic/powerlifting_app/powerlift_mobile`. Credentials succeeded;
upload failed because the compressed project archive was 8.1 GB, above the
reported 2.0 GB limit. The requested outcome is a corrected, verified upload
package in the Production candidate, with the same correction in canonical DEV.
The owner retains exclusive authority to start and monitor the native build.

Acceptance requires identifying the included excess files, configuring upload-only
exclusions, inspecting the real EAS archive stage with the exact iOS/profile,
measuring a package below the limit, and verifying all required runtime source,
approved images, mappings/crops, Education images and native configuration survive
with identical bytes. Retain and deliberately failure-test a packaging guard.

Preserve every cumulative TestFlight fix, including first-tap Set save recovery,
Accessory PR manufacturer isolation and imagery restoration. Do not delete,
replace, regenerate, recompress or reapprove images. Source review evidence stays
in the repository/on disk. No Production 2.0.2 channel, backend deployment,
simulator run, native build or store submission is authorized by this task.
Do not reset the remote build number incremented to 34 by the owner's attempt.

## Results

The actual failed EAS tarball was retained and inventoried, rather than inferring
its contents from source folder sizes. Compressed bytes: 8,747,596,603 (EAS display
8.1 GB). It included 3,488,913,519 bytes of shallow Git objects/history,
3,495,474,534 bytes of review candidates/attempts/exports and 246,378,724 bytes of
documentation/proof. The application assets tree was 1,590,690,405 bytes.
The installed EAS Git client includes its shallow clone's Git data unless the
explicit upload ignore policy removes it; the directory-copy defaults alone did
not protect this upload.

`.easignore` retains every original `.gitignore` rule and explicitly excludes Git,
non-runtime review media, evidence/validation captures and local development
outputs from upload only. The source directories and files remain intact.
Every `assets/` file is retained; runtime approval/crop mappings and human review
receipts remain included. No image was deleted, moved, generated or transformed.

The exact iOS Production 3 profile was inspected at EAS's archive stage. Then the
installed EAS CLI's actual `makeProjectTarballAsync` and Git client created the
compressed upload locally, without submitting/uploading a native build.
Corrected compressed bytes: **1,601,659,126** (1.60 decimal GB / 1.49 GiB), below
both the conservative 2,000,000,000-byte guard and EAS's configured limit.
Both the inspected directory and actual compressed tarball were byte-verified:
3,193 required runtime/build files, including **2,249 asset files**, unchanged.
Missing/changed runtime or asset files: **0**. The entire asset payload byte total
is exactly equal to the failed upload's asset payload total.

Source packaging checks passed in canonical DEV and the Production candidate;
Production 3 resolved version/runtime 3.0.0, the existing store profile, canonical
bundle identity and https://app.strengthledger.fit. Type checking passed.
Production candidate and latest TestFlight retain the same 2,766-file application
fingerprint `eb0157e764eac8b17b87ebc69d6417e0b88a1a05a165cf014489af131e88227a`.
DEV superset Gate A passed; the Set save recovery and other cumulative product
fixes are unchanged. No backend deployment/channel mutation occurred.

## Permanent protection

Direct Production 3 Expo/EAS configuration now invokes
`scripts/native-build-upload-policy.cjs`. It rejects a missing `.easignore`,
unreviewed exclusion rules (including any assets/source subtraction), missing
required build inputs and conservative source packages >= 1.9 billion bytes.
The separate actual-archive verifier checks the compressed size and every required
source/asset byte. Empty ignored directory entries are allowed; their contents
are prohibited. Git itself must be absent.

The automatically discovered accepted contract and critical release area exercise
real configuration and archive-checker failures: missing ignore file, assets/lib
exclusion, Git inclusion, oversized input, changed/missing approved image and
cache payload leakage. Reviewed additive guard/guidance changes retain original
pins and exact before/after source in
`config/testflight-release-build-archive-20261008/prior-gate-pins.json`.
Existing image/mutation guards were preserved. The earlier readiness sweep missed
upload packaging; actual archive inspection/size/byte proof is now mandatory in
agent guidance before declaring a native candidate ready.

## Validation scope

Final governed application acceptance: **277/277 contracts PASS**, **86/86 critical
product areas PASS**, including the new upload failure controls.

The cumulative application accepted/critical suites run in the governed
TestFlight projection, whose application fingerprint equals the Production
candidate. Production configuration, type checking and the real archive are
checked independently. An initial run in the legacy-configured Production root
exposed two existing harness assertions that only recognize the TestFlight
projection when development-only labs are absent; these assertions were not
weakened. An additive agent-guidance pin mismatch was reviewed and corrected with
retained original evidence, and the subtraction gate's negative controls passed.
No simulator observation, compiled native binary or store delivery is claimed.

## Shared web/mobile asset question

The owner asked whether assets should move to the backend because the web app
also needs them. Shared versioned storage and a governed manifest can serve both
clients while retaining mobile offline images. This upload repair does not
require such a migration. No backend asset migration or remote-only mobile image
behavior was implemented; it would be a separate product/architecture change.

## Owner handoff

Run from `/Users/dominic/powerlifting_app/powerlift_mobile`:

```sh
eas build --platform ios --profile production3-preparation
```

The owner starts and monitors the build. No native build, store submission,
remote build-number reset or customer training-data mutation was performed.
The prior failed attempt's remote build number 34 remains untouched by this work.
The next owner-started build may increment it normally.

Machine evidence is retained in `docs/release/build-archive-20261008/` and
`/Users/dominic/Documents/Codex/2026-10-03/re/outputs/build-archive-recovery-2026-10-08/`.
