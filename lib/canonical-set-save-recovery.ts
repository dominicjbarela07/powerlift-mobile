import { isApiRequestError } from './api-request-policy';

const RECOVERY_DELAYS_MS = [300, 900] as const;

/** Reuse the durable submission and request after an ambiguous transport failure. */
export async function recoverCanonicalSetSave<T>({
  clientSubmissionId,
  request,
  assertOwner,
  onRecovery,
  wait = (milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
}: {
  clientSubmissionId: string;
  request: () => Promise<T>;
  assertOwner: () => void;
  onRecovery?: (attempt: number, failure: 'network' | 'timeout') => void;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<T> {
  if (!clientSubmissionId.trim()) throw new Error('A durable Set submission ID is required.');
  for (let attempt = 0; ; attempt += 1) {
    assertOwner();
    try {
      return await request();
    } catch (error) {
      if (attempt >= RECOVERY_DELAYS_MS.length || !isApiRequestError(error)
        || (error.kind !== 'network' && error.kind !== 'timeout')) throw error;
      assertOwner();
      onRecovery?.(attempt + 1, error.kind);
      await wait(RECOVERY_DELAYS_MS[attempt]);
    }
  }
}
