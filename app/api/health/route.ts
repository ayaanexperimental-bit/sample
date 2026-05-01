import { NextResponse } from "next/server";
import { getDatabaseConfig } from "@/lib/db/config";

export function GET() {
  const database = getDatabaseConfig();

  return NextResponse.json({
    ok: true,
    service: "women-health-masterclass-101",
    databaseConfigured: database.isConfigured,
    timestamp: new Date().toISOString()
  });
}
