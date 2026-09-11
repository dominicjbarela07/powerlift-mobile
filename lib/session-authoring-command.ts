/** Deterministic retry identity. The server additionally compares SHA-256 of
 * the full command, so even a client hash collision fails closed. */
export function authoringFingerprint(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x85ebca6b);
  }
  return [a, b].map((part) => (part >>> 0).toString(16).padStart(8, '0')).join('');
}

export function sessionAuthoringCommand(workoutId: number, baseVersion: string, plan: Record<string, unknown>) {
  if (!Number.isInteger(workoutId) || workoutId <= 0 || !/^[a-f0-9]{64}$/.test(baseVersion)) {
    throw new Error('Refresh this Session before saving.');
  }
  return {
    command_key: `session-${workoutId}-${baseVersion.slice(0, 32)}-${authoringFingerprint(JSON.stringify(plan))}`,
    base_version: baseVersion,
    plan,
  };
}
