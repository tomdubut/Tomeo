/** In-memory cache with a time-to-live and a maximum size: the oldest entry is dropped when full,
 *  so caching every distinct search query can't grow server memory without limit. */
export function createBoundedCache<V>(maxEntries: number, ttlMs: number) {
  const entries = new Map<string, { value: V; expiresAt: number }>()
  return {
    get(key: string): V | undefined {
      const hit = entries.get(key)
      if (!hit) return undefined
      if (hit.expiresAt <= Date.now()) {
        entries.delete(key)
        return undefined
      }
      return hit.value
    },
    set(key: string, value: V) {
      entries.delete(key)
      entries.set(key, { value, expiresAt: Date.now() + ttlMs })
      if (entries.size > maxEntries) entries.delete(entries.keys().next().value as string)
    },
  }
}
