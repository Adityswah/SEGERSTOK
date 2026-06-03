import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  financeTransactionsTable,
  ingredientsTable,
  stockLedgerTable,
  stockTransactionsTable,
} from "@/db/schema";
import { canInputFinance, canReadFinance, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";
import { generateTransactionNo } from "@/lib/api/transaction-number";

const financeTransactionItemSchema = z.object({
  ingredientId: z.string().trim().min(1).optional(),
  itemName: z.string().trim().min(1).max(160).optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().int().positive(),
});

const financeTransactionSchema = z.object({
  type: z.enum(["pendapatan", "pengeluaran"]),
  fundMethod: z.enum(["cash", "bank"]),
  category: z.enum(["keperluan_stock", "non_keperluan_stock"]).optional(),
  subcategory: z.string().trim().min(1).max(160).optional(),
  ingredientId: z.string().trim().min(1).optional(),
  itemName: z.string().trim().min(1).max(160).optional(),
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().int().positive().optional(),
  items: z.array(financeTransactionItemSchema).min(1).max(20).optional(),
  transactionDate: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
  attachmentName: z.string().trim().max(240).optional(),
});

const financeTransactionEditSchema = z.object({
  id: z.string().trim().min(1),
  fundMethod: z.enum(["cash", "bank"]).optional(),
  itemName: z.string().trim().min(1).max(160).optional(),
  quantity: z.coerce.number().positive().optional(),
  unitPrice: z.coerce.number().int().positive().optional(),
  transactionDate: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});

function financeWhereClause(role: ReturnType<typeof getRole>, userId: string, start: Date | null, end: Date | null) {
  const clauses = [isNull(financeTransactionsTable.deletedAt)];
  if (!canReadFinance(role)) clauses.push(eq(financeTransactionsTable.operatorId, userId));
  if (start) clauses.push(gte(financeTransactionsTable.transactionDate, start));
  if (end) clauses.push(lte(financeTransactionsTable.transactionDate, end));
  return and(...clauses);
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    const role = getRole(session);
    if (!canInputFinance(role)) return forbidden("Role ini tidak bisa mengakses finance");

    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit") ?? 500);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 500;
    const start = url.searchParams.get("start") ? new Date(String(url.searchParams.get("start"))) : null;
    const end = url.searchParams.get("end") ? new Date(String(url.searchParams.get("end"))) : null;

    const rows = await db
      .select()
      .from(financeTransactionsTable)
      .where(financeWhereClause(role, session.user.id, start, end))
      .orderBy(desc(financeTransactionsTable.transactionDate), desc(financeTransactionsTable.createdAt))
      .limit(limit);

    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "finance:transactions", limit: 40, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    const role = getRole(session);
    if (!canInputFinance(role)) return forbidden("Role ini tidak bisa input finance");

    const { data: body, response } = await parseJsonBody(request, financeTransactionSchema, 80_000);
    if (response) return response;

    const category: "keperluan_stock" | "non_keperluan_stock" =
      body.type === "pendapatan" ? "non_keperluan_stock" : body.category ?? "non_keperluan_stock";
    const subcategory =
      body.type === "pendapatan"
        ? "Pendapatan"
        : body.category === "non_keperluan_stock"
          ? body.subcategory ?? "Non Keperluan Stock"
          : body.subcategory;
    const items = body.items ?? [
      {
        ingredientId: body.ingredientId,
        itemName: body.itemName,
        quantity: body.quantity ?? 1,
        unitPrice: body.unitPrice ?? 0,
      },
    ];

    if (body.type === "pendapatan" && category === "keperluan_stock") {
      return badRequest("Pendapatan tidak boleh memakai kategori Keperluan Stock");
    }
    if (body.type === "pengeluaran" && category === "keperluan_stock" && items.some((item) => !item.ingredientId)) {
      return badRequest("Pengeluaran Keperluan Stock wajib memilih barang dari Master Data");
    }

    if (items.some((item) => !Number.isFinite(item.quantity * item.unitPrice) || item.quantity * item.unitPrice <= 0)) {
      return badRequest("Jumlah transaksi tidak valid");
    }

    const transactionDate = body.transactionDate ?? new Date();
    const transactionNo = generateTransactionNo(body.type === "pendapatan" ? "FIN-IN" : "FIN-OUT", transactionDate);

    const rows = await db.transaction(async (tx) => {
      const ingredientIds = category === "keperluan_stock"
        ? Array.from(new Set(items.map((item) => item.ingredientId!).filter(Boolean)))
        : [];
      const ingredients = ingredientIds.length
        ? await tx
            .select()
            .from(ingredientsTable)
            .where(and(inArray(ingredientsTable.id, ingredientIds), eq(ingredientsTable.active, true)))
        : [];
      if (ingredients.length !== ingredientIds.length) throw new Error("Barang Master Data tidak ditemukan");

      const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
      const stockRunning = new Map(ingredients.map((ingredient) => [ingredient.id, Number(ingredient.stock)]));
      const stockDeltaByIngredient = new Map<string, number>();
      const preparedRows = items.map((item) => {
        const ingredient = item.ingredientId ? ingredientMap.get(item.ingredientId) : null;
        const financeId = crypto.randomUUID();
        const stockTransactionId = body.type === "pengeluaran" && category === "keperluan_stock" ? crypto.randomUUID() : null;
        const quantity = item.quantity;
        const unitPrice = item.unitPrice;
        const stockBefore = ingredient ? stockRunning.get(ingredient.id) ?? Number(ingredient.stock) : 0;
        const stockAfter = ingredient ? stockBefore + quantity : 0;
        if (ingredient) {
          stockRunning.set(ingredient.id, stockAfter);
          stockDeltaByIngredient.set(ingredient.id, (stockDeltaByIngredient.get(ingredient.id) ?? 0) + quantity);
        }
        return {
          financeId,
          stockTransactionId,
          ingredient,
          item,
          stockBefore,
          stockAfter,
          totalAmount: Math.round(quantity * unitPrice),
        };
      });

      const financeRows = await tx
        .insert(financeTransactionsTable)
        .values(
          preparedRows.map(({ financeId, stockTransactionId, ingredient, item, totalAmount }) => ({
            id: financeId,
            transactionNo,
            type: body.type,
            fundMethod: body.fundMethod,
            category,
            subcategory: ingredient ? ingredient.category : subcategory ?? "Pendapatan",
            ingredientId: ingredient?.id ?? null,
            itemName: ingredient?.name ?? item.itemName ?? subcategory ?? "Pendapatan",
            quantity: String(item.quantity),
            unit: ingredient?.unit ?? (body.type === "pendapatan" ? "transaksi" : "item"),
            unitPrice: item.unitPrice,
            totalAmount,
            transactionDate,
            note: body.note,
            attachmentName: body.attachmentName,
            linkedStockTransactionId: stockTransactionId,
            operatorId: session.user.id,
            operatorName: session.user.name,
          })),
        )
        .returning();

      const stockRows = preparedRows.filter((row) => row.ingredient && row.stockTransactionId);
      if (stockRows.length) {
        await tx.insert(stockTransactionsTable).values(
          stockRows.map(({ financeId, stockTransactionId, ingredient, item }) => ({
            id: stockTransactionId!,
            transactionNo,
            ingredientId: ingredient!.id,
            type: "masuk" as const,
            quantity: String(item.quantity),
            unitPrice: item.unitPrice,
            financeTransactionId: financeId,
            transactionDate,
            clientRequestId: `finance:${financeId}`,
            operatorId: session.user.id,
            operatorName: session.user.name,
            note: body.note ? `Finance Keperluan Stock - ${body.note}` : "Finance Keperluan Stock",
          })),
        );

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
          stockRows.map(({ stockTransactionId, ingredient, item, stockBefore, stockAfter }) => ({
            id: crypto.randomUUID(),
            ingredientId: ingredient!.id,
            source: "stock_in" as const,
            referenceId: stockTransactionId,
            stockBefore: String(stockBefore),
            stockAfter: String(stockAfter),
            delta: String(item.quantity.toFixed(3)),
            reason: body.note ? `Finance Keperluan Stock - ${body.note}` : "Finance Keperluan Stock",
            operatorId: session.user.id,
            operatorName: session.user.name,
          })),
        );
      }

      return financeRows;
    });

    return created(rows.length === 1 ? rows[0] : { inserted: rows.length, rows });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("tidak ditemukan") || error.message.includes("Subkategori"))) {
      return badRequest(error.message);
    }

    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "finance:transactions:edit", limit: 30, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Hanya Owner yang bisa edit data finance");

    const { data: body, response } = await parseJsonBody(request, financeTransactionEditSchema, 16_000);
    if (response) return response;

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(financeTransactionsTable)
        .where(and(eq(financeTransactionsTable.id, body.id), isNull(financeTransactionsTable.deletedAt)))
        .limit(1);

      if (!current) throw new Error("Transaksi finance tidak ditemukan");

      const nextQuantity = body.quantity ?? Number(current.quantity);
      const nextUnitPrice = body.unitPrice ?? current.unitPrice;
      const nextTotalAmount = Math.round(nextQuantity * nextUnitPrice);
      const nextTransactionDate = body.transactionDate ?? current.transactionDate;
      const nextNote = body.note ?? current.note ?? undefined;
      const nextItemName =
        current.category === "keperluan_stock" && current.ingredientId
          ? current.itemName
          : body.itemName ?? current.itemName;

      if (current.category === "keperluan_stock" && current.ingredientId) {
        const quantityBefore = Number(current.quantity);
        const quantityDelta = nextQuantity - quantityBefore;

        if (quantityDelta !== 0) {
          const [ingredientBefore] = await tx
            .select({ stock: ingredientsTable.stock })
            .from(ingredientsTable)
            .where(eq(ingredientsTable.id, current.ingredientId))
            .limit(1);

          if (!ingredientBefore) throw new Error("Barang Master Data tidak ditemukan");

          const stockBefore = Number(ingredientBefore.stock);
          const stockAfter = stockBefore + quantityDelta;
          if (stockAfter < 0) throw new Error("Edit finance membuat stock menjadi minus");

          await tx
            .update(ingredientsTable)
            .set({
              stock: sql`${ingredientsTable.stock} + ${String(quantityDelta)}`,
              updatedAt: new Date(),
            })
            .where(eq(ingredientsTable.id, current.ingredientId));

          await tx.insert(stockLedgerTable).values({
            id: crypto.randomUUID(),
            ingredientId: current.ingredientId,
            source: "stock_in",
            referenceId: current.linkedStockTransactionId ?? current.id,
            stockBefore: String(stockBefore),
            stockAfter: String(stockAfter),
            delta: String(quantityDelta.toFixed(3)),
            reason: nextNote ? `Edit Finance Keperluan Stock - ${nextNote}` : "Edit Finance Keperluan Stock",
            operatorId: session.user.id,
            operatorName: session.user.name,
          });
        }

        if (current.linkedStockTransactionId) {
          await tx
            .update(stockTransactionsTable)
            .set({
              quantity: String(nextQuantity),
              unitPrice: nextUnitPrice,
              transactionDate: nextTransactionDate,
              note: nextNote ? `Finance Keperluan Stock - ${nextNote}` : "Finance Keperluan Stock",
            })
            .where(eq(stockTransactionsTable.id, current.linkedStockTransactionId));
        }
      }

      const [financeRow] = await tx
        .update(financeTransactionsTable)
        .set({
          fundMethod: body.fundMethod ?? current.fundMethod,
          itemName: nextItemName,
          quantity: String(nextQuantity),
          unitPrice: nextUnitPrice,
          totalAmount: nextTotalAmount,
          transactionDate: nextTransactionDate,
          note: nextNote,
          updatedAt: new Date(),
        })
        .where(eq(financeTransactionsTable.id, current.id))
        .returning();

      return financeRow;
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("ditemukan") || error.message.includes("minus"))) {
      return badRequest(error.message);
    }

    return serverError(error);
  }
}
