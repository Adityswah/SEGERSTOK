import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  bomProductionRunsTable,
  bomProductionRunItemsTable,
  bomRecipeItemsTable,
  bomRecipesTable,
  ingredientsTable,
  stockLedgerTable,
  stockTransactionsTable,
} from "@/db/schema";
import { canAccessBom, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const produceSchema = z.object({
  bomId: z.string().min(2),
  productionCount: z.coerce.number().positive(),
  operatorName: z.string().trim().min(2).max(80).optional(),
  transactionDate: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (!canAccessBom(getRole(session))) return forbidden("Hanya Owner dan Cheef yang bisa melihat histori produksi BOM");

    const rows = await db
      .select({
        id: bomProductionRunsTable.id,
        bomId: bomProductionRunsTable.bomRecipeId,
        finishedIngredientId: bomProductionRunsTable.finishedIngredientId,
        bomName: bomRecipesTable.name,
        yieldUnit: bomRecipesTable.yieldUnit,
        productionCount: bomProductionRunsTable.batches,
        producedQuantity: bomProductionRunsTable.producedQuantity,
        totalCost: bomProductionRunsTable.totalCost,
        operatorName: bomProductionRunsTable.operatorName,
        note: bomProductionRunsTable.note,
        productionDate: bomProductionRunsTable.productionDate,
        createdAt: bomProductionRunsTable.createdAt,
      })
      .from(bomProductionRunsTable)
      .innerJoin(bomRecipesTable, eq(bomRecipesTable.id, bomProductionRunsTable.bomRecipeId))
      .orderBy(desc(bomProductionRunsTable.productionDate))
      .limit(100);

    const runIds = rows.map((row) => row.id);
    const items = runIds.length
      ? await db
          .select()
          .from(bomProductionRunItemsTable)
          .where(inArray(bomProductionRunItemsTable.productionRunId, runIds))
      : [];

    return ok(
      rows.map((row) => ({
        ...row,
        productionCount: Number(row.productionCount),
        producedQuantity: Number(row.producedQuantity),
        items: items
          .filter((item) => item.productionRunId === row.id)
          .map((item) => ({
            id: item.id,
            ingredientId: item.ingredientId,
            ingredientName: item.ingredientName,
            ingredientUnit: item.ingredientUnit,
            consumedQuantity: Number(item.consumedQuantity),
            unitCost: item.unitCost,
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
    const guard = guardMutation(request, { keyPrefix: "bom:produce", limit: 30, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (!canAccessBom(getRole(session))) return forbidden("Hanya Owner dan Cheef yang bisa produksi BOM");

    const { data: body, response } = await parseJsonBody(request, produceSchema, 64_000);
    if (response) return response;

    const [recipe] = await db
      .select()
      .from(bomRecipesTable)
      .where(and(eq(bomRecipesTable.id, body.bomId), eq(bomRecipesTable.active, true)))
      .limit(1);

    if (!recipe) return forbidden("BOM tidak ditemukan");

    const recipeItems = await db
      .select()
      .from(bomRecipeItemsTable)
      .where(eq(bomRecipeItemsTable.bomRecipeId, recipe.id));

    if (!recipeItems.length) return badRequest("BOM belum memiliki bahan penyusun");

    const batches = body.productionCount;
    if (!Number.isFinite(batches) || batches <= 0) {
      return badRequest("Jumlah produksi BOM tidak valid");
    }

    const ingredientIds = recipeItems.map((item) => item.ingredientId);
    const ingredients = await db
      .select({
        id: ingredientsTable.id,
        name: ingredientsTable.name,
        unit: ingredientsTable.unit,
        stock: ingredientsTable.stock,
      })
      .from(ingredientsTable)
      .where(inArray(ingredientsTable.id, ingredientIds));

    const ingredientMap = new Map(ingredients.map((item) => [item.id, item]));
    for (const item of recipeItems) {
      const ingredient = ingredientMap.get(item.ingredientId);
      if (!ingredient) return forbidden("Ada bahan BOM yang sudah tidak tersedia");
      const requiredQty = Number(item.quantity) * batches;
      if (Number(ingredient.stock) < requiredQty) {
        return badRequest(`Stok ${ingredient.name} tidak cukup untuk produksi BOM`);
      }
    }

    const productionDate = body.transactionDate ?? new Date();
    const totalProduced = Number(recipe.yieldQuantity) * batches;
    const totalCost = Math.round(recipe.totalCost * batches);
    const [finishedIngredient] = await db
      .select({ stock: ingredientsTable.stock })
      .from(ingredientsTable)
      .where(eq(ingredientsTable.id, recipe.finishedIngredientId))
      .limit(1);

    await db.transaction(async (tx) => {
      const productionRunId = crypto.randomUUID();
      for (const item of recipeItems) {
        const requiredQty = Number(item.quantity) * batches;
        const clientRequestId = `${recipe.id}:${body.productionCount}:${item.ingredientId}:${productionDate.toISOString()}:keluar`;
        const ingredient = ingredientMap.get(item.ingredientId);
        if (!ingredient) throw new Error("Ingredient snapshot tidak ditemukan saat produksi BOM");
        const unitCost = Math.round(item.totalCost / Number(item.quantity));
        const [currentIngredient] = await tx
          .select({ stock: ingredientsTable.stock })
          .from(ingredientsTable)
          .where(eq(ingredientsTable.id, item.ingredientId))
          .limit(1);

        if (!currentIngredient) throw new Error("Ingredient tidak ditemukan saat produksi BOM");

        const stockBefore = Number(currentIngredient.stock);
        if (stockBefore < requiredQty) {
          throw new Error(`Stok ${ingredient.name} tidak cukup untuk produksi BOM`);
        }

        await tx.insert(stockTransactionsTable).values({
          id: crypto.randomUUID(),
          ingredientId: item.ingredientId,
          type: "keluar",
          quantity: String(requiredQty),
          transactionDate: productionDate,
          clientRequestId,
          operatorId: session.user.id,
          operatorName: session.user.name,
          note: body.note?.trim() || `Produksi BOM ${recipe.name}`,
        });

        const stockAfter = stockBefore - requiredQty;
        await tx
          .update(ingredientsTable)
          .set({
            stock: sql`${ingredientsTable.stock} - ${String(requiredQty)}`,
            updatedAt: new Date(),
          })
          .where(eq(ingredientsTable.id, item.ingredientId));
        await tx.insert(stockLedgerTable).values({
          id: crypto.randomUUID(),
          ingredientId: item.ingredientId,
          source: "bom_production",
          referenceId: productionRunId,
          stockBefore: String(stockBefore),
          stockAfter: String(stockAfter),
          delta: String((stockAfter - stockBefore).toFixed(3)),
          reason: body.note?.trim() || `Produksi BOM ${recipe.name}`,
          operatorId: session.user.id,
          operatorName: session.user.name,
        });

        await tx.insert(bomProductionRunItemsTable).values({
          id: crypto.randomUUID(),
          productionRunId,
          ingredientId: item.ingredientId,
          ingredientName: ingredient.name,
          ingredientUnit: ingredient.unit,
          consumedQuantity: String(requiredQty),
          unitCost,
          totalCost: Math.round(item.totalCost * batches),
        });
      }

      await tx.insert(stockTransactionsTable).values({
        id: crypto.randomUUID(),
        ingredientId: recipe.finishedIngredientId,
        type: "masuk",
        quantity: String(totalProduced),
        unitPrice: Math.round(recipe.totalCost / Number(recipe.yieldQuantity)),
        transactionDate: productionDate,
        clientRequestId: `${recipe.id}:${body.productionCount}:${recipe.finishedIngredientId}:${productionDate.toISOString()}:masuk`,
        operatorId: session.user.id,
        operatorName: session.user.name,
        note: body.note?.trim() || `Hasil produksi BOM ${recipe.name}`,
      });

      const finishedStockBefore = Number(finishedIngredient?.stock ?? 0);
      const finishedStockAfter = finishedStockBefore + totalProduced;
      await tx
        .update(ingredientsTable)
        .set({
          stock: sql`${ingredientsTable.stock} + ${String(totalProduced)}`,
          averagePrice: Math.round(recipe.totalCost / Number(recipe.yieldQuantity)),
          updatedAt: new Date(),
        })
        .where(eq(ingredientsTable.id, recipe.finishedIngredientId));
      await tx.insert(stockLedgerTable).values({
        id: crypto.randomUUID(),
        ingredientId: recipe.finishedIngredientId,
        source: "bom_production",
        referenceId: productionRunId,
        stockBefore: String(finishedStockBefore),
        stockAfter: String(finishedStockAfter),
        delta: String(totalProduced.toFixed(3)),
        reason: body.note?.trim() || `Hasil produksi BOM ${recipe.name}`,
        operatorId: session.user.id,
        operatorName: session.user.name,
      });

      await tx.insert(bomProductionRunsTable).values({
        id: productionRunId,
        bomRecipeId: recipe.id,
        finishedIngredientId: recipe.finishedIngredientId,
        batches: String(batches),
        producedQuantity: String(totalProduced),
        totalCost,
        productionDate,
        operatorId: session.user.id,
        operatorName: session.user.name,
        note: body.note,
      });
    });

    return ok({
      bomId: recipe.id,
      producedQuantity: totalProduced,
      totalCost,
      batches,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("tidak cukup") || error.message.includes("tidak ditemukan"))) {
      return badRequest(error.message);
    }

    return serverError(error);
  }
}
