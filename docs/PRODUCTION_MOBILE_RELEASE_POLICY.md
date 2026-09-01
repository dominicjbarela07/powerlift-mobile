# Production Mobile Release Policy

## Native-build authorization boundary

Production OTA authority never grants authority to start, upload, or submit a
native build. A runtime, store build, EAS build fingerprint, native dependency
projection, channel, branch, or application-identifier mismatch must stop with:

> **PRODUCTION MOBILE BLOCKED — native build required. Native build not authorized.**

The Production EAS profile keeps `autoIncrement: false`. No Production release
script may fall back from OTA publication to `eas build` or `eas submit`.

## Platform-aware live baseline

`config/production-mobile-baseline.json` records independent iOS and Android
store builds, EAS build fingerprints, native dependency projections, and active
update state under the shared `production` channel and
`production-live-2.0.2` branch.

Before export, the guarded publisher verifies the selected platform's exact EAS
store build and candidate native dependency projection. Android 2.0.2 recovery
exports are dependency-pinned to the native graph compiled into build 12.

## Shared-release parity law

A shared Production mobile hotfix must use:

```sh
npm run release:production:ota -- \
  --platform all \
  --release-scope shared \
  --message "<release message>"
```

The command fails if a shared release names only iOS or Android. It exports and
publishes both platforms into one group, then verifies the group contains both.

A deliberate one-platform correction must name the platform, use
`--release-scope platform-specific`, and include a substantive `--reason`.
This exception exists for recoveries such as restoring Android after a channel
mapping error without modifying an already-correct iOS runtime.

## Exact-artifact verification

The publisher runs the cumulative Production 2.0.2 invariant suite and
TypeScript before export. It publishes with `--skip-bundler`, downloads each
published launch asset, verifies byte equality with the prevalidated local
Hermes bundle, checks the update group platform set, and confirms the Production
channel resolves to the published update ID, branch, runtime, and bytes.

The legacy iOS-only publisher is disabled so it cannot bypass the parity guard.
