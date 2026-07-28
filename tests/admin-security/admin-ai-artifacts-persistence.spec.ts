import { expect, test } from "@playwright/test";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { onRequest as handleAdminAIArtifacts } from "../../functions/api/admin/ai-artifacts";
import type { AdminSessionPayload } from "../../lib/server/admin-auth";
import { createAdminCsrfToken, createAdminSessionCookie } from "../../lib/server/admin-auth";
import {
  generateAdminAIArtifactCreateInput,
  getAdminAIArtifact,
  listAdminAIArtifacts,
  mutateAdminAIArtifact,
  validateAdminAIArtifactCreateInput
} from "../../lib/server/admin-ai-artifacts";
import { AdminAIPersistenceFakeD1 } from "./admin-ai-persistence-fake";

const OWNER_EMAIL = "artifact-owner@example.com";
const CREATOR_EMAIL = "artifact-creator@example.com";
const EDITOR_EMAIL = "artifact-editor@example.com";
const VIEWER_EMAIL = "artifact-viewer@example.com";
const STRANGER_EMAIL = "artifact-stranger@example.com";
const SECRET_CONTENT = "TOP-SECRET artifact body must never enter an event row.";
const authBase = {
  ADMIN_ALLOWED_EMAILS: [
    OWNER_EMAIL,
    CREATOR_EMAIL,
    EDITOR_EMAIL,
    VIEWER_EMAIL,
    STRANGER_EMAIL
  ].join(","),
  ADMIN_AUTH_DEMO_ENABLED: "true",
  ADMIN_REQUIRE_DB_ADMIN_ROLES: "true",
  ADMIN_SESSION_SECRET: "admin-ai-artifact-persistence-secret",
  ROOT_OWNER_EMAIL: OWNER_EMAIL
};

test.describe("Admin AI artifact persistence and lifecycle", () => {
  test("persists ACL-protected artifacts through regeneration, approval, report save, and soft delete", async () => {
    const db = createDb();
    const created = await mutateAdminAIArtifact({
      actor: actor(CREATOR_EMAIL),
      db: db.asD1(),
      input: {
        content: SECRET_CONTENT,
        editorEmails: [EDITOR_EMAIL],
        exportFormats: ["md", "json"],
        kind: "report",
        operation: "create",
        sourceContext: {
          module: "analytics",
          referenceIds: ["coach:yw-101"],
          requestId: "request-101",
          scope: "section"
        },
        title: "Analytics readiness report",
        viewerEmails: [VIEWER_EMAIL]
      }
    });

    expect(created).toMatchObject({
      ok: true,
      status: 201,
      artifact: {
        approval: { status: "not-requested" },
        copyable: { enabled: true },
        creatorEmail: CREATOR_EMAIL,
        exportFormats: ["md", "json"],
        kind: "report",
        regenerationCount: 0,
        version: 1
      }
    });
    if (!created.ok) throw new Error("Expected artifact creation to succeed.");
    const artifactId = created.artifact.id;

    expect(await listAdminAIArtifacts({ actor: actor(VIEWER_EMAIL), db: db.asD1() })).toHaveLength(
      1
    );
    expect(await listAdminAIArtifacts({ actor: actor(STRANGER_EMAIL), db: db.asD1() })).toEqual([]);
    expect(
      await getAdminAIArtifact({ actor: actor(VIEWER_EMAIL), artifactId, db: db.asD1() })
    ).toMatchObject({ ok: true, artifact: { content: SECRET_CONTENT } });
    expect(
      await getAdminAIArtifact({ actor: actor(STRANGER_EMAIL), artifactId, db: db.asD1() })
    ).toMatchObject({ ok: false, status: 404 });

    expect(
      await mutateAdminAIArtifact({
        actor: actor(VIEWER_EMAIL),
        db: db.asD1(),
        input: {
          artifactId,
          content: "Viewer must not regenerate this artifact.",
          expectedVersion: 1,
          operation: "regenerate"
        }
      })
    ).toMatchObject({ ok: false, status: 403 });

    const regenerated = await mutateAdminAIArtifact({
      actor: actor(EDITOR_EMAIL),
      db: db.asD1(),
      input: {
        artifactId,
        content: "Regenerated and approved-safe report body.",
        expectedVersion: 1,
        operation: "regenerate",
        title: "Analytics readiness report v2"
      }
    });
    expect(regenerated).toMatchObject({
      ok: true,
      artifact: {
        approval: { status: "not-requested" },
        regenerationCount: 1,
        version: 2
      }
    });

    const requested = await mutateAdminAIArtifact({
      actor: actor(EDITOR_EMAIL),
      db: db.asD1(),
      input: { artifactId, expectedVersion: 2, operation: "request-report-save" }
    });
    expect(requested).toMatchObject({
      ok: true,
      artifact: { approval: { requestedBy: EDITOR_EMAIL, status: "pending" }, version: 3 }
    });

    expect(
      await mutateAdminAIArtifact({
        actor: actor(EDITOR_EMAIL),
        db: db.asD1(),
        input: {
          artifactId,
          decision: "approve",
          expectedVersion: 3,
          operation: "decide-report-save",
          reason: "Editor cannot self-approve."
        }
      })
    ).toMatchObject({ ok: false, status: 403 });

    const approved = await mutateAdminAIArtifact({
      actor: actor(OWNER_EMAIL, true),
      db: db.asD1(),
      input: {
        artifactId,
        decision: "approve",
        expectedVersion: 3,
        operation: "decide-report-save",
        reason: "Reviewed for the protected Reports area."
      }
    });
    expect(approved).toMatchObject({
      ok: true,
      artifact: { approval: { decidedBy: OWNER_EMAIL, status: "approved" }, version: 4 }
    });

    const saved = await mutateAdminAIArtifact({
      actor: actor(EDITOR_EMAIL),
      db: db.asD1(),
      input: { artifactId, expectedVersion: 4, operation: "save-to-reports" }
    });
    expect(saved).toMatchObject({
      ok: true,
      artifact: { approval: { savedBy: EDITOR_EMAIL, status: "saved" }, version: 5 }
    });
    expect(db.artifactReportRows()).toEqual([
      expect.objectContaining({
        artifact_id: artifactId,
        content: "Regenerated and approved-safe report body.",
        created_by: EDITOR_EMAIL
      })
    ]);

    const deleted = await mutateAdminAIArtifact({
      actor: actor(EDITOR_EMAIL),
      db: db.asD1(),
      input: { artifactId, expectedVersion: 5, operation: "delete" }
    });
    expect(deleted).toMatchObject({ ok: true, artifact: { deletedBy: EDITOR_EMAIL, version: 6 } });
    expect(
      await getAdminAIArtifact({ actor: actor(VIEWER_EMAIL), artifactId, db: db.asD1() })
    ).toMatchObject({ ok: false, status: 404 });
    expect(
      await getAdminAIArtifact({
        actor: actor(OWNER_EMAIL, true),
        artifactId,
        db: db.asD1(),
        includeDeleted: true
      })
    ).toMatchObject({ ok: true, artifact: { deletedBy: EDITOR_EMAIL } });

    expect(db.artifactEventRows().map(({ event_type }) => event_type)).toEqual([
      "created",
      "regenerated",
      "report-save-requested",
      "report-save-approved",
      "saved-to-reports",
      "deleted"
    ]);
    expect(JSON.stringify(db.artifactEventRows())).not.toContain("TOP-SECRET");
    expect(JSON.stringify(db.artifactEventRows())).not.toContain("approved-safe report body");
  });

  test("applies actor visibility and deleted-row ACL before the page limit", async () => {
    const db = new SqliteArtifactListD1();
    const base = Math.floor(Date.now() / 1_000) - 1_000;
    try {
      expect(await listAdminAIArtifacts({ actor: actor(CREATOR_EMAIL), db: db.asD1() })).toEqual(
        []
      );
      db.seedArtifact({ creatorEmail: CREATOR_EMAIL, id: "victim-owned", updatedAt: base + 1 });
      db.seedArtifact({
        creatorEmail: STRANGER_EMAIL,
        id: "victim-viewer",
        updatedAt: base + 2,
        viewerEmails: [CREATOR_EMAIL]
      });
      db.seedArtifact({
        creatorEmail: STRANGER_EMAIL,
        editorEmails: [CREATOR_EMAIL],
        id: "victim-editor",
        updatedAt: base + 3
      });
      for (let index = 0; index < 100; index += 1) {
        db.seedArtifact({
          creatorEmail: STRANGER_EMAIL,
          id: `other-admin-${String(index).padStart(3, "0")}`,
          updatedAt: base + 100 + index
        });
      }
      db.seedArtifact({
        creatorEmail: CREATOR_EMAIL,
        deletedAt: base + 300,
        id: "victim-deleted",
        updatedAt: base + 300
      });

      expect(
        (
          await listAdminAIArtifacts({
            actor: actor(CREATOR_EMAIL),
            db: db.asD1(),
            includeDeleted: true
          })
        ).map(({ id }) => id)
      ).toEqual(["victim-editor", "victim-viewer", "victim-owned"]);

      const ownerActive = await listAdminAIArtifacts({
        actor: actor(OWNER_EMAIL, true),
        db: db.asD1()
      });
      expect(ownerActive).toHaveLength(100);
      expect(ownerActive.some(({ id }) => id === "victim-deleted")).toBe(false);

      const ownerWithDeleted = await listAdminAIArtifacts({
        actor: actor(OWNER_EMAIL, true),
        db: db.asD1(),
        includeDeleted: true
      });
      expect(ownerWithDeleted).toHaveLength(100);
      expect(ownerWithDeleted.some(({ id }) => id === "victim-deleted")).toBe(true);
    } finally {
      db.close();
    }
  });

  test("hides artifacts at the exact 90-day boundary before the purge job runs", async () => {
    const db = new SqliteArtifactListD1();
    const now = Math.floor(Date.now() / 1_000);
    const retentionSeconds = 90 * 24 * 60 * 60;
    try {
      expect(await listAdminAIArtifacts({ actor: actor(CREATOR_EMAIL), db: db.asD1() })).toEqual(
        []
      );
      db.seedArtifact({
        creatorEmail: CREATOR_EMAIL,
        id: "expired-at-boundary",
        updatedAt: now - retentionSeconds
      });
      db.seedArtifact({
        creatorEmail: CREATOR_EMAIL,
        id: "still-retained",
        updatedAt: now - retentionSeconds + 60
      });

      expect(
        (
          await listAdminAIArtifacts({
            actor: actor(CREATOR_EMAIL),
            db: db.asD1()
          })
        ).map(({ id }) => id)
      ).toEqual(["still-retained"]);
    } finally {
      db.close();
    }
  });

  test("rejects unsupported kinds, formats, ACL values, and unknown nested fields", () => {
    const valid = artifactCreateInput();
    expect(validateAdminAIArtifactCreateInput({ ...valid, kind: "dashboard" })).toMatchObject({
      ok: false
    });
    expect(validateAdminAIArtifactCreateInput({ ...valid, unexpected: true })).toMatchObject({
      ok: false
    });
    expect(
      validateAdminAIArtifactCreateInput({
        ...valid,
        sourceContext: { ...valid.sourceContext, secretPrompt: "do not persist" }
      })
    ).toMatchObject({ ok: false });
    expect(validateAdminAIArtifactCreateInput({ ...valid, exportFormats: ["pdf"] })).toMatchObject({
      ok: false
    });
    expect(
      validateAdminAIArtifactCreateInput({ ...valid, viewerEmails: ["not-an-email"] })
    ).toMatchObject({
      ok: false
    });
  });

  test("generates reusable drafts with immutable, versioned source context", async () => {
    const sourceContext = {
      module: "settings",
      referenceIds: ["config:admin-ai", "migration:v2"],
      requestId: "request-artifact-generator",
      scope: "section" as const
    };
    const generated = [
      generateAdminAIArtifactCreateInput({
        entries: [{ label: "Verify the protected route", status: "pending" }],
        kind: "checklist",
        sourceContext,
        title: "Admin verification checklist"
      }),
      generateAdminAIArtifactCreateInput({
        entries: [{ currentValue: "disabled", label: "Scheduled jobs", targetValue: "enabled" }],
        kind: "configuration-comparison",
        sourceContext,
        title: "Admin configuration comparison"
      }),
      generateAdminAIArtifactCreateInput({
        entries: [{ label: "Migrate owner policy", status: "complete" }],
        kind: "migration-checklist",
        sourceContext,
        title: "Admin migration checklist"
      })
    ];

    expect(generated.every((result) => result.ok)).toBe(true);
    expect(generated[0]).toMatchObject({ ok: true, input: { kind: "checklist" } });
    expect(generated[1]).toMatchObject({
      ok: true,
      input: {
        content: expect.stringContaining("| Scheduled jobs | disabled | enabled |"),
        kind: "configuration-comparison"
      }
    });
    expect(generated[2]).toMatchObject({
      ok: true,
      input: { content: expect.stringContaining("- [x] Migrate owner policy") }
    });

    const checklist = generated[0];
    if (!checklist.ok) throw new Error(checklist.error);
    const db = createDb();
    const created = await mutateAdminAIArtifact({
      actor: actor(CREATOR_EMAIL),
      db: db.asD1(),
      input: checklist.input
    });
    if (!created.ok) throw new Error(created.message);
    expect(created.artifact.sourceContext).toEqual(sourceContext);

    const regenerated = await mutateAdminAIArtifact({
      actor: actor(CREATOR_EMAIL),
      db: db.asD1(),
      input: {
        artifactId: created.artifact.id,
        content: "- [x] Verify the protected route",
        expectedVersion: 1,
        operation: "regenerate"
      }
    });
    expect(regenerated).toMatchObject({
      ok: true,
      artifact: { regenerationCount: 1, sourceContext, version: 2 }
    });
    expect(
      await mutateAdminAIArtifact({
        actor: actor(CREATOR_EMAIL),
        db: db.asD1(),
        input: {
          artifactId: created.artifact.id,
          content: "Stale regeneration must not win.",
          expectedVersion: 1,
          operation: "regenerate"
        }
      })
    ).toMatchObject({ code: "conflict", ok: false, status: 409 });
  });
});

test.describe("Admin AI artifact API protection", () => {
  test("requires authentication, CSRF, durable storage, and strict route fields", async () => {
    const unauthenticated = await handleAdminAIArtifacts({
      env: {},
      request: artifactRequest(null, { operation: "create" })
    });
    expect(unauthenticated.status).toBe(401);

    const db = createDb();
    const env = { ...authBase, ADMIN_DB: db.asD1() };
    const session = await createSession(CREATOR_EMAIL, env);
    const missingCsrf = await handleAdminAIArtifacts({
      env,
      request: artifactRequest({ ...session, csrfToken: "" }, { operation: "create" })
    });
    expect(missingCsrf.status).toBe(403);

    const noDbEnv = { ...authBase, ADMIN_REQUIRE_DB_ADMIN_ROLES: "false" };
    const noDbSession = await createSession(OWNER_EMAIL, noDbEnv);
    const unavailable = await handleAdminAIArtifacts({
      env: noDbEnv,
      request: artifactRequest(noDbSession, { operation: "create" })
    });
    expect(unavailable.status).toBe(503);

    const unknownField = await handleAdminAIArtifacts({
      env,
      request: artifactRequest(session, {
        ...artifactCreateInput(),
        operation: "create",
        unsafeExtra: true
      })
    });
    expect(unknownField.status).toBe(400);
  });
});

function artifactCreateInput() {
  return {
    content: "Bounded report content.",
    editorEmails: [EDITOR_EMAIL],
    exportFormats: ["md"],
    kind: "report",
    sourceContext: { module: "analytics", referenceIds: [], scope: "section" },
    title: "Analytics report",
    viewerEmails: [VIEWER_EMAIL]
  };
}

function actor(email: string, isOwner = false) {
  return { email, isOwner };
}

function createDb() {
  return new AdminAIPersistenceFakeD1([
    user(OWNER_EMAIL, true, "owner"),
    user(CREATOR_EMAIL),
    user(EDITOR_EMAIL),
    user(VIEWER_EMAIL),
    user(STRANGER_EMAIL)
  ]);
}

function user(email: string, isOwner = false, role = "admin") {
  return {
    email,
    first_name: "Artifact",
    is_owner: isOwner ? 1 : 0,
    last_name: isOwner ? "Owner" : "Admin",
    role,
    role_key: isOwner ? "owner" : "reports",
    status: "active"
  };
}

async function createSession(
  email: string,
  env: typeof authBase & { ADMIN_DB?: D1Database; ADMIN_REQUIRE_DB_ADMIN_ROLES?: string }
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    email,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true,
    source: "admin_auth"
  };
  const cookie = await createAdminSessionCookie({
    email,
    env,
    nowSeconds: now,
    rememberDevice: false,
    secure: false
  });
  const csrfToken = await createAdminCsrfToken({ env, session: payload });
  if (!cookie || !csrfToken) throw new Error("Expected artifact API session credentials.");
  return { cookie: cookie.split(";")[0], csrfToken };
}

function artifactRequest(
  session: { cookie: string; csrfToken: string } | null,
  body: Record<string, unknown>
) {
  return new Request("http://127.0.0.1:4802/api/admin/ai-artifacts", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1:4802",
      origin: "http://127.0.0.1:4802",
      ...(session ? { cookie: session.cookie } : {}),
      ...(session?.csrfToken ? { "x-yw-admin-csrf": session.csrfToken } : {})
    },
    method: "POST"
  });
}

type SeedArtifact = {
  creatorEmail: string;
  deletedAt?: number;
  editorEmails?: string[];
  id: string;
  updatedAt: number;
  viewerEmails?: string[];
};

class SqliteArtifactListD1 {
  private readonly database = new DatabaseSync(":memory:");

  asD1() {
    return this as unknown as D1Database;
  }

  close() {
    this.database.close();
  }

  prepare(sql: string) {
    return new SqliteArtifactStatement(this.database, sql);
  }

  seedArtifact({
    creatorEmail,
    deletedAt,
    editorEmails = [],
    id,
    updatedAt,
    viewerEmails = []
  }: SeedArtifact) {
    const iso = new Date(updatedAt * 1_000).toISOString();
    const artifact = {
      approval: {
        decidedAt: null,
        decidedBy: null,
        decisionReason: null,
        requestedAt: null,
        requestedBy: null,
        savedAt: null,
        savedBy: null,
        status: "not-requested"
      },
      content: `Content for ${id}`,
      copyable: { characterCount: id.length, enabled: true, mimeType: "text/markdown" },
      createdAt: iso,
      creatorEmail,
      deletedAt: deletedAt === undefined ? null : new Date(deletedAt * 1_000).toISOString(),
      deletedBy: deletedAt === undefined ? null : creatorEmail,
      editorEmails,
      exportFormats: ["md"],
      id,
      kind: "report",
      regeneratedAt: null,
      regenerationCount: 0,
      sourceContext: {
        module: "reports",
        referenceIds: [],
        requestId: null,
        scope: "section"
      },
      title: id,
      updatedAt: iso,
      version: 1,
      viewerEmails
    };
    this.database
      .prepare(
        `INSERT INTO admin_ai_artifacts (
          id, creator_email, state_json, version, created_at, updated_at, deleted_at, deleted_by
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .run(
        id,
        creatorEmail,
        JSON.stringify(artifact),
        1,
        updatedAt,
        updatedAt,
        deletedAt ?? null,
        deletedAt === undefined ? null : creatorEmail
      );
  }
}

class SqliteArtifactStatement {
  private params: SQLInputValue[] = [];

  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]) {
    this.params = params as SQLInputValue[];
    return this;
  }

  async all<T>() {
    const results = this.database.prepare(this.sql).all(...this.params) as T[];
    return { meta: {}, results, success: true } as D1Result<T>;
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.params);
    return {
      meta: { changes: Number(result.changes) },
      results: [],
      success: true
    } as unknown as D1Result<unknown>;
  }
}
