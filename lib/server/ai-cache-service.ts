const AI_CACHE_MAX_ITEMS = 80;
const aiCache = new Map<string, { createdAt: number; value: unknown }>();

export function createStableAiHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getCachedAiResult<T>(key: string): T | null {
  const cached = aiCache.get(key);
  if (!cached) return null;

  return cached.value as T;
}

export function setCachedAiResult(key: string, value: unknown) {
  if (aiCache.size >= AI_CACHE_MAX_ITEMS) {
    const firstKey = aiCache.keys().next().value;
    if (firstKey) aiCache.delete(firstKey);
  }

  aiCache.set(key, {
    createdAt: Date.now(),
    value
  });
}
