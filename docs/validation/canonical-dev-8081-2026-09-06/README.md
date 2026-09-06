# Canonical DEV Metro 8081 — Source and Runtime Proof

Captured from the actual iPhone 17 DEV simulator on 2026-09-06 after opening
`exp://172.20.5.63:8081`. Before any screenshot was accepted, the governed
runtime certification proved that port 8081 was served from:

- project root: `/Users/dominic/powerlifting_app_dev/powerlift_mobile`
- branch: `dev/canonical-mobile`
- source commit: `7bf3f84f728174107777407c89ca88a7d5796ba2`
- remote commit: `7bf3f84f728174107777407c89ca88a7d5796ba2`
- runtime/app version: `2.1.0`
- listener PID: `86121`
- listener command: local Expo CLI with explicit `--port 8081`

`runtime-certificate.json` is the machine-readable pre-capture certificate.
It records the listener cwd and command plus the live Expo manifest's project
root, runtime version, and 8081 launch-asset URL.

Visual evidence:

- `overview-male-lb.png`: Overview reports 1,085 lb as Tier I and identifies
  1,102 lb as the Tier II threshold.
- `clubs-male-lb.png`: male Total and per-lift cards use governed tier targets
  and percentile evidence in pounds.
- `trophies-male-lb.png`: the cabinet uses Tier I–VII identity rather than the
  retired metal names and fixed pound clubs.
- `milestones-male-lb.png`: Squat, Bench Press, and Deadlift milestones use the
  governed seven-tier standard.
- `trophies-female-kg.png`: the female standard is distinct, with 240 kg and
  280 kg earned and 305 kg next for the 290 kg fixture.
- `clubs-male-kg.png` and `clubs-male-kg-lifts.png`: the same male fixture in
  kilograms, including the lower Bench Press and Deadlift cards.

These are DEV validation artifacts only. No TestFlight or Production release
was started, published, or changed.
