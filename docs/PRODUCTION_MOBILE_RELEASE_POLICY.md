# Production 2.0.2 Mobile Release Policy

This policy governs Production runtime `2.0.2` only.

## Non-negotiable platform law

iOS and Android are one shared Production release responsibility. Every shared
Production 2.0.2 OTA defaults to both platforms. Silence never authorizes
omitting a platform.

A shared release is successful only when both Production manifests resolve the
intended runtime, channel, branch, source, update, and exact served bundle:

> **PRODUCTION 2.0.2 PLATFORM PARITY: PASS**

HTTP 204, a missing manifest, or fallback to an embedded bundle on either
platform fails the release.

## Native-build authorization boundary

Production OTA authority never grants authority to start, upload, or submit a
native build. A runtime, store build, EAS build fingerprint, native dependency
projection, channel, branch, or application-identifier mismatch must stop with:

> **PRODUCTION MOBILE BLOCKED — native build required. Native build not authorized.**

The Production EAS profile keeps `autoIncrement: false`. No OTA or parity tool
may fall back to `eas build` or `eas submit`.

## Governed baseline

`config/production-mobile-baseline.json` is the platform-aware source of truth.
It records the live iOS and Android store builds, EAS fingerprints, native
dependency projections, active update groups and IDs, source commits, launch
asset keys, hashes, sizes, runtime, channel, and branch.

The baseline must be updated after a verified publication and before another
Production release begins. A stale baseline blocks the pre-publish parity gate.

## Canonical shared OTA path

The only generic Production 2.0.2 OTA entry point is:

```sh
npm run release:production:ota -- --message "<release message>"
```

`--platform all` and `--release-scope shared` are the enforced defaults. They
may also be written explicitly. The publisher exports both platforms into one
group and refuses a shared iOS-only or Android-only target.

Before publication it verifies:

- both current Production channel manifests resolve without embedded fallback;
- channel mapping is active and points only to the governed branch;
- runtime is exactly `2.0.2` on both platforms;
- current update group, update ID, source commit, launch key, hash, and bytes
  match the governed baseline;
- exact live iOS and Android EAS store builds and native dependency projections
  are compatible;
- source and route-complete assets export for both platforms;
- cumulative mobile behavior and backend/API request contracts pass;
- TypeScript passes and the release worktree is clean.

After publication it independently resolves both channel manifests, downloads
both served bundles, verifies byte equality with the prevalidated exports,
checks both update IDs, group membership, source commit, runtime, branch, and
artifact identity, and emits the platform-parity PASS result.

Successful `eas update` process exit alone is never release success.

## Platform-specific exception

A genuine platform defect may use:

```sh
npm run release:production:ota -- \
  --platform android \
  --release-scope platform-specific \
  --reason "<specific platform-only technical reason>" \
  --message "<release message>"
```

`ios` is also valid when the defect is genuinely iOS-specific. The reason must
be substantive. Convenience, script defaults, prior drift, or failure to
remember the other platform are invalid reasons.

The post-publish guard still verifies that both Production platform manifests
remain healthy; it verifies the new artifact on the selected platform and the
unchanged governed artifact on the other platform.

## Branch and channel remapping

Direct Production channel remapping is not an administrative shortcut. Any
authorized remap must be followed immediately by:

```sh
npm run verify:production:parity
```

No further Production release work may proceed unless this command proves both
platforms resolve the governed 2.0.2 branch and artifacts. The same verifier is
an automatic precondition of every OTA publication, so a stale or one-platform
mapping blocks the next command before export or publication.

## Historical divergence recovery

When drift is discovered: identify the last shared source, enumerate and
classify all later shared changes, construct one cumulative canonical 2.0.2
candidate, validate it against both live native binaries, restore the missing
platform, and verify both live manifests. Never replay historical groups
blindly and never weaken canonical identity or backend validation to accommodate
a stale client.

## Supported and retired entry points

- `scripts/eas-update-production.sh` delegates only to the guarded dual-platform
  publisher.
- `scripts/publish-validated-production-ota.mjs` is the exact-artifact
  publisher and defaults to both platforms.
- `scripts/verify-production-channel-parity.mjs` is the read-only live parity
  and post-remap verifier.
- `scripts/assert-production-ota-compatible.mjs` is a read-only native/runtime
  compatibility check; it is not a publisher.
- Legacy iOS-only Production publishers are retired and fail closed.
- Direct generic `eas update`, `eas channel:edit`, `eas build`, and `eas submit`
  commands are not governed release entry points.

The permanent policy regression suite is `npm run test:production-release-policy`
and is included in the cumulative release-critical gate.
