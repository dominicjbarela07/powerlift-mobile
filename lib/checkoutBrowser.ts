import * as WebBrowser from 'expo-web-browser';
import { setUpdateBlocker } from '@/lib/updateSafety';

const MODAL_DISMISS_DELAY_MS = 400;
export type CheckoutBrowserResult = WebBrowser.WebBrowserAuthSessionResult;
export async function waitForBlockingUiToDismiss(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, MODAL_DISMISS_DELAY_MS));
}
export async function openRecoverableCheckoutBrowser(url: string): Promise<CheckoutBrowserResult> {
  setUpdateBlocker('billing_browser', true);
  try {
    // Card verification and bank challenges belong to the user. Never close
    // their browser on a timer. This callback is navigation, not billing proof.
    return await WebBrowser.openAuthSessionAsync(url, 'powerliftmobile://billing-return', {
      preferEphemeralSession: true,
    });
  } finally {
    setUpdateBlocker('billing_browser', false);
  }
}
