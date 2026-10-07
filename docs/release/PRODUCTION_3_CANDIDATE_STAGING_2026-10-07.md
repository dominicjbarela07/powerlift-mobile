# Production 3 candidate staging — October 7, 2026

Owner request: “All right, you'll stage all candidates in the production folder
\"/powerlifting_app\" and \"/powerlifting_app/powerlift_mobile\"”.

Resolved destinations: `/Users/dominic/powerlifting_app` for the backend and
`/Users/dominic/powerlifting_app/powerlift_mobile` for the mobile candidate.
This authorizes local candidate assembly/staging, not a Production deployment,
OTA, paid native build or store submission.

Acceptance:

- Stage the backend candidate on the exact current live/main source, plus the
  bounded reviewed search-ranking change required by the readiness sweep.
- Stage the complete cumulative Mobile3 candidate in the named mobile checkout,
  retaining reviewed Education, Logger/UI/search/readiness fixes, approved OHP
  and all existing image/crop/identity protection. Preserve the separately
  held-back Cable backend/catalog paths using their exact governed projection.
- Preserve existing branches, tracked/untracked work, databases, local settings,
  nested repositories and legacy2.0.2 source/history; create no temporary worktree
  merely for convenience. Record any necessary checkout transition and retained
  backup before modifying it.
- Validate the actual destination source, dependencies, type/contracts and local
  artifact inclusion. Report failed release gates and outstanding native/customer
  certification honestly. Do not weaken protections to label staging a release GO.
- Retain destination/source identities and a complete file/holdback comparison.
  Canonical DEV remains the superset. No shipped or unique candidate fix may exist
  only in the Production candidate checkout.
- Continue independent checks if the Mac locks; do not repeat already satisfactory
  screens or request an unlock.

Starting canonical mobile: `57ddc768d964dacc2473e6be9cca464461ec1891`.
Starting canonical backend: `35027c051cb22dd9611ee7b3c0cf3ada8eb803f3`.
Starting Production backend checkout: `ada0ed1861027b2d2d346794ef9fac2e851821f8`.
Current live/backend main: `751a1173b301cb382557c5cbda59e4fdf72633b2`.
Starting legacy mobile checkout/main: `61a6893f5ca02cb53b347460adeef5121d681cad`.

Results pending local candidate assembly and destination checks.
