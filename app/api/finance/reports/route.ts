import { and, eq, gte, isNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { financeTransactionsTable } from "@/db/schema";
import { canReadFinance, getRole, requireSession } from "@/lib/api/authz";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    const role = getRole(session);
    if (!canReadFinance(role)) return forbidden("Only Owner can read finance reports");

    const url = new URL(request.url);
    const start = url.searchParams.get("start") ? new Date(String(url.searchParams.get("start"))) : null;
    const end = url.searchParams.get("end") ? new Date(String(url.searchParams.get("end"))) : null;
    const clauses = [isNull(financeTransactionsTable.deletedAt)];
    if (start) clauses.push(gte(financeTransactionsTable.transactionDate, start));
    if (end) clauses.push(lte(financeTransactionsTable.transactionDate, end));

    const rows = await db.select().from(financeTransactionsTable).where(and(...clauses));
    const summary = rows.reduce(
      (acc, row) => {
        const amount = row.totalAmount;
        const method = row.fundMethod;
        if (row.type === "pendapatan") {
          acc.income += amount;
          acc.cashIn += method === "cash" ? amount : 0;
          acc.bankIn += method === "bank" ? amount : 0;
        } else {
          acc.expense += amount;
          acc.cashOut += method === "cash" ? amount : 0;
          acc.bankOut += method === "bank" ? amount : 0;
        }
        return acc;
      },
      { bankIn: 0, bankOut: 0, cashIn: 0, cashOut: 0, expense: 0, income: 0 },
    );

    return ok({
      ...summary,
      bankBalance: summary.bankIn - summary.bankOut,
      cashBalance: summary.cashIn - summary.cashOut,
      netCashFlow: summary.income - summary.expense,
      profitLoss: summary.income - summary.expense,
    });
  } catch (error) {
    return serverError(error);
  }
}
