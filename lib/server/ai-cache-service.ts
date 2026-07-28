const AI_CACHE_MAX_ITEMS = 80;
const aiCache = new Map<string, { createdAt: number; value: unknown }>();

export type AiCacheScope = { namespace: string; tenantId: string };

export function createStableAiHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getCachedAiResult<T>(key: string, scope?: AiCacheScope): T | null {
  const cached = aiCache.get(scopedKey(key, scope));
  if (!cached) return null;

  return cached.value as T;
}

export function setCachedAiResult(key: string, value: unknown, scope?: AiCacheScope) {
  if (aiCache.size >= AI_CACHE_MAX_ITEMS) {
    const firstKey = aiCache.keys().next().value;
    if (firstKey) aiCache.delete(firstKey);
  }

  aiCache.set(scopedKey(key, scope), {
    createdAt: Date.now(),
    value
  });
}

export function invalidateCachedAiResults(scope: AiCacheScope) {
  const prefix = scopePrefix(scope);
  let deleted = 0;
  for (const key of aiCache.keys()) {
    if (!key.startsWith(prefix)) continue;
    aiCache.delete(key);
    deleted += 1;
  }
  return deleted;
}

function scopedKey(key: string, scope?: AiCacheScope) {
  return `${scopePrefix(scope)}${createStableAiHash(key)}`;
}

function scopePrefix(scope?: AiCacheScope) {
  const namespace = scope?.namespace.trim() || "legacy";
  const tenantId = scope?.tenantId.trim() || "global";
  return `${createStableAiHash(namespace)}:${createStableAiHash(tenantId)}:`;
}
