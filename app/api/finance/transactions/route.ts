import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  financeTransactionsTable,
  ingredientMasterOptionsTable,
  ingredientsTable,
  stockLedgerTable,
  stockTransactionsTable,
} from "@/db/schema";
import { canInputFinance, canReadFinance, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

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
    const subcategory = body.type === "pendapatan" ? "Pendapatan" : body.subcategory;
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
    if (body.type === "pengeluaran" && !subcategory) {
      return badRequest("Subkategori pengeluaran wajib dipilih");
    }
    if (body.type === "pengeluaran" && category === "keperluan_stock" && items.some((item) => !item.ingredientId)) {
      return badRequest("Pengeluaran Keperluan Stock wajib memilih barang dari Master Data");
    }

    if (items.some((item) => !Number.isFinite(item.quantity * item.unitPrice) || item.quantity * item.unitPrice <= 0)) {
      return badRequest("Jumlah transaksi tidak valid");
    }

    const rows = await db.transaction(async (tx) => {
      if (category === "non_keperluan_stock" && body.type === "pengeluaran") {
        const [subcategoryOption] = await tx
          .select({ id: ingredientMasterOptionsTable.id })
          .from(ingredientMasterOptionsTable)
          .where(
            and(
              eq(ingredientMasterOptionsTable.type, "finance_non_stock_subcategory"),
              eq(ingredientMasterOptionsTable.value, subcategory!),
              eq(ingredientMasterOptionsTable.active, true),
            ),
          )
          .limit(1);

        if (!subcategoryOption) throw new Error("Subkategori non-stock belum terdaftar di Master Data");
      }

      const savedRows = [];
      for (const item of items) {
        let stockTransactionId: string | null = null;
        let itemName = item.itemName ?? subcategory ?? "Pendapatan";
        let unit = body.type === "pendapatan" ? "transaksi" : "item";
        let ingredientId: string | null = null;

        if (category === "keperluan_stock") {
          const [ingredient] = await tx
            .select()
            .from(ingredientsTable)
            .where(and(eq(ingredientsTable.id, item.ingredientId!), eq(ingredientsTable.active, true)))
            .limit(1);

          if (!ingredient) throw new Error("Barang Master Data tidak ditemukan");
          if (ingredient.category !== subcategory) throw new Error("Subkategori tidak sesuai kategori stock barang");

          ingredientId = ingredient.id;
          itemName = ingredient.name;
          unit = ingredient.unit;
        }

        const financeId = crypto.randomUUID();
        const totalAmount = Math.round(item.quantity * item.unitPrice);
        const [financeRow] = await tx
          .insert(financeTransactionsTable)
          .values({
            id: financeId,
            type: body.type,
            fundMethod: body.fundMethod,
            category,
            subcategory: subcategory ?? "Pendapatan",
            ingredientId,
            itemName,
            quantity: String(item.quantity),
            unit,
            unitPrice: item.unitPrice,
            totalAmount,
            transactionDate: body.transactionDate ?? new Date(),
            note: body.note,
            attachmentName: body.attachmentName,
            operatorId: session.user.id,
            operatorName: session.user.name,
          })
          .returning();

        if (body.type === "pengeluaran" && category === "keperluan_stock" && ingredientId) {
          const [ingredientBefore] = await tx
            .select({ stock: ingredientsTable.stock })
            .from(ingredientsTable)
            .where(eq(ingredientsTable.id, ingredientId))
            .limit(1);

          if (!ingredientBefore) throw new Error("Barang Master Data tidak ditemukan");
          const stockBefore = Number(ingredientBefore.stock);
          const stockAfter = stockBefore + item.quantity;

          const [stockTransaction] = await tx
            .insert(stockTransactionsTable)
            .values({
              id: crypto.randomUUID(),
              ingredientId,
              type: "masuk",
              quantity: String(item.quantity),
              unitPrice: item.unitPrice,
              financeTransactionId: financeId,
              transactionDate: body.transactionDate ?? new Date(),
              clientRequestId: `finance:${financeId}`,
              operatorId: session.user.id,
              operatorName: session.user.name,
              note: body.note ? `Finance Keperluan Stock - ${body.note}` : "Finance Keperluan Stock",
            })
            .returning();

          stockTransactionId = stockTransaction.id;

          await tx
            .update(ingredientsTable)
            .set({
              stock: sql`${ingredientsTable.stock} + ${String(item.quantity)}`,
              updatedAt: new Date(),
            })
            .where(eq(ingredientsTable.id, ingredientId));

          await tx.insert(stockLedgerTable).values({
            id: crypto.randomUUID(),
            ingredientId,
            source: "stock_in",
            referenceId: stockTransaction.id,
            stockBefore: String(stockBefore),
            stockAfter: String(stockAfter),
            delta: String(item.quantity.toFixed(2)),
            reason: body.note ? `Finance Keperluan Stock - ${body.note}` : "Finance Keperluan Stock",
            operatorId: session.user.id,
            operatorName: session.user.name,
          });

          await tx
            .update(financeTransactionsTable)
            .set({ linkedStockTransactionId: stockTransactionId, updatedAt: new Date() })
            .where(eq(financeTransactionsTable.id, financeId));
        }

        savedRows.push({ ...financeRow, linkedStockTransactionId: stockTransactionId });
      }

      return savedRows;
    });

    return created(rows.length === 1 ? rows[0] : { inserted: rows.length, rows });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("tidak ditemukan") || error.message.includes("Subkategori"))) {
      return badRequest(error.message);
    }

    return serverError(error);
  }
}
