export type DatabaseConfig = {
  url: string | null;
  isConfigured: boolean;
};

export function getDatabaseConfig(): DatabaseConfig {
  const url = process.env.DATABASE_URL ?? null;

  return {
    url,
    isConfigured: Boolean(url)
  };
}
