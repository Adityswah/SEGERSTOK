import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { bomRecipeItemsTable, bomRecipesTable, ingredientsTable } from "@/db/schema";
import { canAccessBom, getRole, requireSession } from "@/lib/api/authz";
import { created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const bomItemSchema = z.object({
  ingredientId: z.string().min(2),
  quantity: z.coerce.number().positive(),
  totalCost: z.coerce.number().int().nonnegative(),
});

const bomSchema = z.object({
  name: z.string().trim().min(3).max(160),
  category: z.string().trim().min(2).max(160),
  unit: z.string().trim().min(1).max(32),
  yieldQuantity: z.coerce.number().positive(),
  minimumStock: z.coerce.number().nonnegative().default(0),
  items: z.array(bomItemSchema).min(1).max(30),
});

const bomPatchSchema = bomSchema.extend({
  id: z.string().min(2),
  finishedIngredientId: z.string().min(2),
});

function canManageBom(role: string) {
  return role === "Owner" || role === "Cheef";
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (!canAccessBom(getRole(session))) return forbidden("Hanya Owner dan Cheef yang bisa mengakses BOM");

    const recipes = await db
      .select({
        id: bomRecipesTable.id,
        finishedIngredientId: bomRecipesTable.finishedIngredientId,
        name: bomRecipesTable.name,
        category: ingredientsTable.category,
        yieldQuantity: bomRecipesTable.yieldQuantity,
        yieldUnit: bomRecipesTable.yieldUnit,
        totalCost: bomRecipesTable.totalCost,
        createdByName: bomRecipesTable.createdByName,
        createdAt: bomRecipesTable.createdAt,
        updatedAt: bomRecipesTable.updatedAt,
      })
      .from(bomRecipesTable)
      .innerJoin(ingredientsTable, eq(ingredientsTable.id, bomRecipesTable.finishedIngredientId))
      .where(eq(bomRecipesTable.active, true))
      .orderBy(asc(bomRecipesTable.name));

    const recipeIds = recipes.map((recipe) => recipe.id);
    const items = recipeIds.length
      ? await db
          .select({
            id: bomRecipeItemsTable.id,
            bomRecipeId: bomRecipeItemsTable.bomRecipeId,
            ingredientId: bomRecipeItemsTable.ingredientId,
            ingredientName: ingredientsTable.name,
            ingredientUnit: ingredientsTable.unit,
            ingredientCategory: ingredientsTable.category,
            quantity: bomRecipeItemsTable.quantity,
            totalCost: bomRecipeItemsTable.totalCost,
          })
          .from(bomRecipeItemsTable)
          .innerJoin(ingredientsTable, eq(ingredientsTable.id, bomRecipeItemsTable.ingredientId))
          .where(inArray(bomRecipeItemsTable.bomRecipeId, recipeIds))
          .orderBy(asc(bomRecipeItemsTable.createdAt))
      : [];

    return ok(
      recipes.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        yieldQuantity: Number(recipe.yieldQuantity),
        yieldUnit: recipe.yieldUnit,
        totalCost: recipe.totalCost,
        finishedIngredientId: recipe.finishedIngredientId,
        createdByName: recipe.createdByName,
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
        items: items
          .filter((item) => item.bomRecipeId === recipe.id)
          .map((item) => ({
            id: item.id,
            ingredientId: item.ingredientId,
            ingredientName: item.ingredientName,
            ingredientUnit: item.ingredientUnit,
            ingredientCategory: item.ingredientCategory,
            quantity: Number(item.quantity),
            totalCost: item.totalCost,
          })),
      })),
    );
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "bom:create", limit: 20, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (!canManageBom(getRole(session))) return forbidden("Hanya Owner dan Cheef yang bisa membuat BOM");

    const { data: body, response } = await parseJsonBody(request, bomSchema, 96_000);
    if (response) return response;

    const ingredientIds = Array.from(new Set(body.items.map((item) => item.ingredientId)));
    if (ingredientIds.length !== body.items.length) {
      return forbidden("Bahan BOM tidak boleh duplikat dalam 1 resep");
    }

    const [existingIngredient] = await db
      .select({ id: ingredientsTable.id })
      .from(ingredientsTable)
      .where(eq(ingredientsTable.name, body.name))
      .limit(1);

    if (existingIngredient) {
      return forbidden("Nama BOM sudah dipakai di master stok. Gunakan nama lain.");
    }

    const sourceIngredients = await db
      .select({
        id: ingredientsTable.id,
        name: ingredientsTable.name,
        active: ingredientsTable.active,
        isBom: ingredientsTable.isBom,
      })
      .from(ingredientsTable)
      .where(inArray(ingredientsTable.id, ingredientIds));

    if (sourceIngredients.length !== ingredientIds.length) {
      return forbidden("Ada bahan BOM yang tidak ditemukan di master bahan");
    }

    if (sourceIngredients.some((item) => !item.active)) {
      return forbidden("Semua bahan BOM harus aktif");
    }

    if (sourceIngredients.some((item) => item.isBom)) {
      return forbidden("Bahan penyusun BOM tidak boleh mengambil item BOM lain");
    }

    const totalCost = body.items.reduce((sum, item) => sum + item.totalCost, 0);
    const unitCost = Math.round(totalCost / body.yieldQuantity);

    const createdRecipe = await db.transaction(async (tx) => {
      const finishedIngredientId = crypto.randomUUID();
      const recipeId = crypto.randomUUID();

      const [ingredient] = await tx
        .insert(ingredientsTable)
        .values({
          id: finishedIngredientId,
          name: body.name,
          category: body.category,
          unit: body.unit,
          stock: "0",
          minimumStock: String(body.minimumStock),
          averagePrice: unitCost,
          isBom: true,
        })
        .returning();

      const [recipe] = await tx
        .insert(bomRecipesTable)
        .values({
          id: recipeId,
          finishedIngredientId,
          name: body.name,
          yieldQuantity: String(body.yieldQuantity),
          yieldUnit: body.unit,
          totalCost,
          createdById: session.user.id,
          createdByName: session.user.name,
        })
        .returning();

      if (body.items.length) {
        await tx.insert(bomRecipeItemsTable).values(
          body.items.map((item) => ({
            id: crypto.randomUUID(),
            bomRecipeId: recipeId,
            ingredientId: item.ingredientId,
            quantity: String(item.quantity),
            totalCost: item.totalCost,
          })),
        );
      }

      return { ingredient, recipe };
    });

    return created({
      id: createdRecipe.recipe.id,
      finishedIngredientId: createdRecipe.ingredient.id,
      name: createdRecipe.recipe.name,
      yieldQuantity: Number(createdRecipe.recipe.yieldQuantity),
      yieldUnit: createdRecipe.recipe.yieldUnit,
      totalCost: createdRecipe.recipe.totalCost,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "bom:update", limit: 20, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (!canManageBom(getRole(session))) return forbidden("Hanya Owner dan Cheef yang bisa edit BOM");

    const { data: body, response } = await parseJsonBody(request, bomPatchSchema, 96_000);
    if (response) return response;

    const ingredientIds = Array.from(new Set(body.items.map((item) => item.ingredientId)));
    if (ingredientIds.length !== body.items.length) {
      return forbidden("Bahan BOM tidak boleh duplikat dalam 1 resep");
    }

    const sourceIngredients = await db
      .select({
        id: ingredientsTable.id,
        active: ingredientsTable.active,
        isBom: ingredientsTable.isBom,
      })
      .from(ingredientsTable)
      .where(inArray(ingredientsTable.id, ingredientIds));

    if (sourceIngredients.length !== ingredientIds.length) return forbidden("Ada bahan BOM yang tidak ditemukan");
    if (sourceIngredients.some((item) => !item.active)) return forbidden("Semua bahan BOM harus aktif");
    if (sourceIngredients.some((item) => item.isBom)) return forbidden("Bahan penyusun BOM tidak boleh mengambil item BOM lain");

    const totalCost = body.items.reduce((sum, item) => sum + item.totalCost, 0);
    const unitCost = Math.round(totalCost / body.yieldQuantity);

    await db.transaction(async (tx) => {
      await tx
        .update(ingredientsTable)
        .set({
          name: body.name,
          category: body.category,
          unit: body.unit,
          minimumStock: String(body.minimumStock),
          averagePrice: unitCost,
          isBom: true,
          updatedAt: new Date(),
        })
        .where(eq(ingredientsTable.id, body.finishedIngredientId));

      await tx
        .update(bomRecipesTable)
        .set({
          name: body.name,
          yieldQuantity: String(body.yieldQuantity),
          yieldUnit: body.unit,
          totalCost,
          updatedAt: new Date(),
        })
        .where(eq(bomRecipesTable.id, body.id));

      await tx.delete(bomRecipeItemsTable).where(eq(bomRecipeItemsTable.bomRecipeId, body.id));
      await tx.insert(bomRecipeItemsTable).values(
        body.items.map((item) => ({
          id: crypto.randomUUID(),
          bomRecipeId: body.id,
          ingredientId: item.ingredientId,
          quantity: String(item.quantity),
          totalCost: item.totalCost,
        })),
      );
    });

    return ok({ id: body.id, updated: true });
  } catch (error) {
    return serverError(error);
  }
}
