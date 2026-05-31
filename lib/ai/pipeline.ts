import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiBuyRecommendationsTable,
  aiMaterialRiskDailyTable,
  aiPipelineRunsTable,
  aiSourceSignalsTable,
  aiWeeklyStockProjectionsTable,
  ingredientsTable,
  stockTransactionsTable,
} from "@/db/schema";

type RiskLevel = "Rendah" | "Sedang" | "Tinggi";
type RecommendationAction = "beli-sekarang" | "beli-bertahap" | "tunda-beli";

type PipelineMetrics = {
  ingestedSignals: number;
  generatedRisks: number;
  generatedProjections: number;
  generatedRecommendations: number;
  failedFeeds: number;
  purgedSignals: number;
  purgedRuns: number;
  purgedRisks: number;
  purgedProjections: number;
  purgedRecommendations: number;
};

type MaterialRiskRow = {
  itemName: string;
  ingredientId: string | null;
  signalDate: string;
  riskScore: number;
  risk: RiskLevel;
  trendPercent: number;
  currentPrice: number;
  predictedPrice: number;
  sourceCount: number;
  reason: string;
};

type ProjectionRow = {
  ingredientId: string;
  itemName: string;
  weekStart: string;
  weekEnd: string;
  currentStock: number;
  predictedWeeklyUsage: number;
  predictedEndingStock: number;
  stockCoverDays: number;
  riskBoostPercent: number;
};

type RecommendationRow = {
  ingredientId: string;
  recommendationDate: string;
  action: RecommendationAction;
  recommendedQuantity: number;
  priorityScore: number;
  explanation: string;
};

const JAKARTA_TIME_ZONE = "Asia/Jakarta";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SIGNAL_RETENTION_DAYS = 7;
const RUN_RETENTION_DAYS = 30;
const RISK_RETENTION_DAYS = 30;
const PROJECTION_RETENTION_DAYS = 30;
const RECOMMENDATION_RETENTION_DAYS = 30;

function nowDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildWeeklyProjections(
  ingredients: Array<typeof ingredientsTable.$inferSelect>,
  usageRows: Array<typeof stockTransactionsTable.$inferSelect>,
  riskByIngredientId: Map<string, MaterialRiskRow>,
  weekStart: string,
  weekEnd: string,
) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_IN_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_IN_MS);

  return ingredients.map((ingredient): ProjectionRow => {
    const rows = usageRows.filter((item) => item.ingredientId === ingredient.id && item.type === "keluar");
    const usage28 = rows.reduce((sum, item) => sum + toNumber(item.quantity), 0);
    const usage7 = rows
      .filter((item) => new Date(item.transactionDate) >= sevenDaysAgo)
      .reduce((sum, item) => sum + toNumber(item.quantity), 0);
    const usagePrev7 = rows
      .filter((item) => {
        const date = new Date(item.transactionDate);
        return date >= fourteenDaysAgo && date < sevenDaysAgo;
      })
      .reduce((sum, item) => sum + toNumber(item.quantity), 0);

    const dailyBase = usage28 > 0 ? usage28 / 28 : toNumber(ingredient.minimumStock) / 7;
    const momentumRaw = usagePrev7 > 0 ? usage7 / usagePrev7 : 1;
    const momentum = clamp(momentumRaw, 0.75, 1.4);
    const risk = riskByIngredientId.get(ingredient.id);
    const riskBoostPercent = risk?.risk === "Tinggi" ? 12 : risk?.risk === "Sedang" ? 6 : 0;
    const predictedWeeklyUsage = dailyBase * 7 * momentum * (1 + riskBoostPercent / 100);
    const currentStock = toNumber(ingredient.stock);
    const predictedEndingStock = currentStock - predictedWeeklyUsage;
    const stockCoverDays = dailyBase > 0 ? currentStock / (dailyBase * momentum) : 30;

    return {
      ingredientId: ingredient.id,
      itemName: ingredient.name,
      weekStart,
      weekEnd,
      currentStock: Number(currentStock.toFixed(2)),
      predictedWeeklyUsage: Number(predictedWeeklyUsage.toFixed(2)),
      predictedEndingStock: Number(predictedEndingStock.toFixed(2)),
      stockCoverDays: Number(stockCoverDays.toFixed(2)),
      riskBoostPercent,
    };
  });
}

async function persistWeeklyProjections(projections: ProjectionRow[]) {
  let affected = 0;
  for (const projection of projections) {
    const [row] = await db
      .insert(aiWeeklyStockProjectionsTable)
      .values({
        id: crypto.randomUUID(),
        ingredientId: projection.ingredientId,
        weekStart: projection.weekStart,
        weekEnd: projection.weekEnd,
        currentStock: projection.currentStock.toFixed(2),
        predictedWeeklyUsage: projection.predictedWeeklyUsage.toFixed(2),
        predictedEndingStock: projection.predictedEndingStock.toFixed(2),
        stockCoverDays: projection.stockCoverDays.toFixed(2),
        riskBoostPercent: projection.riskBoostPercent.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [aiWeeklyStockProjectionsTable.ingredientId, aiWeeklyStockProjectionsTable.weekStart],
        set: {
          weekEnd: projection.weekEnd,
          currentStock: projection.currentStock.toFixed(2),
          predictedWeeklyUsage: projection.predictedWeeklyUsage.toFixed(2),
          predictedEndingStock: projection.predictedEndingStock.toFixed(2),
          stockCoverDays: projection.stockCoverDays.toFixed(2),
          riskBoostPercent: projection.riskBoostPercent.toFixed(2),
          createdAt: new Date(),
        },
      })
      .returning({ id: aiWeeklyStockProjectionsTable.id });
    if (row?.id) affected += 1;
  }
  return affected;
}

function buildRecommendations(
  projections: ProjectionRow[],
  ingredients: Array<typeof ingredientsTable.$inferSelect>,
  recommendationDate: string,
) {
  const ingredientById = new Map(ingredients.map((item) => [item.id, item] as const));

  return projections.map((projection): RecommendationRow => {
    const ingredient = ingredientById.get(projection.ingredientId);
    const minimumStock = ingredient ? toNumber(ingredient.minimumStock) : 0;
    const dailyNeed = projection.predictedWeeklyUsage / 7;
    const targetDays = projection.riskBoostPercent >= 12 ? 10 : projection.riskBoostPercent >= 6 ? 8 : 7;
    const targetStock = dailyNeed * targetDays;
    const recommendedQuantity = Math.max(0, targetStock - projection.currentStock);

    let action: RecommendationAction = "tunda-beli";
    if (recommendedQuantity > 0 && (projection.stockCoverDays < 4 || projection.predictedEndingStock < minimumStock)) {
      action = "beli-sekarang";
    } else if (recommendedQuantity > 0 && projection.stockCoverDays < 8) {
      action = "beli-bertahap";
    }

    const priorityScore = Math.round(
      clamp(
        (projection.stockCoverDays < 4 ? 40 : 15) +
          (projection.riskBoostPercent >= 12 ? 35 : projection.riskBoostPercent >= 6 ? 22 : 10) +
          (projection.predictedEndingStock < minimumStock ? 30 : 5),
        0,
        100,
      ),
    );

    return {
      ingredientId: projection.ingredientId,
      recommendationDate,
      action,
      recommendedQuantity: Number(recommendedQuantity.toFixed(2)),
      priorityScore,
      explanation:
        action === "beli-sekarang"
          ? "Stok cover rendah; prioritas beli hari ini."
          : action === "beli-bertahap"
            ? "Stok masih aman terbatas; lakukan pembelian bertahap untuk mengurangi risiko stok kosong."
            : "Stok dan proyeksi masih aman; pembelian dapat ditunda sambil monitoring.",
    };
  });
}

async function persistRecommendations(recommendations: RecommendationRow[]) {
  let affected = 0;
  for (const recommendation of recommendations) {
    const [row] = await db
      .insert(aiBuyRecommendationsTable)
      .values({
        id: crypto.randomUUID(),
        ingredientId: recommendation.ingredientId,
        recommendationDate: recommendation.recommendationDate,
        action: recommendation.action,
        recommendedQuantity: recommendation.recommendedQuantity.toFixed(2),
        priorityScore: recommendation.priorityScore,
        explanation: recommendation.explanation,
      })
      .onConflictDoUpdate({
        target: [aiBuyRecommendationsTable.ingredientId, aiBuyRecommendationsTable.recommendationDate],
        set: {
          action: recommendation.action,
          recommendedQuantity: recommendation.recommendedQuantity.toFixed(2),
          priorityScore: recommendation.priorityScore,
          explanation: recommendation.explanation,
          createdAt: new Date(),
        },
      })
      .returning({ id: aiBuyRecommendationsTable.id });
    if (row?.id) affected += 1;
  }
  return affected;
}

async function recordRunStart(runType: string) {
  const [run] = await db
    .insert(aiPipelineRunsTable)
    .values({
      id: crypto.randomUUID(),
      runType,
      status: "success",
      startedAt: new Date(),
    })
    .returning({ id: aiPipelineRunsTable.id });

  return run.id;
}

async function recordRunFinish(
  runId: string,
  status: "success" | "partial" | "failed",
  metrics: PipelineMetrics,
  errorMessage?: string,
) {
  await db
    .update(aiPipelineRunsTable)
    .set({
      status,
      finishedAt: new Date(),
      metricsJson: JSON.stringify(metrics),
      errorMessage: errorMessage?.slice(0, 1200) ?? null,
    })
    .where(eq(aiPipelineRunsTable.id, runId));
}

export async function runAiPipeline() {
  const runId = await recordRunStart("full-refresh");
  const metrics: PipelineMetrics = {
    ingestedSignals: 0,
    generatedRisks: 0,
    generatedProjections: 0,
    generatedRecommendations: 0,
    failedFeeds: 0,
    purgedSignals: 0,
    purgedRuns: 0,
    purgedRisks: 0,
    purgedProjections: 0,
    purgedRecommendations: 0,
  };

  try {
    const todayKey = nowDateKey();
    const weekStartDate = new Date();
    const weekEndDate = new Date(weekStartDate.getTime() + 6 * DAY_IN_MS);
    const weekStart = nowDateKey(weekStartDate);
    const weekEnd = nowDateKey(weekEndDate);

    const ingredients = await db.select().from(ingredientsTable).where(sql`${ingredientsTable.active} = true`);

    // Pipeline dibuat ringan: AI hanya memakai data internal untuk proyeksi mingguan dan rekomendasi waktu beli.
    const riskMap = new Map<string, MaterialRiskRow>();

    const usageRows = await db
      .select()
      .from(stockTransactionsTable)
      .where(
        and(
          eq(stockTransactionsTable.type, "keluar"),
          gte(stockTransactionsTable.transactionDate, new Date(Date.now() - 28 * DAY_IN_MS)),
        ),
      )
      .orderBy(desc(stockTransactionsTable.transactionDate));

    const projections = buildWeeklyProjections(ingredients, usageRows, riskMap, weekStart, weekEnd);
    metrics.generatedProjections = await persistWeeklyProjections(projections);

    const recommendations = buildRecommendations(projections, ingredients, todayKey);
    metrics.generatedRecommendations = await persistRecommendations(recommendations);

    const signalCutoff = new Date(Date.now() - SIGNAL_RETENTION_DAYS * DAY_IN_MS);
    const runCutoff = new Date(Date.now() - RUN_RETENTION_DAYS * DAY_IN_MS);
    const purgedSignals = await db
      .delete(aiSourceSignalsTable)
      .where(lt(aiSourceSignalsTable.publishedAt, signalCutoff))
      .returning({ id: aiSourceSignalsTable.id });
    const purgedRuns = await db
      .delete(aiPipelineRunsTable)
      .where(lt(aiPipelineRunsTable.startedAt, runCutoff))
      .returning({ id: aiPipelineRunsTable.id });
    const purgedRisks = await db
      .delete(aiMaterialRiskDailyTable)
      .where(
        lt(
          aiMaterialRiskDailyTable.signalDate,
          nowDateKey(new Date(Date.now() - RISK_RETENTION_DAYS * DAY_IN_MS)),
        ),
      )
      .returning({ id: aiMaterialRiskDailyTable.id });
    const purgedProjections = await db
      .delete(aiWeeklyStockProjectionsTable)
      .where(
        lt(
          aiWeeklyStockProjectionsTable.weekStart,
          nowDateKey(new Date(Date.now() - PROJECTION_RETENTION_DAYS * DAY_IN_MS)),
        ),
      )
      .returning({ id: aiWeeklyStockProjectionsTable.id });
    const purgedRecommendations = await db
      .delete(aiBuyRecommendationsTable)
      .where(
        lt(
          aiBuyRecommendationsTable.recommendationDate,
          nowDateKey(new Date(Date.now() - RECOMMENDATION_RETENTION_DAYS * DAY_IN_MS)),
        ),
      )
      .returning({ id: aiBuyRecommendationsTable.id });
    metrics.purgedSignals = purgedSignals.length;
    metrics.purgedRuns = purgedRuns.length;
    metrics.purgedRisks = purgedRisks.length;
    metrics.purgedProjections = purgedProjections.length;
    metrics.purgedRecommendations = purgedRecommendations.length;

    const status: "success" | "partial" = "success";
    await recordRunFinish(runId, status, metrics);

    return { status, metrics };
  } catch (error) {
    await recordRunFinish(
      runId,
      "failed",
      metrics,
      error instanceof Error ? error.message : "Unknown pipeline error",
    );
    throw error;
  }
}

export async function readAiSummaryForOwner() {
  const todayKey = nowDateKey();
  const [projections, recommendations, latestRun] = await Promise.all([
    db
      .select()
      .from(aiWeeklyStockProjectionsTable)
      .orderBy(desc(aiWeeklyStockProjectionsTable.createdAt))
      .limit(24),
    db
      .select()
      .from(aiBuyRecommendationsTable)
      .where(eq(aiBuyRecommendationsTable.recommendationDate, todayKey))
      .orderBy(desc(aiBuyRecommendationsTable.priorityScore))
      .limit(24),
    db.select().from(aiPipelineRunsTable).orderBy(desc(aiPipelineRunsTable.startedAt)).limit(1),
  ]);

  const ingredientIds = Array.from(
    new Set([
      ...recommendations.map((item) => item.ingredientId),
      ...projections.map((item) => item.ingredientId),
    ]),
  );
  const ingredients =
    ingredientIds.length > 0
      ? await db
          .select({
            id: ingredientsTable.id,
            name: ingredientsTable.name,
            unit: ingredientsTable.unit,
          })
          .from(ingredientsTable)
          .where(inArray(ingredientsTable.id, ingredientIds))
      : [];

  const ingredientById = new Map(ingredients.map((item) => [item.id, item] as const));

  return {
    asOf: todayKey,
    latestRun: latestRun[0] ?? null,
    risks: [],
    projections: projections.map((item) => ({
      ...item,
      ingredientName: ingredientById.get(item.ingredientId)?.name ?? item.ingredientId,
      ingredientUnit: ingredientById.get(item.ingredientId)?.unit ?? "",
    })),
    recommendations: recommendations.map((item) => ({
      ...item,
      ingredientName: ingredientById.get(item.ingredientId)?.name ?? item.ingredientId,
      ingredientUnit: ingredientById.get(item.ingredientId)?.unit ?? "",
    })),
  };
}

const BOT_QUERY_STOPWORDS = new Set([
  "ada",
  "akan",
  "apa",
  "apakah",
  "atau",
  "bahan",
  "baku",
  "beli",
  "berapa",
  "besok",
  "bisa",
  "cari",
  "carikan",
  "data",
  "dari",
  "dengan",
  "harga",
  "harganya",
  "ini",
  "kalau",
  "kira",
  "mau",
  "membeli",
  "prediksi",
  "saya",
  "sisa",
  "stock",
  "stok",
  "terbaru",
  "untuk",
  "yang",
]);

function botIngredientTokens(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !BOT_QUERY_STOPWORDS.has(token)),
    ),
  ).slice(0, 6);
}

export async function searchIngredientsForBot(query: string) {
  const tokens = botIngredientTokens(query);
  if (!tokens.length) return [];

  const nameMatches = tokens.map((token) => ilike(ingredientsTable.name, `%${token}%`));
  return db
    .select({
      id: ingredientsTable.id,
      name: ingredientsTable.name,
      unit: ingredientsTable.unit,
      stock: ingredientsTable.stock,
      minimumStock: ingredientsTable.minimumStock,
    })
    .from(ingredientsTable)
    .where(and(eq(ingredientsTable.active, true), or(...nameMatches)))
    .limit(8);
}
