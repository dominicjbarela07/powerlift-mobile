let owner: string | null = null;
const listeners = new Set<() => void>();
export function currentExecutionActor() { return owner; }
export function setExecutionActor(value: number | string | null | undefined) {
  const next = value == null || value === '' ? null : String(value);
  if (next === owner) return;
  owner = next;
  listeners.forEach(listener => listener());
}
export function subscribeExecutionActor(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function executionActorOwns(value: string | null | undefined) {
  return Boolean(owner && value && owner === value);
}
