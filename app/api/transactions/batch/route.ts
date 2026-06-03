import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable, stockLedgerTable, stockTransactionsTable } from "@/db/schema";
import { canWriteStock, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";
import { generateTransactionNo } from "@/lib/api/transaction-number";

const transactionBatchSchema = z.object({
  type: z.enum(["masuk", "keluar"]),
  transactionDate: z.coerce.date().optional(),
  operatorName: z.string().min(2).max(80).optional(),
  clientBatchId: z.string().min(8).max(80),
  rows: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().int().nonnegative().optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "transactions:batch", limit: 20, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    const role = getRole(session);
    if (!canWriteStock(role)) return forbidden("This role cannot write stock transactions");

    const { data: body, response } = await parseJsonBody(request, transactionBatchSchema, 96_000);
    if (response) return response;

    const transactionDate = body.transactionDate ?? new Date();
    const transactionNo = generateTransactionNo(body.type === "masuk" ? "STK-IN" : "STK-OUT", transactionDate);

    const savedRows = await db.transaction(async (tx) => {
      const prepared = body.rows.map((row, index) => ({
        ...row,
        id: crypto.randomUUID(),
        clientRequestId: `${body.clientBatchId}:${index}:${row.ingredientId}`,
      }));
      const existingRows = await tx
        .select()
        .from(stockTransactionsTable)
        .where(inArray(stockTransactionsTable.clientRequestId, prepared.map((row) => row.clientRequestId)));
      const existingByClientId = new Map(existingRows.map((row) => [row.clientRequestId, row]));
      const newRows = prepared.filter((row) => !existingByClientId.has(row.clientRequestId));
      if (!newRows.length) return existingRows.map((row) => ({ row, skipped: true }));

      const ingredientIds = Array.from(new Set(newRows.map((row) => row.ingredientId)));
      const ingredients = await tx
        .select({ id: ingredientsTable.id, stock: ingredientsTable.stock })
        .from(ingredientsTable)
        .where(inArray(ingredientsTable.id, ingredientIds));
      if (ingredients.length !== ingredientIds.length) throw new Error("Ada ingredient yang tidak ditemukan");

      const ingredientStock = new Map(ingredients.map((ingredient) => [ingredient.id, Number(ingredient.stock)]));
      const runningStock = new Map(ingredientStock);
      const stockDeltaByIngredient = new Map<string, number>();
      const ledgerDrafts = newRows.map((row) => {
        const stockBefore = runningStock.get(row.ingredientId);
        if (stockBefore === undefined) throw new Error(`Ingredient ${row.ingredientId} tidak ditemukan`);
        const stockAfter = body.type === "masuk" ? stockBefore + row.quantity : stockBefore - row.quantity;
        if (stockAfter < 0) throw new Error(`Stok ingredient ${row.ingredientId} tidak cukup untuk transaksi keluar`);
        runningStock.set(row.ingredientId, stockAfter);
        stockDeltaByIngredient.set(row.ingredientId, (stockDeltaByIngredient.get(row.ingredientId) ?? 0) + (stockAfter - stockBefore));
        return { row, stockBefore, stockAfter };
      });

      const insertedRows = await tx
        .insert(stockTransactionsTable)
        .values(
          newRows.map((row) => ({
            id: row.id,
            transactionNo,
            ingredientId: row.ingredientId,
            type: body.type,
            quantity: String(row.quantity),
            unitPrice: body.type === "masuk" ? row.unitPrice : undefined,
            transactionDate,
            clientRequestId: row.clientRequestId,
            operatorId: session.user.id,
            operatorName: session.user.name,
            note: row.note,
          })),
        )
        .returning();

      for (const [ingredientId, delta] of stockDeltaByIngredient) {
        await tx
          .update(ingredientsTable)
          .set({
            stock: sql`${ingredientsTable.stock} + ${String(delta)}`,
            updatedAt: new Date(),
          })
          .where(eq(ingredientsTable.id, ingredientId));
      }

      await tx.insert(stockLedgerTable).values(
        ledgerDrafts.map(({ row, stockBefore, stockAfter }) => ({
          id: crypto.randomUUID(),
          ingredientId: row.ingredientId,
          source: body.type === "masuk" ? "stock_in" as const : "stock_out" as const,
          referenceId: row.id,
          stockBefore: String(stockBefore),
          stockAfter: String(stockAfter),
          delta: String((stockAfter - stockBefore).toFixed(3)),
          reason: row.note,
          operatorId: session.user.id,
          operatorName: session.user.name,
        })),
      );

      return [
        ...existingRows.map((row) => ({ row, skipped: true })),
        ...insertedRows.map((row) => ({ row, skipped: false })),
      ];
    });

    return ok({
      inserted: savedRows.filter((item) => !item.skipped).length,
      rows: savedRows.map((item) => item.row),
      skipped: savedRows.filter((item) => item.skipped).length,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("tidak cukup") || error.message.includes("tidak ditemukan"))) {
      return badRequest(error.message);
    }

    return serverError(error);
  }
}
