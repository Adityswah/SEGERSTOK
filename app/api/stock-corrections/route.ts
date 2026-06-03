import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable, stockLedgerTable } from "@/db/schema";
import { getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const correctionRowSchema = z.object({
  ingredientId: z.string().min(1),
  actualStock: z.coerce.number().nonnegative(),
  reason: z.string().trim().min(3).max(500),
});

const correctionSchema = z.union([
  correctionRowSchema,
  z.object({
    rows: z.array(correctionRowSchema).min(1).max(5),
  }),
]);

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read stock correction ledger");

    const rows = await db
      .select({
        id: stockLedgerTable.id,
        ingredientId: stockLedgerTable.ingredientId,
        ingredientName: ingredientsTable.name,
        ingredientUnit: ingredientsTable.unit,
        source: stockLedgerTable.source,
        referenceId: stockLedgerTable.referenceId,
        stockBefore: stockLedgerTable.stockBefore,
        stockAfter: stockLedgerTable.stockAfter,
        delta: stockLedgerTable.delta,
        reason: stockLedgerTable.reason,
        operatorName: stockLedgerTable.operatorName,
        createdAt: stockLedgerTable.createdAt,
      })
      .from(stockLedgerTable)
      .innerJoin(ingredientsTable, eq(ingredientsTable.id, stockLedgerTable.ingredientId))
      .orderBy(desc(stockLedgerTable.createdAt))
      .limit(200);

    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "stock-correction", limit: 20, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can correct stock");

    const { data: body, response } = await parseJsonBody(request, correctionSchema, 32_000);
    if (response) return response;
    const rows = "rows" in body ? body.rows : [body];

    const result = await db.transaction(async (tx) => {
      const ingredientIds = Array.from(new Set(rows.map((row) => row.ingredientId)));
      const ingredients = await tx.select().from(ingredientsTable).where(inArray(ingredientsTable.id, ingredientIds));
      if (ingredients.length !== ingredientIds.length) throw new Error("Ingredient tidak ditemukan");
      const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

      const savedIngredients = [];
      const ledgerRows = rows.map((row) => {
        const ingredient = ingredientMap.get(row.ingredientId);
        if (!ingredient) throw new Error("Ingredient tidak ditemukan");
        const stockBefore = Number(ingredient.stock);
        const stockAfter = row.actualStock;
        return {
          id: crypto.randomUUID(),
          ingredientId: row.ingredientId,
          source: "owner_stock_correction" as const,
          referenceId: null,
          stockBefore: String(stockBefore),
          stockAfter: String(stockAfter),
          delta: String((stockAfter - stockBefore).toFixed(3)),
          reason: row.reason,
          operatorId: session.user.id,
          operatorName: session.user.name,
        };
      });

      for (const row of rows) {
        const [updated] = await tx
          .update(ingredientsTable)
          .set({ stock: String(row.actualStock), updatedAt: new Date() })
          .where(eq(ingredientsTable.id, row.ingredientId))
          .returning();
        if (!updated) throw new Error("Ingredient gagal diperbarui");
        savedIngredients.push(updated);
      }

      const ledgers = await tx.insert(stockLedgerTable).values(ledgerRows).returning();
      return savedIngredients.map((ingredient, index) => ({ ingredient, ledger: ledgers[index] }));
    });

    if (!result.length) return badRequest("Koreksi stok gagal disimpan");
    return created(result);
  } catch (error) {
    return serverError(error);
  }
}
