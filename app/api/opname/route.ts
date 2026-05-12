import { desc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { stockOpnameDetailsTable, stockOpnameTable } from "@/db/schema";
import { canWriteActual, getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";

const opnameDetailSchema = z.object({
  ingredientId: z.string().min(1),
  systemStock: z.coerce.number().nonnegative(),
  cashierActual: z.coerce.number().nonnegative().optional(),
  chefActual: z.coerce.number().nonnegative().optional(),
  waitersActual: z.coerce.number().nonnegative().optional(),
  note: z.string().max(500).optional(),
});

const opnameSchema = z.object({
  opnameDate: z.coerce.date(),
  createdByName: z.string().min(2).max(80),
  status: z.enum(["draft", "submitted", "approved"]).default("submitted"),
  details: z.array(opnameDetailSchema).min(1),
});

const STOCK_OPNAME_TIME_ZONE = "Asia/Jakarta";
const STOCK_OPNAME_ALLOWED_DAY = 30;

function getDayOfMonthInTimeZone(date: Date, timeZone: string) {
  const dayPart = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    timeZone,
  })
    .formatToParts(date)
    .find((part) => part.type === "day");

  return dayPart ? Number(dayPart.value) : Number.NaN;
}

function isAllowedOpnameDay(date: Date) {
  return getDayOfMonthInTimeZone(date, STOCK_OPNAME_TIME_ZONE) === STOCK_OPNAME_ALLOWED_DAY;
}

function calculateFinal(detail: z.infer<typeof opnameDetailSchema>) {
  const values = [detail.cashierActual, detail.chefActual, detail.waitersActual].filter(
    (value): value is number => typeof value === "number",
  );

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read opname reports");

    const rows = await db.select().from(stockOpnameTable).orderBy(desc(stockOpnameTable.opnameDate)).limit(24);
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
    if (!canWriteActual(role)) return forbidden("This role cannot submit actual stock data");

    const body = opnameSchema.parse(await request.json());
    if (!isAllowedOpnameDay(new Date()) || !isAllowedOpnameDay(body.opnameDate)) {
      return forbidden(
        `Actual stock input is only allowed on day ${STOCK_OPNAME_ALLOWED_DAY} in ${STOCK_OPNAME_TIME_ZONE}`,
      );
    }

    const result = await db.transaction(async (tx) => {
      const [opname] = await tx
        .insert(stockOpnameTable)
        .values({
          id: crypto.randomUUID(),
          opnameDate: body.opnameDate,
          status: body.status,
          createdById: session.user.id,
          createdByName: body.createdByName,
        })
        .returning();

      const details = await tx
        .insert(stockOpnameDetailsTable)
        .values(
          body.details.map((detail) => {
            const finalActual = calculateFinal(detail);
            const variance = finalActual === null ? null : detail.systemStock - finalActual;
            return {
              id: crypto.randomUUID(),
              opnameId: opname.id,
              ingredientId: detail.ingredientId,
              systemStock: String(detail.systemStock),
              cashierActual: detail.cashierActual === undefined ? null : String(detail.cashierActual),
              chefActual: detail.chefActual === undefined ? null : String(detail.chefActual),
              waitersActual: detail.waitersActual === undefined ? null : String(detail.waitersActual),
              finalActual: finalActual === null ? null : String(finalActual.toFixed(2)),
              variance: variance === null ? null : String(variance.toFixed(2)),
              note: detail.note,
            };
          }),
        )
        .returning();

      return { opname, details };
    });

    return created(result);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    return serverError(error);
  }
}
