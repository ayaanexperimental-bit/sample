import { NextRequest, NextResponse } from "next/server";
import { getDatabaseConfig } from "@/lib/db/config";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { getClientIp } from "@/lib/http/request";
import { validateLeadInput } from "@/lib/leads/validation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `lead:${getClientIp(request)}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many lead submissions. Please try again later."
      },
      { status: 429 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Invalid JSON body."] }, { status: 400 });
  }

  const validation = validateLeadInput(body);

  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 400 });
  }

  const database = getDatabaseConfig();

  if (!database.isConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "Lead capture is not connected to a database yet.",
        acceptedFields: validation.data
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Database persistence is pending migration-tool and DB-provider setup."
    },
    { status: 501 }
  );
}
