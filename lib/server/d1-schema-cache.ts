import type { D1Database } from "@cloudflare/workers-types";

export type D1SchemaCacheEntry = {
  expiresAt: number;
  promise?: Promise<void>;
};

export const DEFAULT_D1_SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

export async function runCachedD1SchemaSetup({
  cache,
  db,
  setup,
  ttlMs = DEFAULT_D1_SCHEMA_CACHE_TTL_MS
}: {
  cache: WeakMap<D1Database, D1SchemaCacheEntry>;
  db: D1Database;
  setup: () => Promise<void>;
  ttlMs?: number;
}) {
  const now = Date.now();
  const cached = cache.get(db);

  if (cached && cached.expiresAt > now) {
    if (cached.promise) await cached.promise;
    return;
  }

  const setupPromise = setup();
  cache.set(db, {
    expiresAt: now + ttlMs,
    promise: setupPromise
  });

  try {
    await setupPromise;
    cache.set(db, {
      expiresAt: Date.now() + ttlMs
    });
  } catch (error) {
    cache.delete(db);
    throw error;
  }
}
