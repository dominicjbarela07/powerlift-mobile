# TestFlight Source Parity

## TestFlight parity invariant

Except for explicitly declared development-only work, safe approved shipping
development changes must be synchronized to TestFlight. TestFlight is a release
projection of development, not an independently implemented product.

Every TestFlight promotion must:

1. calculate the shipping-source delta from the development source;
2. classify every meaningful difference;
3. preserve explicit development-only exclusions;
4. preserve and back-propagate TestFlight field hotfixes;
5. eliminate unexplained shipping drift;
6. validate backend, schema, runtime, and asset compatibility; and
7. publish the compatible TestFlight OTA.

Every TestFlight native build must also embed that same approved release
projection. An OTA may fail to download or be rolled back by the runtime; the
embedded fallback therefore may never be a Production source checkout. Build
TestFlight only through `scripts/eas-build-testflight.sh`, which requires the
canonical release checkout, an explicit `testflight` release track, a clean
release branch, a pushed HEAD, the canonical Ledger routes, and the TestFlight
channel/API/bundle configuration.

The TestFlight release track applies a fetched compatible OTA automatically as
soon as the session/logger safety guard permits. Production retains the normal
user-controlled update prompt and cannot receive the 2.1.0 TestFlight runtime.

The absence of local visual tooling is pending physical verification, not a
release failure when deterministic, release-path, and compatibility checks pass
and no visual/runtime defect is known.

## Current release parity manifest

- DEV SOURCE BASE: `1c9c6dc` plus the current parity-policy commit
- TESTFLIGHT SOURCE: release projection from current `testflight` branch
- EXCLUDED DEV-ONLY SCOPES:
  - `ACCESSORY_REBUILD_DEV_ONLY`
  - `DEV_MOCKS_AND_EXPERIMENTS`
  - `NATIVE_3D_RENDERER_EXPERIMENT`
- TESTFLIGHT-ONLY HOTFIXES: none after reconciliation
- BACK-PROPAGATED HOTFIXES: logger crash isolation, rest timer and countdown
  behavior, Repeat Last Set, final-set completion, post-Session correction,
  recognition, Review Hub/Calendar, completed recap, and release OTA guards

`scripts/test-testflight-source-parity.mjs` is the executable parity guard for
the canonical Ledger and the explicit exclusion boundaries above.
