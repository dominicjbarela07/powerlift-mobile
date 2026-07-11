import * as WebBrowser from 'expo-web-browser';

const CHECKOUT_BROWSER_TIMEOUT_MS = 120_000;
const MODAL_DISMISS_DELAY_MS = 400;

export type CheckoutBrowserResult =
  | WebBrowser.WebBrowserResult
  | { type: 'timeout' };

export async function waitForBlockingUiToDismiss(): Promise<void> {
  // React Native Modal uses a native transition. A bounded delay lets the
  // backdrop unmount without making checkout depend on InteractionManager,
  // whose queue can remain blocked by that same transition.
  await new Promise<void>((resolve) => setTimeout(resolve, MODAL_DISMISS_DELAY_MS));
}

export async function openRecoverableCheckoutBrowser(url: string): Promise<CheckoutBrowserResult> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      }),
      new Promise<{ type: 'timeout' }>((resolve) => {
        timeout = setTimeout(() => resolve({ type: 'timeout' }), CHECKOUT_BROWSER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    try {
      WebBrowser.dismissBrowser();
    } catch {
      // The browser may already be dismissed. UI cleanup must still continue.
    }
  }
}
