import { desc } from "drizzle-orm";

import { db } from "@/db";
import { aiPipelineRunsTable } from "@/db/schema";
import { ok, serverError } from "@/lib/api/responses";

export async function GET() {
  try {
    const [latestRun] = await db.select().from(aiPipelineRunsTable).orderBy(desc(aiPipelineRunsTable.startedAt)).limit(1);
    const latestStartedAt = latestRun?.startedAt ? new Date(latestRun.startedAt) : null;
    const isStale =
      latestStartedAt !== null && Date.now() - latestStartedAt.getTime() > 90 * 60 * 1000;
    const derivedStatus =
      !latestRun ? "unknown" : latestRun.status === "failed" || isStale ? "stale" : latestRun.status;

    return ok({
      status: derivedStatus,
      latestRun,
      stale: isStale,
      now: new Date().toISOString(),
      monitorHint: "Use this endpoint for uptime/alerting checks every 5-15 minutes. Status becomes stale if no refresh succeeds in 90 minutes.",
    });
  } catch (error) {
    return serverError(error);
  }
}
