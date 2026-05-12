import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable, stockTransactionsTable } from "@/db/schema";
import { canWriteStock, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";

const transactionSchema = z.object({
  ingredientId: z.string().min(1),
  type: z.enum(["masuk", "keluar"]),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().int().nonnegative().optional(),
  transactionDate: z.coerce.date().optional(),
  operatorName: z.string().min(2).max(80),
  note: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read transaction history");

    const rows = await db
      .select()
      .from(stockTransactionsTable)
      .orderBy(desc(stockTransactionsTable.transactionDate))
      .limit(100);

    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    const role = getRole(session);
    if (!canWriteStock(role)) return forbidden("This role cannot write stock transactions");

    const body = transactionSchema.parse(await request.json());

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
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    return serverError(error);
  }
}
