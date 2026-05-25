import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientMasterOptionsTable, ingredientsTable } from "@/db/schema";
import { getRole, requireSession } from "@/lib/api/authz";
import { created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const masterTypeSchema = z.enum(["unit", "category"]);
const masterOptionSchema = z.object({
  type: masterTypeSchema,
  value: z.string().trim().min(1).max(160),
});
const masterRenameSchema = z.object({
  type: masterTypeSchema,
  previousValue: z.string().trim().min(1).max(160),
  nextValue: z.string().trim().min(1).max(160),
});

async function requireOwner() {
  const session = await requireSession();
  if (!session) return { session: null, response: unauthorized() };
  if (getRole(session) !== "Owner") return { session, response: forbidden("Only Owner can manage master data") };
  return { session, response: null };
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const [options, ingredients] = await Promise.all([
      db.select().from(ingredientMasterOptionsTable).where(eq(ingredientMasterOptionsTable.active, true)),
      db.select({ category: ingredientsTable.category, unit: ingredientsTable.unit }).from(ingredientsTable).where(eq(ingredientsTable.active, true)),
    ]);

    const units = new Set(options.filter((item) => item.type === "unit").map((item) => item.value));
    const categories = new Set(options.filter((item) => item.type === "category").map((item) => item.value));
    for (const ingredient of ingredients) {
      units.add(ingredient.unit);
      categories.add(ingredient.category);
    }

    return ok({
      units: Array.from(units).sort(),
      categories: Array.from(categories).sort(),
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 40, windowMs: 60_000 });
    if (guard) return guard;

    const owner = await requireOwner();
    if (owner.response) return owner.response;

    const { data: body, response } = await parseJsonBody(request, masterOptionSchema);
    if (response) return response;

    const [row] = await db
      .insert(ingredientMasterOptionsTable)
      .values({
        id: crypto.randomUUID(),
        type: body.type,
        value: body.value,
      })
      .onConflictDoUpdate({
        target: [ingredientMasterOptionsTable.type, ingredientMasterOptionsTable.value],
        set: { active: true, updatedAt: new Date() },
      })
      .returning();

    return created(row);
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 40, windowMs: 60_000 });
    if (guard) return guard;

    const owner = await requireOwner();
    if (owner.response) return owner.response;

    const { data: body, response } = await parseJsonBody(request, masterRenameSchema);
    if (response) return response;

    const result = await db.transaction(async (tx) => {
      const optionRows = await tx
        .update(ingredientMasterOptionsTable)
        .set({ value: body.nextValue, active: true, updatedAt: new Date() })
        .where(
          and(
            eq(ingredientMasterOptionsTable.type, body.type),
            eq(ingredientMasterOptionsTable.value, body.previousValue),
          ),
        )
        .returning({ id: ingredientMasterOptionsTable.id });

      if (!optionRows.length) {
        await tx
          .insert(ingredientMasterOptionsTable)
          .values({
            id: crypto.randomUUID(),
            type: body.type,
            value: body.nextValue,
          })
          .onConflictDoUpdate({
            target: [ingredientMasterOptionsTable.type, ingredientMasterOptionsTable.value],
            set: { active: true, updatedAt: new Date() },
          });
      }

      const ingredientRows = await tx
        .update(ingredientsTable)
        .set({ [body.type]: body.nextValue, updatedAt: new Date() })
        .where(eq(ingredientsTable[body.type], body.previousValue))
        .returning({ id: ingredientsTable.id });

      return { optionsUpdated: optionRows.length, ingredientsUpdated: ingredientRows.length };
    });

    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 40, windowMs: 60_000 });
    if (guard) return guard;

    const owner = await requireOwner();
    if (owner.response) return owner.response;

    const { data: body, response } = await parseJsonBody(request, masterOptionSchema);
    if (response) return response;

    const rows = await db
      .update(ingredientMasterOptionsTable)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(ingredientMasterOptionsTable.type, body.type), eq(ingredientMasterOptionsTable.value, body.value)))
      .returning({ id: ingredientMasterOptionsTable.id });

    return ok({ updated: rows.length });
  } catch (error) {
    return serverError(error);
  }
}
