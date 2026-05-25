import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiMaterialRiskDailyTable } from "@/db/schema";
import { runAiPipeline, readAiSummaryForOwner } from "@/lib/ai/pipeline";
import { getRole, requireSession } from "@/lib/api/authz";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read AI summary");

    const latestToday = await db
      .select()
      .from(aiMaterialRiskDailyTable)
      .where(eq(aiMaterialRiskDailyTable.signalDate, todayKey()))
      .orderBy(desc(aiMaterialRiskDailyTable.createdAt))
      .limit(1);

    if (!latestToday.length) {
      await runAiPipeline();
    }

    return ok(await readAiSummaryForOwner());
  } catch (error) {
    return serverError(error);
  }
}
