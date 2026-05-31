import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ingredientsTable } from "@/db/schema";
import { ingredients } from "@/lib/data";

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

async function main() {
  await db.execute(sql`select 1`);
  await seedIngredients();

  const [ingredientCount] = await db.select().from(ingredientsTable);

  console.log(`Seed complete: ${ingredients.length} ingredients prepared.`);

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
