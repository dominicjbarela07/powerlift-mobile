# App Store distribution screenshots — October 9, 2026

Current delivery: six corrected iPhone PNGs at **1284 × 2778** for the owner’s
actual **6.5-inch upload slot**, plus five unchanged iPad PNGs at **2064 × 2752**.
See the completed owner-correction section below; the initial package is historical.

## Owner request and acceptance

Create good distribution screenshots from the current Production mobile UI on a
Dynamic Island iPhone and iPad. The owner explicitly deferred iPhone Duo because
the product is not optimized for it. The owner's latest backend correction is
binding: use development, never the live backend, for these captures.

Deliver clean, visually inspected, full-resolution PNGs grouped by device, an
open preview gallery and a downloadable package. Use actual app screens with
realistic fictional local data and existing approved artwork/crops. Preserve
Session behavior, equipment isolation and cumulative shipped fixes. No customer
records may be used. No cloud native build, deployment, submission or App Store
upload is part of this request. Preserve the owner's simulator and source work.

## Initial delivery — superseded for the 6.5-inch upload slot

Completed: six iPhone 17 Pro PNGs at 1206 × 2622 and five iPad Pro 13-inch (M5)
PNGs at 2064 × 2752. All eleven are native, unmodified, RGB PNGs without alpha.
The selected set covers Today, Session plan/workspace, real set logging, Ledger,
strength analysis and readiness. Duo is excluded by explicit owner direction.

Files and the preview are retained outside the source/upload tree:

- Output directory: `/Users/dominic/Documents/Codex/2026-10-03/re/outputs/distribution-screenshots-2026-10-09/`
- Package: `Strength-Ledger-Distribution-Screenshots.zip` (approximately 9.1 MB)
- Preview: `http://127.0.0.1:8791/index.html`
- Evidence: `provenance.json` contains per-image dimensions/hashes, source,
  devices, installed bundle hashes and transport validation.

The ZIP contains exactly eleven PNGs, index.html, README.txt and provenance.json.
Its CRC and every archived file hash were verified against the delivered files.
Private demo credentials, rejected captures, logs and build intermediates are
excluded. Only the device PNG files are intended for screenshot upload.

## Source, runtime and backend

Product source: `4e9dc73fa00b9e5de0ebaf7fb194a35526a499fe` in the Production
mobile repository. Product source and approved assets were not changed.
Current mobile JS runs inside a local 2.1.0 simulator shell. This is capture
provenance, not certification of the owner's 3.0 native store binary.

Both separate capture devices have native OTA disabled and the same installed
JS bundle SHA-256:
`0c4d6faa15225e991f7149f736c763595827ef3e35af76d0fc630aa75f5627b3`.
The owner's iPhone Air simulator was not used for captures.

All selected screenshots use local DEV `http://127.0.0.1:5002`. Dedicated fictional
identity: user 81 / athlete 71, individual workspace, valid self-relationship and
local entitlement. Data includes nine completed historical Sessions, 99 historical
sets and current Session 1860. Two current sets were saved through the actual app:
Squat 400 lb × 5 @ 7 RPE and Dumbbell Curl 40 lb × 12 @ 1 RIR. Read-only local
verification confirmed their identity ownership and persisted set count.

## Backend selection incident and protection

An initial preview unexpectedly read the Production origin because Expo's
virtual environment module merged the existing .env.local over the supplied
capture environment. Before detection, the preview made a Production mobile/me
read and one unsuccessful fictional demo login (401). No owner credentials were
used and no live training records were changed. Both capture apps were stopped.

Correction: the isolated capture Metro configuration resolves the virtual
environment module to an explicit local DEV shim. The capture entry also rejects
HTTP fetches outside the exact `http://127.0.0.1:5002/` prefix. This capture-only
configuration lives in ignored build cache, not shared product configuration;
the original .env.local and the owner's development runtime remain unchanged.

The guard was deliberately failure-tested: local DEV was accepted, while the
Production origin, a deceptive hostname prefix, wrong scheme and alternate
localhost origin were all rejected before network dispatch. Installed bundles
on both devices were independently hash-checked and inspected for the DEV shim,
origin guard and disabled native OTA before the final captures.

## Visual and functional validation

Inspected actual app UI and final PNGs on both device sizes. Removed an iOS
password-saving prompt capture from the selection, excluded a weakly cropped
welcome capture, and replaced the cramped Squat active-logger composition with
the actual Curl logger after a saved set. Original/rejected files remain private;
no artwork, crop approvals or screenshot pixels were modified.

Validated normal local sign-in, Today, Session plan, readiness Save & Begin,
Core and accessory set saves, history, Ledger, strength analysis and Programming
workspace. Charts and history use dedicated local fixture evidence; the UI is
not mocked. The screenshot gallery was visually inspected and left open.

State-machine closeout:

- Touched state machine: capture transport and a dedicated local demonstration
  identity exercising existing auth/readiness/Session state; no product state
  machine implementation changed.
- Adjacent systems: API environment resolution, native credentials/OTA, identity,
  workspace/entitlement and Session persistence.
- Existing workflows validated: the actual local workflows listed above,
  including two persisted saves and history/analysis surfaces.
- Regression confidence: no tracked product code or shared configuration changed;
  capture devices/data are isolated; exact installed bundles and rejected origins
  were checked. The local JS bundle was compiled successfully. Product type and
  release suites were not rerun for this documentation/artifact-only task.

This task neither publishes an update nor establishes store-binary/native release
certification. No temporary Git worktrees were created. The same closeout record
is retained in canonical DEV and Production mobile documentation.

## Screenshot specification reference

Apple screenshot specifications checked October 9, 2026:
https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications

## Owner correction — required 6.5-inch upload slot

The owner's October 9 App Store Connect screenshot explicitly accepts portrait
1242 × 2688 or 1284 × 2778 in the visible iPhone 6.5-inch Display slot. The
initial 1206 × 2622 delivery does not fit that slot. Selecting a generally
supported device size without matching the actual upload destination was a
delivery validation failure. Correct the package in this run with native
1284 × 2778 captures from a separate local simulator. Keep the original Dynamic
Island set as separately labeled optional captures; preserve the existing iPad
set. Continue using DEV only and fictional data. No new product changes or
App Store upload are authorized.

Acceptance: correctly labeled primary 6.5-inch upload folder; every delivered
iPhone image matches the exact accepted dimensions; iPad images remain intact;
ZIP and gallery point to the corrected package; retained executable slot
validation rejects the original mismatched set deliberately. **Correction completed.**

Delivered six new native iPhone 13 Pro Max captures at 1284 × 2778, all passing
the owner’s exact 6.5-inch upload dimensions. The physical display is 6.7 inches;
the folder is labeled by the App Store upload slot. The separate original
Dynamic Island files remain preserved. All five iPad images are byte-identical
to the original 2064 × 2752 captures. No screenshots were resized or cropped;
removal of entirely opaque alpha preserved every RGB pixel.

The new phone installed the same hash-verified guarded capture bundle with native
OTA disabled. It uses only local DEV and the fictional demonstration identity.
A third current set was saved through the real UI (Curl 40 lb × 12 @ 1 RIR),
and the corrected logger capture shows its actual rest timer. All six corrected
iPhone screens were visually inspected. No product source/configuration changed.

Corrected output: `/Users/dominic/Documents/Codex/2026-10-03/re/outputs/distribution-screenshots-corrected-2026-10-09/`.
Package: `Strength-Ledger-CORRECTED-6.5-inch-and-iPad.zip`.
Preview: `http://127.0.0.1:8792/index.html`.

All eleven PNGs pass `scripts/verify-distribution-screenshots.py` against their
exact upload slots. Deliberately checking the original 1206 × 2622 iPhone set
against the 6.5-inch slot fails with exit 1. The validator also rejects alpha,
invalid dimensions and corrupt PNG chunks. Python compilation passed. The
15-entry ZIP contains eleven PNGs and four supporting files; CRC and every
archived byte were verified. `validation-report.json` and `provenance.json`
retain the inventory, hashes, failure-test evidence and source/device provenance.
The corrected preview gallery was visually inspected and left open in Codex.

Permanent protection: agent guidance in both canonical DEV and Production points
to this incident and requires matching the actual destination slot and running
the executable inventory check before screenshot delivery. No cloud build,
deployment, store submission or App Store upload was performed.
