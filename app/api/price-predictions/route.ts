import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { aiMaterialRiskDailyTable, pricePredictionsTable } from "@/db/schema";
import { getRole, requireSession } from "@/lib/api/authz";
import { created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const predictionSchema = z.object({
  ingredientId: z.string().min(1).optional(),
  itemName: z.string().min(2).max(160),
  currentPrice: z.coerce.number().int().nonnegative(),
  predictedPrice: z.coerce.number().int().nonnegative(),
  changePercent: z.coerce.number(),
  risk: z.enum(["Rendah", "Sedang", "Tinggi"]),
  sourceName: z.string().min(2).max(160),
  sourceUrl: z.string().url(),
  summary: z.string().min(10),
  publishedAt: z.coerce.date().optional(),
});

type AiMaterialRiskDailyRow = typeof aiMaterialRiskDailyTable.$inferSelect;

function aiSummaryUrl(requestUrl: string) {
  return new URL("/api/ai/summary", requestUrl).toString();
}

function mapAiRiskToPrediction(row: AiMaterialRiskDailyRow, requestUrl: string) {
  return {
    id: row.id,
    ingredientId: row.ingredientId,
    itemName: row.itemName,
    currentPrice: row.currentPrice,
    predictedPrice: row.predictedPrice,
    changePercent: row.trendPercent,
    risk: row.risk,
    sourceName: `AI Material Risk Daily (${row.signalDate})`,
    sourceUrl: aiSummaryUrl(requestUrl),
    summary: row.reason,
    publishedAt: row.createdAt,
    signalDate: row.signalDate,
    riskScore: row.riskScore,
    sourceCount: row.sourceCount,
  };
}

async function getLatestAiPredictions(requestUrl: string) {
  const [latestAiRow] = await db
    .select({ signalDate: aiMaterialRiskDailyTable.signalDate })
    .from(aiMaterialRiskDailyTable)
    .orderBy(desc(aiMaterialRiskDailyTable.signalDate), desc(aiMaterialRiskDailyTable.createdAt))
    .limit(1);

  if (!latestAiRow) return [];

  const rows = await db
    .select()
    .from(aiMaterialRiskDailyTable)
    .where(eq(aiMaterialRiskDailyTable.signalDate, latestAiRow.signalDate))
    .orderBy(desc(aiMaterialRiskDailyTable.riskScore), desc(aiMaterialRiskDailyTable.createdAt))
    .limit(50);

  return rows.map((row) => mapAiRiskToPrediction(row, requestUrl));
}

async function getLegacyPredictions() {
  return db
    .select()
    .from(pricePredictionsTable)
    .orderBy(desc(pricePredictionsTable.createdAt))
    .limit(50);
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read price predictions");

    const aiRows = await getLatestAiPredictions(request.url);
    const rows = aiRows.length > 0 ? aiRows : await getLegacyPredictions();

    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 15, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can create price predictions");

    const { data: body, response } = await parseJsonBody(request, predictionSchema);
    if (response) return response;

    const [row] = await db
      .insert(pricePredictionsTable)
      .values({
        id: crypto.randomUUID(),
        ingredientId: body.ingredientId,
        itemName: body.itemName,
        currentPrice: body.currentPrice,
        predictedPrice: body.predictedPrice,
        changePercent: String(body.changePercent),
        risk: body.risk,
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
        summary: body.summary,
        publishedAt: body.publishedAt,
      })
      .returning();

    return created(row);
  } catch (error) {
    return serverError(error);
  }
}
