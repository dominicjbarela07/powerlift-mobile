# OpenPowerlifting strength-tier DEV visual proof

Captured on 2026-09-05 from the DEV-only certification route for the immutable
`opl_2026_09_04_b8b9bf6e_v1` standard.

## Native iOS simulator

| Screenshot | State verified |
| --- | --- |
| `ios-male-mid-total-kg.png` | Male mid-tier Total and Squat, canonical kg thresholds, trophies, current/next/remaining/percentile |
| `ios-male-mid-total-lb.png` | The same male evidence with presentation-only whole-pound conversion |
| `ios-female-mid-total-kg.png` | Female-specific Total and Squat thresholds and progress |
| `ios-male-below-tier-i-kg.png` | Below-Tier-I Total and Squat state with Tier I as the next target |
| `ios-female-tier-vii-total-kg.png` | Terminal Tier VII Total and Squat state with no next tier |

## Full core-lift browser captures

The browser captures supplement the native screenshots with Squat, Bench Press,
and Deadlift visible together. They cover male/female mid-tier and female Tier VII
core-lift rails, plus the required kg/lb and below-Tier-I states.

The certification fixture is DEV-only and is selected with `sex`, `scenario`,
`section`, and `unit` query parameters. It does not ship a static standard: the
fixture uses the same serialized standard and server-standing shapes consumed by
the live Ledger screen.
