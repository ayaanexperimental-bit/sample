import { expect, test } from "@playwright/test";
import { onRequest as adminUsersRequest } from "../../functions/api/admin/users";
import { onRequest as verifyInviteRequest } from "../../functions/api/admin/users/invite/verify";
import {
  type AdminSessionPayload,
  createAdminCsrfToken,
  createAdminSessionCookie
} from "../../lib/server/admin-auth";

const OWNER_EMAIL = "owner@example.com";
const CREATOR_EMAIL = "creator@example.com";
const ADMIN_SESSION_SECRET = "local-admin-users-secret";

test.describe("admin user management RBAC", () => {
  test("allows only owner to manage admins and blocks duplicate active/pending entries", async () => {
    const dbHarness = createAdminUsersDb();
    const env = {
      ADMIN_ALLOWED_EMAILS: OWNER_EMAIL,
      ADMIN_DB: dbHarness.db,
      ADMIN_EMAIL_OTP_FROM: "admin@ywcoach.com",
      ADMIN_EMAIL_OTP_FROM_NAME: "YW Coach Admin",
      ADMIN_SESSION_SECRET,
      RESEND_API_KEY: "test-resend-key",
      ROOT_OWNER_EMAIL: OWNER_EMAIL
    };
    const { cookie, csrfToken } = await createAdminTestSession(env, OWNER_EMAIL);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || "{}")) as { text?: string };
      const inviteUrl = String(payload.text || "").match(/https?:\/\/\S+/)?.[0] || "";
      const token = new URL(inviteUrl).searchParams.get("token") || "";
      dbHarness.setLastInviteToken(token);
      return new Response(JSON.stringify({ id: "email-test" }), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    }) as typeof fetch;

    try {
      const list = await adminUsersRequest({
        env,
        request: new Request("https://ywcoach.com/api/admin/users", {
          headers: { cookie }
        })
      });
      expect(list.status).toBe(200);
      const listBody = await list.json();
      expect(listBody.admins).toHaveLength(1);
      expect(listBody.admins[0]).toMatchObject({
        email: OWNER_EMAIL,
        isOwner: true,
        roleKey: "owner"
      });
      expect(listBody.permissionDefinitions.length).toBeGreaterThan(8);

      const missingNameInvite = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          {
            action: "create_invite",
            invite: {
              email: "missing-name@example.com",
              firstName: "",
              lastName: "Admin",
              roleKey: "website_creator"
            }
          },
          { cookie, "x-yw-admin-csrf": csrfToken }
        )
      });
      expect(missingNameInvite.status).toBe(400);
      expect(await missingNameInvite.json()).toMatchObject({
        ok: false,
        error: "First name is required."
      });

      const createInvite = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          {
            action: "create_invite",
            invite: {
              email: CREATOR_EMAIL,
              firstName: "Creator",
              lastName: "Admin",
              permissions: [
                "overview.view",
                "website_creator.create",
                "coach_sites.view",
                "admin_users.manage",
                "security.strict_roles"
              ],
              roleKey: "website_creator"
            }
          },
          { cookie, "x-yw-admin-csrf": csrfToken }
        )
      });
      expect(createInvite.status).toBe(200);
      expect(await createInvite.json()).toMatchObject({
        ok: true,
        message: "Admin invite email sent."
      });
      expect(dbHarness.invites.size).toBe(1);
      expect(dbHarness.lastInviteToken).not.toContain(CREATOR_EMAIL);

      const duplicateInvite = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          {
            action: "create_invite",
            invite: {
              email: CREATOR_EMAIL,
              firstName: "Creator",
              lastName: "Admin",
              roleKey: "website_creator"
            }
          },
          { cookie, "x-yw-admin-csrf": csrfToken }
        )
      });
      expect(duplicateInvite.status).toBe(400);
      expect(await duplicateInvite.json()).toMatchObject({
        ok: false,
        error: "A pending invite already exists for this email."
      });

      const ownerSuspend = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          { action: "suspend_admin", email: OWNER_EMAIL },
          { cookie, "x-yw-admin-csrf": csrfToken },
          "PATCH"
        )
      });
      expect(ownerSuspend.status).toBe(403);
      expect(await ownerSuspend.json()).toMatchObject({
        ok: false,
        error: "The root owner account cannot be suspended or revoked."
      });

      const openInvite = await verifyInviteRequest({
        env,
        request: new Request(
          `https://ywcoach.com/api/admin/users/invite/verify?token=${encodeURIComponent(
            dbHarness.lastInviteToken
          )}`
        )
      });
      expect(openInvite.status).toBe(200);
      expect(await openInvite.text()).toContain("Accept admin invite");
      expect(dbHarness.adminUsers.get(CREATOR_EMAIL)?.status).toBeUndefined();

      const verifyInvite = await verifyInviteRequest({
        env,
        request: formRequest("https://ywcoach.com/api/admin/users/invite/verify", {
          token: dbHarness.lastInviteToken
        })
      });
      expect(verifyInvite.status).toBe(200);
      expect(dbHarness.adminUsers.get(CREATOR_EMAIL)?.status).toBe("active");
      expect(dbHarness.adminPermissions.get(CREATOR_EMAIL)).toEqual(
        expect.arrayContaining(["overview.view", "website_creator.create", "coach_sites.view"])
      );
      expect(dbHarness.adminPermissions.get(CREATOR_EMAIL)).not.toEqual(
        expect.arrayContaining(["admin_users.manage", "security.strict_roles"])
      );

      const creatorSession = await createAdminTestSession(env, CREATOR_EMAIL);
      const creatorList = await adminUsersRequest({
        env,
        request: new Request("https://ywcoach.com/api/admin/users", {
          headers: { cookie: creatorSession.cookie }
        })
      });
      expect(creatorList.status).toBe(403);
      expect(await creatorList.json()).toMatchObject({
        authenticated: true,
        authorized: false,
        error: "Access denied."
      });

      const duplicateActive = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          {
            action: "create_invite",
            invite: {
              email: CREATOR_EMAIL,
              firstName: "Creator",
              lastName: "Admin",
              roleKey: "analytics"
            }
          },
          { cookie, "x-yw-admin-csrf": csrfToken }
        )
      });
      expect(duplicateActive.status).toBe(400);
      expect(await duplicateActive.json()).toMatchObject({
        ok: false,
        error: "This admin is already active."
      });

      const suspendAdmin = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          { action: "suspend_admin", email: CREATOR_EMAIL },
          { cookie, "x-yw-admin-csrf": csrfToken },
          "PATCH"
        )
      });
      expect(suspendAdmin.status).toBe(200);
      expect(await suspendAdmin.json()).toMatchObject({
        admin: { email: CREATOR_EMAIL, status: "disabled", statusLabel: "Suspended" },
        ok: true
      });
      expect(dbHarness.adminUsers.get(CREATOR_EMAIL)?.status).toBe("disabled");

      const reactivateAdmin = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          { action: "reactivate_admin", email: CREATOR_EMAIL },
          { cookie, "x-yw-admin-csrf": csrfToken },
          "PATCH"
        )
      });
      expect(reactivateAdmin.status).toBe(200);
      expect(await reactivateAdmin.json()).toMatchObject({
        admin: { email: CREATOR_EMAIL, status: "active", statusLabel: "Active" },
        ok: true
      });
      expect(dbHarness.adminUsers.get(CREATOR_EMAIL)?.status).toBe("active");

      const deleteActiveAdmin = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          { action: "delete_admin", email: CREATOR_EMAIL },
          { cookie, "x-yw-admin-csrf": csrfToken },
          "PATCH"
        )
      });
      expect(deleteActiveAdmin.status).toBe(400);
      expect(await deleteActiveAdmin.json()).toMatchObject({
        error: "Only revoked admin users can be deleted.",
        ok: false
      });
      expect(dbHarness.adminUsers.has(CREATOR_EMAIL)).toBe(true);

      const revokeAdmin = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          { action: "revoke_admin", email: CREATOR_EMAIL },
          { cookie, "x-yw-admin-csrf": csrfToken },
          "PATCH"
        )
      });
      expect(revokeAdmin.status).toBe(200);
      expect(await revokeAdmin.json()).toMatchObject({
        admin: { email: CREATOR_EMAIL, status: "inactive", statusLabel: "Revoked" },
        ok: true
      });
      expect(dbHarness.adminUsers.get(CREATOR_EMAIL)?.status).toBe("inactive");

      const deleteRevokedAdmin = await adminUsersRequest({
        env,
        request: jsonRequest(
          "https://ywcoach.com/api/admin/users",
          { action: "delete_admin", email: CREATOR_EMAIL },
          { cookie, "x-yw-admin-csrf": csrfToken },
          "PATCH"
        )
      });
      expect(deleteRevokedAdmin.status).toBe(200);
      expect(await deleteRevokedAdmin.json()).toMatchObject({
        deletedAdmin: { email: CREATOR_EMAIL },
        ok: true,
        message: "Revoked admin permanently deleted."
      });
      expect(dbHarness.adminUsers.has(CREATOR_EMAIL)).toBe(false);
      expect(dbHarness.adminPermissions.get(CREATOR_EMAIL)).toEqual([]);
      expect(Array.from(dbHarness.invites.values()).some((invite) => invite.email === CREATOR_EMAIL)).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function createAdminUsersDb() {
  const adminUsers = new Map<string, Record<string, unknown>>([
    [
      OWNER_EMAIL,
      {
        backup_notifications_enabled: 1,
        created_at: 1,
        created_by: "test",
        email: OWNER_EMAIL,
        first_name: "Root",
        is_owner: 1,
        last_login_at: 0,
        last_name: "Owner",
        note: "",
        phone: "",
        receive_security_backup: 1,
        role: "owner",
        role_key: "owner",
        status: "active",
        updated_at: 1
      }
    ]
  ]);
  const adminPermissions = new Map<string, string[]>();
  const invites = new Map<string, Record<string, unknown>>();
  let lastInviteToken = "";

  const harness = {
    adminPermissions,
    adminUsers,
    db: {
      prepare(statement: string) {
        const prepared = createStatement(statement, [], harness);
        return {
          all: prepared.all,
          bind: (...values: unknown[]) => createStatement(statement, values, harness),
          first: prepared.first,
          run: prepared.run
        };
      }
    } as never,
    get lastInviteToken() {
      return lastInviteToken;
    },
    invites,
    setLastInviteToken(token: string) {
      lastInviteToken = token;
    }
  };

  return harness;
}

function createStatement(
  statement: string,
  values: unknown[],
  harness: ReturnType<typeof createAdminUsersDb>
) {
  return {
    all: async () => ({ results: handleAll(statement, values, harness) }),
    first: async () => handleFirst(statement, values, harness),
    run: async () => {
      handleRun(statement, values, harness);
      return { success: true };
    }
  };
}

function handleAll(statement: string, values: unknown[], harness: ReturnType<typeof createAdminUsersDb>) {
  if (statement.startsWith("PRAGMA table_info")) {
    return [
      "email",
      "role",
      "status",
      "created_at",
      "updated_at",
      "id",
      "first_name",
      "last_name",
      "phone",
      "note",
      "role_key",
      "is_owner",
      "created_by",
      "last_login_at",
      "last_verified_at",
      "backup_notifications_enabled",
      "receive_security_backup"
    ].map((name) => ({ name }));
  }
  if (statement.includes("FROM admin_users")) {
    return Array.from(harness.adminUsers.values());
  }
  if (statement.includes("FROM admin_invites")) {
    return Array.from(harness.invites.values());
  }
  if (statement.includes("FROM admin_user_permissions")) {
    const rows = Array.from(harness.adminPermissions.entries()).flatMap(([email, permissions]) =>
      permissions.map((permission) => ({
        admin_user_email: email,
        allowed: 1,
        permission_key: permission
      }))
    );
    if (statement.includes("WHERE admin_user_email")) {
      const email = String(values[0] || "");
      return rows.filter((row) => row.admin_user_email === email);
    }
    return rows;
  }
  return [];
}

function handleFirst(
  statement: string,
  values: unknown[],
  harness: ReturnType<typeof createAdminUsersDb>
) {
  if (statement.includes("COUNT(*) AS count") && statement.includes("FROM admin_invites")) {
    const actorEmail = String(values[0] || "").toLowerCase();
    const windowStart = Number(values[1] || 0);
    return {
      count: Array.from(harness.invites.values()).filter(
        (invite) => invite.created_by === actorEmail && Number(invite.created_at || 0) >= windowStart
      ).length
    };
  }
  if (statement.includes("FROM admin_users WHERE role = 'owner'")) {
    return harness.adminUsers.get(OWNER_EMAIL) || null;
  }
  if (statement.includes("FROM admin_users") && statement.includes("WHERE email")) {
    return harness.adminUsers.get(String(values[0] || "").toLowerCase()) || null;
  }
  if (statement.includes("FROM admin_invites") && statement.includes("invite_token_hash")) {
    return (
      Array.from(harness.invites.values()).find(
        (invite) => invite.invite_token_hash === values[0]
      ) || null
    );
  }
  if (statement.includes("FROM admin_invites") && statement.includes("email")) {
    return (
      Array.from(harness.invites.values()).find(
        (invite) =>
          invite.email === String(values[0] || "").toLowerCase() &&
          ["pending_send", "sent", "delivered", "pending_verification"].includes(
            String(invite.status)
          )
      ) || null
    );
  }
  return null;
}

function handleRun(
  statement: string,
  values: unknown[],
  harness: ReturnType<typeof createAdminUsersDb>
) {
  if (statement.includes("INSERT INTO admin_invites")) {
    const [
      id,
      email,
      firstName,
      lastName,
      phone,
      note,
      tokenHash,
      rolePayload,
      permissionPayload,
      expiresAt,
      createdBy,
      createdAt
    ] = values;
    harness.invites.set(String(id), {
      created_at: Number(createdAt),
      created_by: String(createdBy),
      email: String(email),
      expires_at: Number(expiresAt),
      first_name: String(firstName || ""),
      id: String(id),
      invite_token_hash: String(tokenHash),
      last_name: String(lastName || ""),
      note: String(note || ""),
      permission_payload: String(permissionPayload),
      phone: String(phone || ""),
      resend_count: 0,
      role_payload: String(rolePayload),
      sent_at: 0,
      status: "pending_send",
      updated_at: Number(createdAt),
      verified_at: 0
    });
    return;
  }
  if (statement.includes("UPDATE admin_invites") && statement.includes("sent_at")) {
    const invite = harness.invites.get(String(values[2]));
    if (invite) {
      invite.status = String(values[0]);
      invite.sent_at = Number(values[1]);
      invite.updated_at = Number(values[1]);
    }
    return;
  }
  if (statement.includes("UPDATE admin_invites SET status = 'active'")) {
    const invite = harness.invites.get(String(values[1]));
    if (invite) {
      invite.status = "active";
      invite.verified_at = Number(values[0]);
      invite.updated_at = Number(values[0]);
    }
    return;
  }
  if (statement.includes("INSERT INTO admin_users")) {
    const [email, timestamp, firstName, lastName, phone, note, roleKey, createdBy] = values;
    harness.adminUsers.set(String(email), {
      backup_notifications_enabled: 1,
      created_at: Number(timestamp),
      created_by: String(createdBy),
      email: String(email),
      first_name: String(firstName || ""),
      is_owner: 0,
      last_login_at: 0,
      last_name: String(lastName || ""),
      note: String(note || ""),
      phone: String(phone || ""),
      receive_security_backup: 0,
      role: "admin",
      role_key: String(roleKey),
      status: "active",
      updated_at: Number(timestamp)
    });
    return;
  }
  if (statement.includes("UPDATE admin_users SET status")) {
    const admin = harness.adminUsers.get(String(values[2] || "").toLowerCase());
    if (admin) {
      admin.status = String(values[0]);
      admin.updated_at = Number(values[1]);
    }
    return;
  }
  if (statement.includes("DELETE FROM admin_user_permissions")) {
    harness.adminPermissions.set(String(values[0]), []);
    return;
  }
  if (statement.includes("DELETE FROM admin_invites")) {
    const email = String(values[0] || "").toLowerCase();
    for (const [id, invite] of harness.invites.entries()) {
      if (String(invite.email || "").toLowerCase() === email) harness.invites.delete(id);
    }
    return;
  }
  if (statement.includes("DELETE FROM admin_users")) {
    harness.adminUsers.delete(String(values[0] || "").toLowerCase());
    return;
  }
  if (statement.includes("admin_user_permissions") && statement.includes("VALUES")) {
    const email = String(values[1]);
    const permission = String(values[2]);
    harness.adminPermissions.set(email, [...(harness.adminPermissions.get(email) || []), permission]);
  }
}

async function createAdminTestSession(
  env: {
    ADMIN_ALLOWED_EMAILS: string;
    ADMIN_DB: never;
    ADMIN_SESSION_SECRET: string;
    ROOT_OWNER_EMAIL: string;
  },
  email: string
) {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSessionPayload = {
    email,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true,
    source: "admin_auth"
  };
  const sessionCookie = await createAdminSessionCookie({
    email,
    env,
    nowSeconds: now,
    rememberDevice: false,
    secure: true
  });
  const csrfToken = await createAdminCsrfToken({ env, session });

  if (!sessionCookie || !csrfToken) throw new Error("Expected admin session credentials.");
  return {
    cookie: sessionCookie.split(";")[0],
    csrfToken
  };
}

function jsonRequest(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  method: "PATCH" | "POST" = "POST"
) {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: new URL(url).host,
      ...headers
    },
    method
  });
}

function formRequest(url: string, body: Record<string, string>) {
  return new Request(url, {
    body: new URLSearchParams(body),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      host: new URL(url).host
    },
    method: "POST"
  });
}
