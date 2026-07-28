import type { D1Database, D1Result } from "@cloudflare/workers-types";

type AdminUserRow = {
  email: string;
  first_name: string;
  is_owner: number;
  last_name: string;
  role: string;
  role_key: string;
  status: string;
};

export type ArtifactTestRow = {
  created_at: number;
  creator_email: string;
  deleted_at: number | null;
  deleted_by: string | null;
  id: string;
  state_json: string;
  updated_at: number;
  version: number;
};

export type ArtifactEventTestRow = {
  actor_email: string;
  artifact_id: string;
  artifact_version: number;
  event_type: string;
  id: string;
  occurred_at: number;
};

export type ArtifactReportTestRow = {
  artifact_id: string;
  content: string;
  created_at: number;
  created_by: string;
  id: string;
  kind: string;
  title: string;
};

type AdminSettingsTestRow = {
  admin_email: string;
  clear_safe_memory_requested_at: number | null;
  created_at: number;
  preferences_json: string;
  updated_at: number;
  updated_by: string;
};

type OwnerSettingsTestRow = {
  config_json: string;
  created_at: number;
  id: string;
  updated_at: number;
  updated_by: string;
  version: number;
};

export type SettingsEventTestRow = {
  actor_email: string;
  event_type: string;
  id: string;
  occurred_at: number;
  scope: string;
  version: number;
};

type ObservationTestRow = {
  action_outcome: string;
  admin_email: string;
  approval_count: number;
  command: string;
  created_at: number;
  estimated_cost_microusd: number;
  id: string;
  outcome: string;
  tool_call_count: number;
};

type FakeState = {
  artifactEvents: Map<string, ArtifactEventTestRow>;
  artifactReports: Map<string, ArtifactReportTestRow>;
  artifacts: Map<string, ArtifactTestRow>;
  ownerSettings: Map<string, OwnerSettingsTestRow>;
  settings: Map<string, AdminSettingsTestRow>;
  settingsEvents: Map<string, SettingsEventTestRow>;
};

export class AdminAIPersistenceFakeD1 {
  private state: FakeState = {
    artifactEvents: new Map(),
    artifactReports: new Map(),
    artifacts: new Map(),
    ownerSettings: new Map(),
    settings: new Map(),
    settingsEvents: new Map()
  };
  private readonly observations: ObservationTestRow[] = [];

  constructor(private readonly users: AdminUserRow[]) {}

  asD1() {
    return this as unknown as D1Database;
  }

  prepare(sql: string) {
    return new PersistenceStatement(this, sql);
  }

  async batch(statements: PersistenceStatement[]) {
    const draft = cloneState(this.state);
    const results: D1Result<unknown>[] = [];
    let previousChanges = 0;
    for (const statement of statements) {
      const result = statement.runInBatch(draft, previousChanges);
      previousChanges = Number(result.meta.changes || 0);
      results.push(result);
    }
    this.state = draft;
    return results;
  }

  adminUser(email: string) {
    return this.users.find((user) => user.email === email) || null;
  }

  artifact(id: string) {
    return this.state.artifacts.get(id) || null;
  }

  artifacts() {
    return Array.from(this.state.artifacts.values()).sort(
      (left, right) => right.updated_at - left.updated_at || left.id.localeCompare(right.id)
    );
  }

  artifactEvents(id: string) {
    return Array.from(this.state.artifactEvents.values())
      .filter((event) => event.artifact_id === id)
      .sort(
        (left, right) => left.occurred_at - right.occurred_at || left.id.localeCompare(right.id)
      );
  }

  artifactEventRows() {
    return Array.from(this.state.artifactEvents.values());
  }

  artifactReportRows() {
    return Array.from(this.state.artifactReports.values());
  }

  adminSettings(email: string) {
    return this.state.settings.get(email) || null;
  }

  ownerSettings(id: string) {
    return this.state.ownerSettings.get(id) || null;
  }

  settingsEventRows() {
    return Array.from(this.state.settingsEvents.values());
  }

  addObservation(row: ObservationTestRow) {
    this.observations.push({ ...row });
  }

  observationRows(email?: string) {
    return this.observations
      .filter((row) => !email || row.admin_email === email)
      .sort((left, right) => right.created_at - left.created_at);
  }
}

class PersistenceStatement {
  private params: unknown[] = [];
  private readonly normalizedSql: string;

  constructor(
    private readonly db: AdminAIPersistenceFakeD1,
    sql: string
  ) {
    this.normalizedSql = sql.replace(/\s+/g, " ").trim();
  }

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>() {
    if (this.normalizedSql.includes("FROM admin_users")) {
      return this.db.adminUser(String(this.params[0] || "")) as T | null;
    }
    if (this.normalizedSql.includes("FROM admin_ai_artifacts")) {
      return this.db.artifact(String(this.params[0] || "")) as T | null;
    }
    if (this.normalizedSql.includes("FROM admin_ai_admin_settings")) {
      return this.db.adminSettings(String(this.params[0] || "")) as T | null;
    }
    if (this.normalizedSql.includes("FROM admin_ai_owner_settings")) {
      return this.db.ownerSettings(String(this.params[0] || "")) as T | null;
    }
    if (this.normalizedSql.includes("FROM admin_ai_observations")) {
      const email = this.normalizedSql.includes("admin_email = ?1")
        ? String(this.params[0] || "")
        : undefined;
      const rows = this.db.observationRows(email);
      return {
        approval_count: rows.reduce((sum, row) => sum + row.approval_count, 0),
        estimated_cost_microusd: rows.reduce((sum, row) => sum + row.estimated_cost_microusd, 0),
        requests: rows.length,
        tool_call_count: rows.reduce((sum, row) => sum + row.tool_call_count, 0)
      } as T;
    }
    return null;
  }

  async all<T>() {
    if (
      this.normalizedSql.includes("admin_role_permissions") ||
      this.normalizedSql.includes("admin_user_permissions")
    ) {
      return { results: [] as T[] };
    }
    if (this.normalizedSql.includes("FROM admin_ai_artifact_events")) {
      return { results: this.db.artifactEvents(String(this.params[0] || "")) as T[] };
    }
    if (this.normalizedSql.includes("FROM admin_ai_artifacts")) {
      return { results: this.db.artifacts() as T[] };
    }
    if (this.normalizedSql.includes("FROM admin_ai_observations")) {
      const email = this.normalizedSql.includes("admin_email = ?1")
        ? String(this.params[0] || "")
        : undefined;
      return { results: this.db.observationRows(email).slice(0, 20) as T[] };
    }
    return { results: [] as T[] };
  }

  async run() {
    return d1Result(0);
  }

  runInBatch(state: FakeState, previousChanges: number) {
    if (this.normalizedSql.includes("INSERT INTO admin_ai_artifacts")) {
      const [id, creatorEmail, stateJson, version, createdAt, updatedAt, deletedAt, deletedBy] =
        this.params;
      if (state.artifacts.has(String(id))) return d1Result(0);
      state.artifacts.set(String(id), {
        created_at: Number(createdAt),
        creator_email: String(creatorEmail),
        deleted_at: deletedAt === null ? null : Number(deletedAt),
        deleted_by: deletedBy === null ? null : String(deletedBy),
        id: String(id),
        state_json: String(stateJson),
        updated_at: Number(updatedAt),
        version: Number(version)
      });
      return d1Result(1);
    }

    if (this.normalizedSql.includes("UPDATE admin_ai_artifacts")) {
      const [stateJson, version, updatedAt, deletedAt, deletedBy, id, expectedVersion] =
        this.params;
      const row = state.artifacts.get(String(id));
      if (!row || row.version !== Number(expectedVersion)) return d1Result(0);
      Object.assign(row, {
        deleted_at: deletedAt === null ? null : Number(deletedAt),
        deleted_by: deletedBy === null ? null : String(deletedBy),
        state_json: String(stateJson),
        updated_at: Number(updatedAt),
        version: Number(version)
      });
      return d1Result(1);
    }

    if (this.normalizedSql.includes("INSERT INTO admin_ai_artifact_reports")) {
      if (this.normalizedSql.includes("changes() = 1") && previousChanges !== 1) {
        return d1Result(0);
      }
      const [id, artifactId, title, content, kind, createdBy, createdAt] = this.params;
      if (
        Array.from(state.artifactReports.values()).some((row) => row.artifact_id === artifactId)
      ) {
        return d1Result(0);
      }
      state.artifactReports.set(String(id), {
        artifact_id: String(artifactId),
        content: String(content),
        created_at: Number(createdAt),
        created_by: String(createdBy),
        id: String(id),
        kind: String(kind),
        title: String(title)
      });
      return d1Result(1);
    }

    if (this.normalizedSql.includes("INSERT INTO admin_ai_artifact_events")) {
      if (this.normalizedSql.includes("changes() = 1") && previousChanges !== 1) {
        return d1Result(0);
      }
      const [id, artifactId, eventType, actorEmail, artifactVersion, occurredAt] = this.params;
      state.artifactEvents.set(String(id), {
        actor_email: String(actorEmail),
        artifact_id: String(artifactId),
        artifact_version: Number(artifactVersion),
        event_type: String(eventType),
        id: String(id),
        occurred_at: Number(occurredAt)
      });
      return d1Result(1);
    }

    if (this.normalizedSql.includes("INSERT INTO admin_ai_admin_settings")) {
      const [email, preferencesJson, clearAt, createdAt, updatedAt, updatedBy] = this.params;
      const existing = state.settings.get(String(email));
      state.settings.set(String(email), {
        admin_email: String(email),
        clear_safe_memory_requested_at: clearAt === null ? null : Number(clearAt),
        created_at: existing?.created_at || Number(createdAt),
        preferences_json: String(preferencesJson),
        updated_at: Number(updatedAt),
        updated_by: String(updatedBy)
      });
      return d1Result(1);
    }

    if (this.normalizedSql.includes("INSERT INTO admin_ai_owner_settings")) {
      const [id, configJson, version, createdAt, updatedAt, updatedBy] = this.params;
      const existing = state.ownerSettings.get(String(id));
      state.ownerSettings.set(String(id), {
        config_json: String(configJson),
        created_at: existing?.created_at || Number(createdAt),
        id: String(id),
        updated_at: Number(updatedAt),
        updated_by: String(updatedBy),
        version: Number(version)
      });
      return d1Result(1);
    }

    if (this.normalizedSql.includes("INSERT INTO admin_ai_settings_events")) {
      if (this.normalizedSql.includes("changes() = 1") && previousChanges !== 1) {
        return d1Result(0);
      }
      const [id, scope, eventType, actorEmail, version, occurredAt] = this.params;
      state.settingsEvents.set(String(id), {
        actor_email: String(actorEmail),
        event_type: String(eventType),
        id: String(id),
        occurred_at: Number(occurredAt),
        scope: String(scope),
        version: Number(version)
      });
      return d1Result(1);
    }

    return d1Result(0);
  }
}

function d1Result(changes: number): D1Result<unknown> {
  return { meta: { changes } as D1Result<unknown>["meta"], results: [], success: true };
}

function cloneState(state: FakeState): FakeState {
  const cloneMap = <T extends object>(source: Map<string, T>) =>
    new Map(Array.from(source, ([key, value]) => [key, { ...value }]));
  return {
    artifactEvents: cloneMap(state.artifactEvents),
    artifactReports: cloneMap(state.artifactReports),
    artifacts: cloneMap(state.artifacts),
    ownerSettings: cloneMap(state.ownerSettings),
    settings: cloneMap(state.settings),
    settingsEvents: cloneMap(state.settingsEvents)
  };
}
