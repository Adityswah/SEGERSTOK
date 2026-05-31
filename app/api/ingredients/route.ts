import { desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable, stockLedgerTable } from "@/db/schema";
import { getRole, requireSession } from "@/lib/api/authz";
import { created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const ingredientSchema = z.object({
  id: z.string().min(2).optional(),
  name: z.string().min(3).max(160),
  category: z.string().trim().min(2).max(160),
  unit: z.string().min(1).max(32),
  stock: z.coerce.number().nonnegative().default(0),
  minimumStock: z.coerce.number().nonnegative().default(0),
  averagePrice: z.coerce.number().int().nonnegative().default(0),
  isBom: z.coerce.boolean().optional().default(false),
});

const ingredientPatchSchema = ingredientSchema.extend({
  id: z.string().min(2),
});

const masterSchema = z.object({
  type: z.enum(["unit", "category"]),
  previousValue: z.string().trim().min(1).max(160).optional(),
  nextValue: z.string().trim().min(1).max(160),
});

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const rows = await db
      .select()
      .from(ingredientsTable)
      .where(
        q
          ? or(ilike(ingredientsTable.name, `%${q}%`), ilike(ingredientsTable.unit, `%${q}%`))
          : eq(ingredientsTable.active, true),
      )
      .orderBy(desc(ingredientsTable.updatedAt));

    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 30, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can create master ingredients");

    const { data: body, response } = await parseJsonBody(request, ingredientSchema);
    if (response) return response;

    const row = await db.transaction(async (tx) => {
      const id = body.id ?? crypto.randomUUID();
      const [ingredient] = await tx
        .insert(ingredientsTable)
        .values({
          id,
          name: body.name,
          category: body.category,
          unit: body.unit,
          stock: String(body.stock),
          minimumStock: String(body.minimumStock),
          averagePrice: body.averagePrice,
          isBom: body.isBom,
        })
        .returning();

      if (!ingredient) throw new Error("Ingredient gagal dibuat");

      if (body.stock > 0) {
        await tx.insert(stockLedgerTable).values({
          id: crypto.randomUUID(),
          ingredientId: ingredient.id,
          source: "owner_stock_correction",
          referenceId: ingredient.id,
          stockBefore: "0",
          stockAfter: String(body.stock),
          delta: String(body.stock.toFixed(3)),
          reason: "Input product baru dari Settings",
          operatorId: session.user.id,
          operatorName: session.user.name,
        });
      }

      return ingredient;
    });

    return created(row);
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 40, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can edit master ingredients");

    const { data: body, response } = await parseJsonBody(request, ingredientPatchSchema);
    if (response) return response;

    const row = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(ingredientsTable).where(eq(ingredientsTable.id, body.id)).limit(1);
      if (!before) return null;

      const stockBefore = Number(before.stock);
      const stockAfter = body.stock;
      const [updated] = await tx
        .update(ingredientsTable)
        .set({
          name: body.name,
          category: body.category,
          unit: body.unit,
          stock: String(stockAfter),
          minimumStock: String(body.minimumStock),
          averagePrice: body.averagePrice,
          isBom: body.isBom,
          updatedAt: new Date(),
        })
        .where(eq(ingredientsTable.id, body.id))
        .returning();

      const delta = stockAfter - stockBefore;
      if (updated && delta !== 0) {
        await tx.insert(stockLedgerTable).values({
          id: crypto.randomUUID(),
          ingredientId: body.id,
          source: "owner_stock_correction",
          referenceId: body.id,
          stockBefore: String(stockBefore),
          stockAfter: String(stockAfter),
          delta: String(delta.toFixed(3)),
          reason: `Edit stock product dari Settings: ${before.name}`,
          operatorId: session.user.id,
          operatorName: session.user.name,
        });
      }

      return updated ?? null;
    });

    if (!row) return forbidden("Ingredient tidak ditemukan atau tidak bisa diedit");
    return ok(row);
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 30, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can edit master data");

    const { data: body, response } = await parseJsonBody(request, masterSchema);
    if (response) return response;

    if (!body.previousValue || body.previousValue === body.nextValue) {
      return ok({ updated: 0, value: body.nextValue });
    }

    const rows = await db
      .update(ingredientsTable)
      .set({
        [body.type]: body.nextValue,
        updatedAt: new Date(),
      })
      .where(eq(ingredientsTable[body.type], body.previousValue))
      .returning({ id: ingredientsTable.id });

    return ok({ updated: rows.length, value: body.nextValue });
  } catch (error) {
    return serverError(error);
  }
}
