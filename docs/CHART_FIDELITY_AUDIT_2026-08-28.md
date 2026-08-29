# Mobile Chart Fidelity Audit — 2026-08-28

## Standard

Analytical charts use the shared `AnalyticalTimeSeriesChart` contract: a metric-aware numeric Y axis, real temporal X ticks, honest units, deterministic scaling, a selected datapoint, vertical inspection guide, bounded tooltip, and whole-plot press/scrub interaction. Compact status previews may remain decorative only when an exact value is already present and the preview is not the analytical destination.

## Analytical surfaces

| Surface | Metric / unit | X axis | Inspection | DEV implementation | TestFlight before this candidate |
| --- | --- | --- | --- | --- | --- |
| Team Brief — Max Progression | Change (%) | real period dates | tap/scrub, selected point, guide, contextual tooltip | shared contract | legacy static chart |
| Team Brief — Estimated DOTS Progression | change in estimated DOTS (%) | real period dates | tap/scrub, selected point, guide, athlete/session context | shared contract | legacy static chart |
| Team Brief — Adherence | adherence (%) | real period dates | tap/scrub, selected point, guide, numerator/denominator context where supplied | shared contract | legacy static chart |
| Team Brief — PR Rate | PRs per 100 planned sets | real period dates | tap/scrub, selected point, guide, rate context | shared contract; never formatted as percent | legacy static chart |
| Team Brief — Outlier / Athlete Deep Dive | selected coaching metric and its canonical unit | real period dates | tap/scrub, selected point, guide, team/normal-band context | shared contract | legacy static chart |
| Coach Session Reviewer — Movement Evidence | load/e1RM in preferred weight unit | exact exposure dates | tap/scrub, selected point, guide, load/reps/effort/source context | shared contract | legacy static chart |
| Coach Session Reviewer — Recovery Context | readiness/score scale | exact observation dates | tap/scrub, selected point, guide, multi-series context | shared contract | legacy static chart |
| Athlete Progression | e1RM/load/volume/RPE/readiness with canonical unit | real observation dates | tap/scrub, selected point, guide, metric-specific tooltip | shared contract | legacy static chart |
| Ledger — Strength | load/e1RM in preferred weight unit | real performance dates | tap/scrub, selected point, guide, metric/source context | shared contract | legacy static chart |
| Ledger — Movement Detail | performed load in preferred weight unit | exact set dates | tap/scrub, selected point, guide, reps/effort context | shared contract; fails closed when comparison is disallowed | legacy static chart |
| Session Recap — Expanded Movement Trend | load/e1RM in preferred weight unit | exact exposure dates | tap/scrub, selected point, guide, performance context | shared contract | legacy static chart |
| Canonical Movement History | load/e1RM/volume in canonical unit | exact exposure dates | existing pan inspection, selected point, guide, tooltip | existing `AnalyticalHistoryChart` retained | already analytical |

## Intentionally decorative / navigational previews

| Surface | Classification | Reason |
| --- | --- | --- |
| Athlete Home and Training Hub compact readiness/volume/strength previews | decorative preview | exact summary value and date/context are already shown; the preview is a navigation aid, not the analytical destination |
| Coach Home queue and athlete-card sparklines | decorative preview | compact triage/status evidence with exact card values and a direct path to the analytical surface |
| Coach Athlete Hub compact readiness/bodyweight previews | decorative preview | space-constrained summary with exact latest values and a dedicated progression destination |
| Ledger Home mini-lines and context bars | decorative preview | room/index navigation and summary context, not standalone analysis |
| Session Recap collapsed projection sparkline | decorative preview | summary state only; expanding the movement exposes the full analytical chart |
| Rings, gauges, progress rails, achievement glyphs, and anatomy artwork | status / semantic visual | not time-series charts and therefore outside axis/inspection requirements |

## Scaling and interaction rules

- Numeric scale steps use human intervals (`1`, `2`, `2.5`, `5`, `10` × powers of ten), restrained padding, fixed-domain support, and honest zero handling.
- Time ticks use three to five real date anchors according to plot width and observed date span, while removing duplicate labels.
- Tooltips clamp to plot bounds and expose the metric name, canonical unit, date, and supplied supporting context.
- The whole plot is an inspection surface; the nearest real observation is selected during press and scrub.
- Sparse or missing data fails closed to an explicit empty state. It is never converted into a decorative fake trend.

## Release comparison

The currently served TestFlight group before this candidate is `de4315c2-2d3a-4d80-b409-e0b2146c5c84` on runtime `2.1.0`. Canonical DEV contains the analytical upgrades above; therefore another cumulative TestFlight OTA is required to remove that chart-fidelity delta. This change is client-side presentation/interaction only and does not change backend, schema, request, authentication, entitlement, or persisted product state.
