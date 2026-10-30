/** Nested Ledger layouts can outlive a query change. Follow the active Ledger
 * route's query, but retain it while a source sheet or another tab is focused. */
export function ledgerRouteContext<T>(pathname: string, active: T, retained: T): T {
  return /^\/(?:\(tabs\)\/)?ledger(?:\/|$)/.test(pathname) ? active : retained;
}
