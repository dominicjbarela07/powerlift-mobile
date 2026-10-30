/** The shared workspace owns the canvas. Ledger lightening is route-scoped;
 * other tabs, authentication and unrelated sheets keep their existing tone. */
export function ledgerCanvasActive(pathname: string) {
  return /^\/(?:\(tabs\)\/)?ledger(?:\/|$)/.test(pathname);
}
