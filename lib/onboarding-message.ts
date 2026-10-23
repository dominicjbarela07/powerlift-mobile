/** Keep recoverable user guidance; keep provider internals out of setup UI. */
export function onboardingMessage(value: unknown, fallback = 'We could not finish that step. Your account is saved; please try again.'): string {
  const message = typeof value === 'string' ? value.trim() : '';
  if (!message || message.length > 300 || /auth required|billing required|verify-email|HTTP\s*\d|traceback|https?:\/\/|sk_(?:live|test)_|^[a-z]+(?:_[a-z]+)+$/i.test(message)) return fallback;
  return message;
}
