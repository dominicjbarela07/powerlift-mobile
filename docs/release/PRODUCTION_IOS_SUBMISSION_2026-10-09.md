# Production iOS submission — October 9, 2026

## Task acceptance

The owner requested `now for the eas submit` for the Production iOS release and
corrected the misleading `--profile testflight` handoff: `this isn't going to
test flight`. Provide an unambiguous Production submission command for the
already-finished Production 3.0.0 build 35.

Add `submit.production.ios.ascAppId` using the established Apple app ID
6756639297. Preserve all build profiles, Production Android submission settings,
existing TestFlight settings, application behavior, assets and cumulative fixes.
Validate with the installed EAS submission-profile schema; carry the same
configuration into canonical DEV and the Production candidate. No native build,
submission, tester-group assignment or public release is performed by the agent.

## Verified build and owner command

The EAS read-only build query reported FINISHED / IOS / STORE, app/runtime 3.0.0,
build 35, profile `production3-preparation`, source
`93cbf4ed9e223c7dae1588995ebb64bfbc46ffd9` and build ID
`22c6739e-8857-4478-a5d8-a2a21523ddb2`.

Run in `/Users/dominic/powerlifting_app/powerlift_mobile`:

```sh
eas submit --platform ios --profile production --id 22c6739e-8857-4478-a5d8-a2a21523ddb2 --wait
```

EAS Submit uploads the existing binary to App Store Connect. The owner selects
build 35 for the 3.0.0 App Store version and submits that version for App Review.
This does not itself release the app publicly. The submit-profile name is local
configuration; Apple uses the same App Store Connect binary-ingestion pipeline
for App Store and TestFlight availability. No beta testing group is requested.

The submission-only configuration change requires no rebuild of build 35.

Validation: installed EAS `EasJsonUtils.getSubmitProfileAsync` resolved the
Production iOS profile to app 6756639297 in all three checkouts. Production
candidate TypeScript and whitespace checks passed. Only the submission stanza
was changed; all build profiles and existing submit settings were compared and
retained unchanged. The agent did not execute EAS Submit.
