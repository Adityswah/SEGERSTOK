import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";

import { db } from "@/db";
import {
  aiBuyRecommendationsTable,
  aiMaterialRiskDailyTable,
  aiPipelineRunsTable,
  aiSourceSignalsTable,
  aiWeeklyStockProjectionsTable,
  ingredientsTable,
  pricePredictionsTable,
  stockTransactionsTable,
} from "@/db/schema";
import { priceForecast, priceNews } from "@/lib/data";

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

type FeedSignal = {
  sourceType: "government" | "news";
  sourceName: string;
  sourceUrl: string;
  headline: string;
  summary: string;
  commodityTags: string;
  publishedAt: Date;
  signalScore: number;
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

type PricePredictionInput = {
  ingredientId: string | null;
  itemName: string;
  currentPrice: number;
  predictedPrice: number;
  changePercent: string | number;
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

function parseIndonesianDate(raw: string) {
  const normalized = raw.trim().toLowerCase();
  const months: Record<string, number> = {
    januari: 0,
    februari: 1,
    maret: 2,
    april: 3,
    mei: 4,
    juni: 5,
    juli: 6,
    agustus: 7,
    september: 8,
    oktober: 9,
    november: 10,
    desember: 11,
  };

  const match = normalized.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = months[match[2]];
  const year = Number(match[3]);
  if (month === undefined) return null;

  const date = new Date(Date.UTC(year, month, day, 5, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function riskFromScore(score: number): RiskLevel {
  if (score >= 70) return "Tinggi";
  if (score >= 45) return "Sedang";
  return "Rendah";
}

function normalizeName(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function hashSignal(signal: FeedSignal) {
  const value = `${signal.sourceName}|${signal.sourceUrl}|${signal.headline}|${signal.publishedAt.toISOString()}`;
  return createHash("sha256").update(value).digest("hex");
}

function pickSignalScore(text: string) {
  const normalized = normalizeName(text);
  let score = 40;
  if (normalized.includes("naik") || normalized.includes("melonjak") || normalized.includes("meroket")) score += 22;
  if (normalized.includes("pasokan") || normalized.includes("gagal panen") || normalized.includes("cuaca")) score += 12;
  if (normalized.includes("impor") || normalized.includes("distribusi")) score += 10;
  return clamp(score, 20, 95);
}

function parseRssItems(rawXml: string, sourceUrl: string): FeedSignal[] {
  const sourceName = new URL(sourceUrl).hostname.replace(/^www\./, "");
  const itemMatches = [...rawXml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 25);
  const signals: FeedSignal[] = [];
  for (const match of itemMatches) {
      const block = match[1] ?? "";
      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? sourceUrl;
      const description =
        block.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
      const pubDateRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
      if (!title) continue;
      const publishedAt = pubDateRaw ? new Date(pubDateRaw) : new Date();
      signals.push({
        sourceType: "news" as const,
        sourceName,
        sourceUrl: link,
        headline: title,
        summary: description || title,
        commodityTags: "",
        publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        signalScore: pickSignalScore(`${title} ${description}`),
      });
  }
  return signals;
}

async function loadExternalFeedSignals(): Promise<{ signals: FeedSignal[]; failedFeeds: number }> {
  const feedUrls = (process.env.AI_NEWS_FEED_URLS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!feedUrls.length) return { signals: [], failedFeeds: 0 };

  let failedFeeds = 0;
  const feeds = await Promise.all(
    feedUrls.map(async (feedUrl) => {
      try {
        const response = await fetch(feedUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Feed ${feedUrl} failed with ${response.status}`);
        const rawXml = await response.text();
        return parseRssItems(rawXml, feedUrl);
      } catch {
        failedFeeds += 1;
        return [];
      }
    }),
  );

  return { signals: feeds.flat(), failedFeeds };
}

function buildStaticSignals(): FeedSignal[] {
  return priceNews.map((news) => ({
    sourceType: news.source.toLowerCase().includes("pihps") ? "government" : "news",
    sourceName: news.source,
    sourceUrl: news.url,
    headline: news.title,
    summary: news.summary,
    commodityTags: news.commodity,
    publishedAt: parseIndonesianDate(news.date) ?? new Date(),
    signalScore: pickSignalScore(`${news.title} ${news.summary}`),
  }));
}

async function persistSignals(signals: FeedSignal[]) {
  if (!signals.length) return 0;

  let inserted = 0;
  for (const signal of signals) {
    const contentHash = hashSignal(signal);
    const [row] = await db
      .insert(aiSourceSignalsTable)
      .values({
        id: crypto.randomUUID(),
        sourceType: signal.sourceType,
        sourceName: signal.sourceName,
        sourceUrl: signal.sourceUrl,
        headline: signal.headline.slice(0, 280),
        summary: signal.summary,
        commodityTags: signal.commodityTags.slice(0, 800),
        signalScore: signal.signalScore,
        publishedAt: signal.publishedAt,
        contentHash,
      })
      .onConflictDoNothing({
        target: aiSourceSignalsTable.contentHash,
      })
      .returning({ id: aiSourceSignalsTable.id });

    if (row?.id) inserted += 1;
  }

  return inserted;
}

function buildMaterialRisks(
  ingredients: Array<typeof ingredientsTable.$inferSelect>,
  predictions: PricePredictionInput[],
  recentSignals: Array<typeof aiSourceSignalsTable.$inferSelect>,
  signalDate: string,
) {
  const ingredientsByNormalized = new Map(
    ingredients.map((item) => [normalizeName(item.name), item.id] as const),
  );

  return predictions.map((prediction): MaterialRiskRow => {
    const normalizedItem = normalizeName(prediction.itemName);
    const predictionPercent = toNumber(prediction.changePercent);
    const signalHits = recentSignals.filter((signal) => {
      const haystack = normalizeName(`${signal.headline} ${signal.summary} ${signal.commodityTags}`);
      return normalizedItem.split(" ").some((word) => word.length > 2 && haystack.includes(word));
    });

    const signalAverage =
      signalHits.length > 0
        ? signalHits.reduce((sum, signal) => sum + signal.signalScore, 0) / signalHits.length
        : 45;
    const baseScore = toNumber(predictionPercent) * 6.5 + signalAverage * 0.55;
    const riskScore = Math.round(clamp(baseScore, 0, 100));
    const risk = riskFromScore(riskScore);
    const predictedPrice =
      prediction.predictedPrice > 0
        ? prediction.predictedPrice
        : Math.round(prediction.currentPrice * (1 + clamp(predictionPercent, 0, 25) / 100));

    return {
      itemName: prediction.itemName,
      ingredientId: ingredientsByNormalized.get(normalizedItem) ?? prediction.ingredientId ?? null,
      signalDate,
      riskScore,
      risk,
      trendPercent: Number(predictionPercent.toFixed(2)),
      currentPrice: prediction.currentPrice,
      predictedPrice,
      sourceCount: signalHits.length,
      reason: signalHits.length
        ? `${signalHits.length} sinyal berita/pemerintah relevan dalam 7 hari terakhir`
        : "Belum ada sinyal kuat; gunakan baseline prediksi harga",
    };
  });
}

function buildFallbackPredictions(): PricePredictionInput[] {
  return priceForecast.map((item) => ({
    ingredientId: null,
    itemName: item.item,
    currentPrice: item.current,
    predictedPrice: item.next,
    changePercent: item.change.replace("%", "").replace("+", ""),
  }));
}

async function persistMaterialRisks(risks: MaterialRiskRow[]) {
  let affected = 0;
  for (const risk of risks) {
    const [row] = await db
      .insert(aiMaterialRiskDailyTable)
      .values({
        id: crypto.randomUUID(),
        ingredientId: risk.ingredientId,
        itemName: risk.itemName,
        signalDate: risk.signalDate,
        riskScore: risk.riskScore,
        risk: risk.risk,
        trendPercent: risk.trendPercent.toFixed(2),
        currentPrice: risk.currentPrice,
        predictedPrice: risk.predictedPrice,
        sourceCount: risk.sourceCount,
        reason: risk.reason,
      })
      .onConflictDoUpdate({
        target: [aiMaterialRiskDailyTable.itemName, aiMaterialRiskDailyTable.signalDate],
        set: {
          ingredientId: risk.ingredientId,
          riskScore: risk.riskScore,
          risk: risk.risk,
          trendPercent: risk.trendPercent.toFixed(2),
          currentPrice: risk.currentPrice,
          predictedPrice: risk.predictedPrice,
          sourceCount: risk.sourceCount,
          reason: risk.reason,
          createdAt: new Date(),
        },
      })
      .returning({ id: aiMaterialRiskDailyTable.id });
    if (row?.id) affected += 1;
  }
  return affected;
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
          ? "Stok cover rendah dan risiko naik tinggi; prioritas beli hari ini."
          : action === "beli-bertahap"
            ? "Stok masih aman terbatas; lakukan pembelian bertahap untuk mengurangi risiko lonjakan harga."
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

    const [{ signals: externalSignals, failedFeeds }, ingredients, predictions] = await Promise.all([
      loadExternalFeedSignals(),
      db.select().from(ingredientsTable).where(sql`${ingredientsTable.active} = true`),
      db.select().from(pricePredictionsTable).orderBy(desc(pricePredictionsTable.createdAt)).limit(250),
    ]);

    metrics.failedFeeds = failedFeeds;
    const staticSignals = buildStaticSignals();
    metrics.ingestedSignals = await persistSignals([...staticSignals, ...externalSignals]);

    const recentSignals = await db
      .select()
      .from(aiSourceSignalsTable)
      .where(gte(aiSourceSignalsTable.publishedAt, new Date(Date.now() - 7 * DAY_IN_MS)))
      .orderBy(desc(aiSourceSignalsTable.publishedAt))
      .limit(400);

    const predictionInputs = predictions.length > 0 ? predictions : buildFallbackPredictions();
    const materialRisks = buildMaterialRisks(ingredients, predictionInputs, recentSignals, todayKey);
    metrics.generatedRisks = await persistMaterialRisks(materialRisks);

    const riskMap = new Map(
      materialRisks
        .filter((item) => item.ingredientId)
        .map((item) => [item.ingredientId as string, item] as const),
    );

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

    const status: "success" | "partial" = metrics.failedFeeds > 0 ? "partial" : "success";
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
  const [risks, projections, recommendations, latestRun] = await Promise.all([
    db
      .select()
      .from(aiMaterialRiskDailyTable)
      .where(eq(aiMaterialRiskDailyTable.signalDate, todayKey))
      .orderBy(desc(aiMaterialRiskDailyTable.riskScore))
      .limit(12),
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
      ...risks.map((item) => item.ingredientId).filter((id): id is string => Boolean(id)),
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
    risks,
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
