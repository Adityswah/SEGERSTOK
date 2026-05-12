import { sql } from "drizzle-orm";

import { db } from "@/db";
import { ok, serverError } from "@/lib/api/responses";

export async function GET() {
  try {
    const startedAt = Date.now();
    await db.execute(sql`select 1`);

    return ok({
      status: "ok",
      database: "postgres",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return serverError(error);
  }
}
