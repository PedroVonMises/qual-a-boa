/**
 * Rehydrate guard for persisted stores: keeps a stored value only when its shape (array / object / primitive type)
 * matches the store's default, so corrupted storage can never crash the app on launch.
 */
export function safeMerge<T extends object>(persisted: unknown, current: T): T {
  if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) return current;
  const out: Record<string, unknown> = { ...(current as Record<string, unknown>) };
  for (const [key, value] of Object.entries(persisted as Record<string, unknown>)) {
    const base = (current as Record<string, unknown>)[key];
    if (typeof base === 'function' || !(key in current)) continue;
    const sameShape =
      Array.isArray(base) ? Array.isArray(value)
      : base !== null && typeof base === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : typeof value === typeof base;
    if (sameShape) out[key] = value;
  }
  return out as T;
}
