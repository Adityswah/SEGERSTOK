import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable, stockTransactionsTable } from "@/db/schema";
import { canWriteStock, getRole, requireSession } from "@/lib/api/authz";
import { created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const transactionSchema = z.object({
  ingredientId: z.string().min(1),
  type: z.enum(["masuk", "keluar"]),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().int().nonnegative().optional(),
  transactionDate: z.coerce.date().optional(),
  clientRequestId: z.string().min(8).max(120).optional(),
  operatorName: z.string().min(2).max(80),
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
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 100;
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
          operatorName: body.operatorName,
          note: body.note,
        })
        .returning();

      const stockExpression =
        body.type === "masuk"
          ? sql`${ingredientsTable.stock} + ${String(body.quantity)}`
          : sql`greatest(${ingredientsTable.stock} - ${String(body.quantity)}, 0)`;

      await tx
        .update(ingredientsTable)
        .set({
          stock: stockExpression,
          updatedAt: new Date(),
        })
        .where(eq(ingredientsTable.id, body.ingredientId));

      return [transaction];
    });

    return created(row);
  } catch (error) {
    return serverError(error);
  }
}
