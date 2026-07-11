import { InteractionManager } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const CHECKOUT_BROWSER_TIMEOUT_MS = 120_000;

export type CheckoutBrowserResult =
  | WebBrowser.WebBrowserResult
  | { type: 'timeout' };

export async function waitForBlockingUiToDismiss(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
  });
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
