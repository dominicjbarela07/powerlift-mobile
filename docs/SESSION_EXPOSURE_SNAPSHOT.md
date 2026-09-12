# Last Comparable Exposure

The active Logger shows prior performed evidence. Current Session Sets never become its own comparison. Neither focus, expansion nor a display clock is an evidence mutation.

## Ownership

Accessories consume `movement_history.previous_exposure` from the existing authorized `history=summary` Session hydration. The backend already selects the canonical representative Set, resolves exact movement/equipment identity, and excludes the Session date and later dates. The card performs no accessory-history request. It validates the effective movement ID, comparison key, equipment configuration where required, prior Session ID and date. An explicitly empty/deleted history becomes neutral; failed Session refreshes retain the existing authorized payload.

Core and Core variants use their exact governed Core ID through the existing v2 endpoint. A Session-scoped, unit-independent in-memory cache deduplicates requests and stores only the compact selected exposure. Its key includes viewer, athlete, Session/date, movement class/ID, equipment and comparison identity. It retains successful results across component remounts/navigation and failures. There is no TTL. Same-result responses preserve the cached object without another notification. Entries are capped at 32. Logout/account change clears them; denied access suspends loading until a Session is authorized again.

The existing evidence-read invalidation owner now supplies the mutation path. Other Session history mutations and catalog/equipment/policy changes invalidate Core snapshots. Current Session mutations and unrelated preferences/readiness do not. Explicit pull-to-refresh invalidates through that same owner. In-flight pre-mutation responses cannot replace newer evidence. API access checks, entitlement and Coach relationship enforcement remain authoritative.

Core fallback retains the existing three-month/six-exposure query bound; its empty state identifies this as recent evidence and links to the full record. The existing backend v2 response still includes its analytics fields; the cache discards those fields after selecting the prior exposure. No new endpoint, backend deployment, schema or full Ledger query is introduced. The current server does not supply a cross-device Core history revision in Session summary: remote Core edits are picked up by explicit refresh, not guessed from focus or a timer. Accessory remote changes arrive through normal Session revalidation.

## Presentation

Quiet date, actual load/assistance × reps, then effort (RIR preferred for accessories, RPE for Core/variants), canonical representative-set context, and the full-history link. The naked metric code and small analytic sparkline are removed. No progression is fabricated. Core's available count is labeled **recorded sets**. Accessory summary rows are capped and do not prove a complete prior working-set dose, so that count is omitted. Recorded load conversion preserves two-decimal precision rather than snapping to a gym increment; existing prescription/Logger rounding is unchanged.

The old focus/foreground recovery owner unconditionally changed the native body key, remounting the card and repeating an uncached v2 request. Ordinary focus still revalidates the Session silently but no longer remounts it. Measured missing-body recovery and explicit Retry retain their bounded remount path. The isolated Session/rest display clock remains unchanged.

## Permanent contracts

`test-session-exposure-snapshot.mjs` exercises request deduplication, 120 repeated reads, remount reuse, mutation exclusion, historical invalidation, offline retention, same-result identity, stale response races, logout/denial, movement/equipment/athlete/policy isolation, current-Session exclusion, assistance/effort/date/count semantics and responsive text wrapping. `test-evidence-api-integration.mjs` runs the actual API invalidation wiring. Both the accepted suite and release-critical gate protect this behavior.
