import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable, stockLedgerTable, stockTransactionsTable } from "@/db/schema";
import { canWriteStock, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

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

    const savedRows = await db.transaction(async (tx) => {
      const rows = [];

      for (const [index, row] of body.rows.entries()) {
        const clientRequestId = `${body.clientBatchId}:${index}:${row.ingredientId}`;
        const [existing] = await tx
          .select()
          .from(stockTransactionsTable)
          .where(eq(stockTransactionsTable.clientRequestId, clientRequestId))
          .limit(1);

        if (existing) {
          rows.push({ row: existing, skipped: true });
          continue;
        }

        const [ingredientBefore] = await tx
          .select({ stock: ingredientsTable.stock })
          .from(ingredientsTable)
          .where(eq(ingredientsTable.id, row.ingredientId))
          .limit(1);

        if (!ingredientBefore) throw new Error(`Ingredient ${row.ingredientId} tidak ditemukan`);

        const stockBefore = Number(ingredientBefore.stock);
        if (body.type === "keluar" && stockBefore < row.quantity) {
          throw new Error(`Stok ingredient ${row.ingredientId} tidak cukup untuk transaksi keluar`);
        }

        const [transaction] = await tx
          .insert(stockTransactionsTable)
          .values({
            id: crypto.randomUUID(),
            ingredientId: row.ingredientId,
            type: body.type,
            quantity: String(row.quantity),
            unitPrice: body.type === "masuk" ? row.unitPrice : undefined,
            transactionDate: body.transactionDate ?? new Date(),
            clientRequestId,
            operatorId: session.user.id,
            operatorName: session.user.name,
            note: row.note,
          })
          .returning();

        const stockExpression =
          body.type === "masuk"
            ? sql`${ingredientsTable.stock} + ${String(row.quantity)}`
            : sql`${ingredientsTable.stock} - ${String(row.quantity)}`;

        const stockAfter = body.type === "masuk" ? stockBefore + row.quantity : stockBefore - row.quantity;

        await tx
          .update(ingredientsTable)
          .set({
            stock: stockExpression,
            updatedAt: new Date(),
          })
          .where(eq(ingredientsTable.id, row.ingredientId));

        await tx.insert(stockLedgerTable).values({
          id: crypto.randomUUID(),
          ingredientId: row.ingredientId,
          source: body.type === "masuk" ? "stock_in" : "stock_out",
          referenceId: transaction.id,
          stockBefore: String(stockBefore),
          stockAfter: String(stockAfter),
          delta: String((stockAfter - stockBefore).toFixed(2)),
          reason: row.note,
          operatorId: session.user.id,
          operatorName: session.user.name,
        });

        rows.push({ row: transaction, skipped: false });
      }

      return rows;
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
