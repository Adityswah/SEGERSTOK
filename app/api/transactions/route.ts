import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable, stockLedgerTable, stockTransactionsTable } from "@/db/schema";
import { canWriteStock, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const transactionSchema = z.object({
  ingredientId: z.string().min(1),
  type: z.enum(["masuk", "keluar"]),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().int().nonnegative().optional(),
  transactionDate: z.coerce.date().optional(),
  clientRequestId: z.string().min(8).max(120).optional(),
  operatorName: z.string().min(2).max(80).optional(),
  note: z.string().max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read transaction history");

    const url = new URL(request.url);
    const ingredientId = url.searchParams.get("ingredientId");
    const limitParam = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 100;
    const whereClause = ingredientId ? eq(stockTransactionsTable.ingredientId, ingredientId) : undefined;

    const rows = await db
      .select()
      .from(stockTransactionsTable)
      .where(whereClause)
      .orderBy(desc(stockTransactionsTable.createdAt))
      .limit(limit);

    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 40, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    const role = getRole(session);
    if (!canWriteStock(role)) return forbidden("This role cannot write stock transactions");

    const { data: body, response } = await parseJsonBody(request, transactionSchema);
    if (response) return response;

    if (body.clientRequestId) {
      const [existing] = await db
        .select()
        .from(stockTransactionsTable)
        .where(eq(stockTransactionsTable.clientRequestId, body.clientRequestId))
        .limit(1);
      if (existing) return ok(existing);
    }

    const [row] = await db.transaction(async (tx) => {
      const [ingredientBefore] = await tx
        .select({ stock: ingredientsTable.stock })
        .from(ingredientsTable)
        .where(eq(ingredientsTable.id, body.ingredientId))
        .limit(1);

      if (!ingredientBefore) throw new Error("Ingredient tidak ditemukan");

      const stockBefore = Number(ingredientBefore.stock);
      if (body.type === "keluar" && stockBefore < body.quantity) {
        throw new Error("Stok tidak cukup untuk transaksi keluar");
      }

      const [transaction] = await tx
        .insert(stockTransactionsTable)
        .values({
          id: crypto.randomUUID(),
          ingredientId: body.ingredientId,
          type: body.type,
          quantity: String(body.quantity),
          unitPrice: body.unitPrice,
          transactionDate: body.transactionDate ?? new Date(),
          clientRequestId: body.clientRequestId,
          operatorId: session.user.id,
          operatorName: session.user.name,
          note: body.note,
        })
        .returning();

      const stockExpression =
        body.type === "masuk"
          ? sql`${ingredientsTable.stock} + ${String(body.quantity)}`
          : sql`${ingredientsTable.stock} - ${String(body.quantity)}`;

      const stockAfter = body.type === "masuk" ? stockBefore + body.quantity : stockBefore - body.quantity;

      await tx
        .update(ingredientsTable)
        .set({
          stock: stockExpression,
          updatedAt: new Date(),
        })
        .where(eq(ingredientsTable.id, body.ingredientId));

      await tx.insert(stockLedgerTable).values({
        id: crypto.randomUUID(),
        ingredientId: body.ingredientId,
        source: body.type === "masuk" ? "stock_in" : "stock_out",
        referenceId: transaction.id,
        stockBefore: String(stockBefore),
        stockAfter: String(stockAfter),
        delta: String((stockAfter - stockBefore).toFixed(2)),
        reason: body.note,
        operatorId: session.user.id,
        operatorName: session.user.name,
      });

      return [transaction];
    });

    return created(row);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("tidak cukup") || error.message.includes("tidak ditemukan"))) {
      return badRequest(error.message);
    }

    return serverError(error);
  }
}
