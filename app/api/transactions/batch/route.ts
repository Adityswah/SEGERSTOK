import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable, stockTransactionsTable } from "@/db/schema";
import { canWriteStock, getRole, requireSession } from "@/lib/api/authz";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const transactionBatchSchema = z.object({
  type: z.enum(["masuk", "keluar"]),
  transactionDate: z.coerce.date().optional(),
  operatorName: z.string().min(2).max(80),
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
            operatorName: body.operatorName,
            note: row.note,
          })
          .returning();

        const stockExpression =
          body.type === "masuk"
            ? sql`${ingredientsTable.stock} + ${String(row.quantity)}`
            : sql`greatest(${ingredientsTable.stock} - ${String(row.quantity)}, 0)`;

        await tx
          .update(ingredientsTable)
          .set({
            stock: stockExpression,
            updatedAt: new Date(),
          })
          .where(eq(ingredientsTable.id, row.ingredientId));

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
    return serverError(error);
  }
}
