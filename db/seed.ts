import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ingredientsTable, pricePredictionsTable } from "@/db/schema";
import { ingredients, priceForecast, priceNews } from "@/lib/data";

config({ path: ".env.local" });

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/sotostock";

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

function findErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeError = error as { code?: unknown; cause?: unknown; errors?: unknown };
  if (typeof maybeError.code === "string") return maybeError.code;
  const causeCode = findErrorCode(maybeError.cause);
  if (causeCode) return causeCode;
  if (Array.isArray(maybeError.errors)) {
    return maybeError.errors.map(findErrorCode).find(Boolean);
  }
  return undefined;
}

function parseChangePercent(change: string) {
  return Number(change.replace("%", "").replace("+", ""));
}

function findPredictionSource(itemName: string, sourceName: string) {
  const sourceCandidates = sourceName.split(",").map((source) => source.trim());
  return (
    priceNews.find(
      (news) =>
        sourceCandidates.includes(news.source) &&
        [news.title, news.commodity, news.summary].some((text) =>
          text.toLowerCase().includes(itemName.toLowerCase()),
        ),
    ) ??
    priceNews.find((news) => sourceCandidates.includes(news.source)) ??
    priceNews[0]
  );
}

async function seedIngredients() {
  await db
    .insert(ingredientsTable)
    .values(
      ingredients.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        stock: String(item.stock),
        minimumStock: String(item.minimum),
        averagePrice: item.price,
        active: true,
      })),
    )
    .onConflictDoUpdate({
      target: ingredientsTable.id,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        unit: sql`excluded.unit`,
        stock: sql`excluded.stock`,
        minimumStock: sql`excluded.minimum_stock`,
        averagePrice: sql`excluded.average_price`,
        active: true,
        updatedAt: new Date(),
      },
    });
}

async function seedPricePredictions() {
  const ingredientRows = await db.select().from(ingredientsTable);
  const ingredientIdByName = new Map(ingredientRows.map((item) => [item.name.toLowerCase(), item.id]));

  for (const item of priceForecast) {
    const source = findPredictionSource(item.item, item.source);
    const id = `prediction-${item.item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    await db
      .insert(pricePredictionsTable)
      .values({
        id,
        ingredientId: ingredientIdByName.get(item.item.toLowerCase()),
        itemName: item.item,
        currentPrice: item.current,
        predictedPrice: item.next,
        changePercent: String(parseChangePercent(item.change)),
        risk: item.risk as "Rendah" | "Sedang" | "Tinggi",
        sourceName: item.source,
        sourceUrl: source.url,
        summary: source.summary,
        publishedAt: new Date("2026-05-07T00:00:00+07:00"),
      })
      .onConflictDoUpdate({
        target: pricePredictionsTable.id,
        set: {
          ingredientId: ingredientIdByName.get(item.item.toLowerCase()),
          currentPrice: item.current,
          predictedPrice: item.next,
          changePercent: String(parseChangePercent(item.change)),
          risk: item.risk as "Rendah" | "Sedang" | "Tinggi",
          sourceName: item.source,
          sourceUrl: source.url,
          summary: source.summary,
        },
      });
  }
}

async function main() {
  await db.execute(sql`select 1`);
  await seedIngredients();
  await seedPricePredictions();

  const [ingredientCount] = await db.select().from(ingredientsTable);
  const predictionRows = await db.select().from(pricePredictionsTable);

  console.log(`Seed complete: ${ingredients.length} ingredients prepared.`);
  console.log(`Seed complete: ${predictionRows.length} price predictions available.`);

  if (!ingredientCount) {
    throw new Error("Seed sanity check failed: ingredients table is empty.");
  }
}

main()
  .catch((error) => {
    if (findErrorCode(error) === "ECONNREFUSED") {
      console.error(`Database is not reachable. Check that PostgreSQL is running at ${connectionString}.`);
      process.exitCode = 1;
      return;
    }

    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
