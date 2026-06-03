import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  ingredientsTable,
  ownerEvaluationsTable,
  stockLedgerTable,
  stockOpnameItemSummariesTable,
  stockOpnameRoleInputsTable,
  stockOpnameSessionsTable,
} from "@/db/schema";
import { getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";
import { getOpnameAssignments, type StaffRole } from "@/lib/opname";

const STOCK_OPNAME_TIME_ZONE = "Asia/Jakarta";
const STOCK_OPNAME_ALLOWED_DAY = 30;
const staffRoles = ["Kasir", "Cheef", "Waiters"] as const;

const roleInputSchema = z.object({
  action: z.literal("submit-role-input").default("submit-role-input"),
  opnameDate: z.coerce.date(),
  rows: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        actualQty: z.coerce.number().nonnegative(),
        note: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(500),
});

const finalSchema = z.object({
  action: z.literal("save-owner-final"),
  sessionId: z.string().min(1),
  rows: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        finalActual: z.coerce.number().nonnegative(),
        ownerFinalNote: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(500),
});

const finalizeSchema = z.object({
  action: z.literal("finalize"),
  sessionId: z.string().min(1),
});

const evaluationSchema = z.object({
  action: z.literal("save-evaluation"),
  sessionId: z.string().min(1),
  ingredientId: z.string().min(1).optional(),
  severity: z.enum(["low", "medium", "high"]).default("low"),
  suspectedCause: z.string().trim().min(2).max(240),
  ownerNote: z.string().trim().min(2).max(2000),
  actionItem: z.string().trim().min(2).max(2000),
  dueDate: z.coerce.date().optional(),
  status: z.enum(["open", "done"]).default("open"),
});

const opnameMutationSchema = z.discriminatedUnion("action", [
  roleInputSchema,
  finalSchema,
  finalizeSchema,
  evaluationSchema,
]);

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

function summarizeTotals(values: Array<{ actualQty: string | number }>) {
  return values.reduce((sum, item) => sum + Number(item.actualQty), 0);
}

function variancePercent(systemStock: number, finalActual: number) {
  if (systemStock === 0) return finalActual === 0 ? 0 : 100;
  return ((systemStock - finalActual) / systemStock) * 100;
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function ensureSessionForDate(tx: DbTransaction, opnameDate: Date, createdById: string, createdByName: string) {
  const [existing] = await tx
    .select()
    .from(stockOpnameSessionsTable)
    .where(and(eq(stockOpnameSessionsTable.opnameDate, opnameDate), eq(stockOpnameSessionsTable.status, "staff_input")))
    .limit(1);
  if (existing) return existing;

  const [latestOpen] = await tx
    .select()
    .from(stockOpnameSessionsTable)
    .where(inArray(stockOpnameSessionsTable.status, ["draft", "staff_input", "owner_review"]))
    .orderBy(desc(stockOpnameSessionsTable.createdAt))
    .limit(1);
  if (latestOpen && isAllowedOpnameDay(latestOpen.opnameDate)) return latestOpen;

  const [session] = await tx
    .insert(stockOpnameSessionsTable)
    .values({
      id: crypto.randomUUID(),
      opnameDate,
      status: "staff_input",
      createdById,
      createdByName,
    })
    .returning();
  return session;
}

async function getSessionPayload(sessionId?: string) {
  const sessions = await db.select().from(stockOpnameSessionsTable).orderBy(desc(stockOpnameSessionsTable.opnameDate)).limit(24);
  const selectedSession = sessionId ? sessions.find((session) => session.id === sessionId) : sessions[0];
  if (!selectedSession) return { sessions, selectedSession: null, summaries: [], roleInputs: [], evaluations: [] };

  const [summaries, roleInputs, evaluations] = await Promise.all([
    db
      .select()
      .from(stockOpnameItemSummariesTable)
      .where(eq(stockOpnameItemSummariesTable.sessionId, selectedSession.id)),
    db.select().from(stockOpnameRoleInputsTable).where(eq(stockOpnameRoleInputsTable.sessionId, selectedSession.id)),
    db.select().from(ownerEvaluationsTable).where(eq(ownerEvaluationsTable.sessionId, selectedSession.id)),
  ]);

  return { sessions, selectedSession, summaries, roleInputs, evaluations };
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read opname audit reports");

    const { searchParams } = new URL(request.url);
    return ok(await getSessionPayload(searchParams.get("sessionId") ?? undefined));
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "opname:hybrid", limit: 40, windowMs: 60_000 });
    if (guard) return guard;

    const authSession = await requireSession();
    if (!authSession) return unauthorized();
    const role = getRole(authSession);

    const { data: body, response } = await parseJsonBody(request, opnameMutationSchema, 256_000);
    if (response) return response;

    if (body.action === "submit-role-input") {
      const canSubmitInput = role === "Owner" || staffRoles.includes(role as StaffRole);
      if (!canSubmitInput) return forbidden("Role ini tidak bisa submit input opname");
      if (!isAllowedOpnameDay(new Date()) || !isAllowedOpnameDay(body.opnameDate)) {
        return forbidden(`Input opname karyawan hanya dibuka tanggal ${STOCK_OPNAME_ALLOWED_DAY} ${STOCK_OPNAME_TIME_ZONE}`);
      }

      const ingredientIds = Array.from(new Set(body.rows.map((row) => row.ingredientId)));
      const ingredients = await db.select().from(ingredientsTable).where(inArray(ingredientsTable.id, ingredientIds));
      if (ingredients.length !== ingredientIds.length) return badRequest("Ada product opname yang tidak ditemukan");
      const ingredientMap = new Map(ingredients.map((item) => [item.id, item]));

      const result = await db.transaction(async (tx) => {
        const opnameSession = await ensureSessionForDate(tx, body.opnameDate, authSession.user.id, authSession.user.name);
        if (opnameSession.status === "finalized") throw new Error("Opname sudah finalized");

        const summaryRows = body.rows.map((row) => {
          const ingredient = ingredientMap.get(row.ingredientId)!;
          const assignments = getOpnameAssignments({ name: ingredient.name, category: ingredient.category });
          return {
            id: crypto.randomUUID(),
            sessionId: opnameSession.id,
            ingredientId: ingredient.id,
            ingredientNameSnapshot: ingredient.name,
            categorySnapshot: ingredient.category,
            unitSnapshot: ingredient.unit,
            systemStockBefore: ingredient.stock,
            needsOwnerReview: assignments.length > 1,
          };
        });

        await tx.insert(stockOpnameItemSummariesTable).values(summaryRows).onConflictDoNothing();

        await tx
          .insert(stockOpnameRoleInputsTable)
          .values(
            body.rows.map((row) => {
              const ingredient = ingredientMap.get(row.ingredientId)!;
              const assignments = getOpnameAssignments({ name: ingredient.name, category: ingredient.category });
              const assignment = role === "Owner" ? {
            areaName: "Final aktual Owner",
            inputType: "primary" as const,
            role,
          } : assignments.find((item) => item.role === role) ?? {
            areaName: "Semua product",
            inputType: "primary" as const,
            role: role as StaffRole,
          };
              return {
              id: crypto.randomUUID(),
              sessionId: opnameSession.id,
              ingredientId: ingredient.id,
              role,
              areaName: assignment.areaName,
              inputType: assignment.inputType,
              actualQty: String(row.actualQty),
              note: row.note,
              inputById: authSession.user.id,
              inputByName: authSession.user.name,
              };
            }),
          )
          .onConflictDoUpdate({
            target: [
              stockOpnameRoleInputsTable.sessionId,
              stockOpnameRoleInputsTable.ingredientId,
              stockOpnameRoleInputsTable.role,
            ],
            set: {
              actualQty: sql`excluded.actual_qty`,
              note: sql`excluded.note`,
              inputById: authSession.user.id,
              inputByName: authSession.user.name,
              inputAt: new Date(),
            },
          });

        const allRoleInputs = await tx
          .select({
            ingredientId: stockOpnameRoleInputsTable.ingredientId,
            actualQty: stockOpnameRoleInputsTable.actualQty,
          })
          .from(stockOpnameRoleInputsTable)
          .where(
            and(
              eq(stockOpnameRoleInputsTable.sessionId, opnameSession.id),
              inArray(stockOpnameRoleInputsTable.ingredientId, ingredientIds),
            ),
          );
        const totalsByIngredient = new Map<string, number>();
        for (const input of allRoleInputs) {
          totalsByIngredient.set(input.ingredientId, (totalsByIngredient.get(input.ingredientId) ?? 0) + Number(input.actualQty));
        }

        for (const row of body.rows) {
          const ingredient = ingredientMap.get(row.ingredientId);
          if (!ingredient) continue;
          const totalRoleActual = totalsByIngredient.get(ingredient.id) ?? 0;
          const systemStock = Number(ingredient.stock);
          const ownerVarianceQty = systemStock - row.actualQty;
          await tx
            .update(stockOpnameItemSummariesTable)
            .set({
              totalRoleActual: String(totalRoleActual.toFixed(3)),
              ...(role === "Owner"
                ? {
                    finalActual: String(row.actualQty),
                    varianceQty: String(ownerVarianceQty.toFixed(3)),
                    variancePercent: String(variancePercent(systemStock, row.actualQty).toFixed(2)),
                    estimatedVarianceValue: 0,
                    ownerFinalNote: row.note ?? "Input final aktual Owner",
                  }
                : {}),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(stockOpnameItemSummariesTable.sessionId, opnameSession.id),
                eq(stockOpnameItemSummariesTable.ingredientId, ingredient.id),
              ),
            );
        }

        return opnameSession;
      });

      return created(await getSessionPayload(result.id));
    }

    if (role !== "Owner") return forbidden("Hanya Owner yang bisa mengubah final/evaluasi opname");

    if (body.action === "save-owner-final") {
      const sessionRows = await db
        .select()
        .from(stockOpnameSessionsTable)
        .where(eq(stockOpnameSessionsTable.id, body.sessionId))
        .limit(1);
      const opnameSession = sessionRows[0];
      if (!opnameSession) return badRequest("Sesi opname tidak ditemukan");
      if (opnameSession.status === "finalized") return forbidden("Opname finalized tidak bisa diedit");

      await db.transaction(async (tx) => {
        const summaries = await tx
          .select()
          .from(stockOpnameItemSummariesTable)
          .where(
            and(
              eq(stockOpnameItemSummariesTable.sessionId, body.sessionId),
              inArray(stockOpnameItemSummariesTable.ingredientId, body.rows.map((row) => row.ingredientId)),
            ),
          );
        const summaryMap = new Map(summaries.map((summary) => [summary.ingredientId, summary]));
        for (const row of body.rows) {
          const summary = summaryMap.get(row.ingredientId);
          if (!summary) continue;
          const systemStock = Number(summary.systemStockBefore);
          const varianceQty = systemStock - row.finalActual;
          await tx
            .update(stockOpnameItemSummariesTable)
            .set({
              finalActual: String(row.finalActual),
              varianceQty: String(varianceQty.toFixed(3)),
              variancePercent: String(variancePercent(systemStock, row.finalActual).toFixed(2)),
              estimatedVarianceValue: Math.round(varianceQty * 0),
              ownerFinalNote: row.ownerFinalNote,
              updatedAt: new Date(),
            })
            .where(eq(stockOpnameItemSummariesTable.id, summary.id));
        }
        await tx
          .update(stockOpnameSessionsTable)
          .set({ status: "owner_review", updatedAt: new Date() })
          .where(eq(stockOpnameSessionsTable.id, body.sessionId));
      });

      return ok(await getSessionPayload(body.sessionId));
    }

    if (body.action === "save-evaluation") {
      await db.insert(ownerEvaluationsTable).values({
        id: crypto.randomUUID(),
        sessionId: body.sessionId,
        ingredientId: body.ingredientId,
        severity: body.severity,
        suspectedCause: body.suspectedCause,
        ownerNote: body.ownerNote,
        actionItem: body.actionItem,
        dueDate: body.dueDate ? body.dueDate.toISOString().slice(0, 10) : undefined,
        status: body.status,
        createdById: authSession.user.id,
        createdByName: authSession.user.name,
      });
      return created(await getSessionPayload(body.sessionId));
    }

    const [opnameSession] = await db
      .select()
      .from(stockOpnameSessionsTable)
      .where(eq(stockOpnameSessionsTable.id, body.sessionId))
      .limit(1);
    if (!opnameSession) return badRequest("Sesi opname tidak ditemukan");
    if (opnameSession.status === "finalized") return forbidden("Opname sudah finalized");

    await db.transaction(async (tx) => {
      const summaries = await tx
        .select()
        .from(stockOpnameItemSummariesTable)
        .where(eq(stockOpnameItemSummariesTable.sessionId, body.sessionId));
      const missingFinal = summaries.find((item) => item.finalActual === null);
      if (missingFinal) throw new Error(`Final aktual ${missingFinal.ingredientNameSnapshot} belum diisi`);

      const ingredientIds = summaries.map((item) => item.ingredientId);
      const ingredients = ingredientIds.length
        ? await tx
            .select({ id: ingredientsTable.id, stock: ingredientsTable.stock })
            .from(ingredientsTable)
            .where(inArray(ingredientsTable.id, ingredientIds))
        : [];
      const ingredientStockMap = new Map(ingredients.map((ingredient) => [ingredient.id, Number(ingredient.stock)]));
      const ledgerRows = [];
      for (const item of summaries) {
        const finalActual = Number(item.finalActual);
        const stockBefore = ingredientStockMap.get(item.ingredientId);
        if (stockBefore === undefined) continue;
        await tx
          .update(ingredientsTable)
          .set({ stock: String(finalActual), updatedAt: new Date() })
          .where(eq(ingredientsTable.id, item.ingredientId));
        ledgerRows.push({
          id: crypto.randomUUID(),
          ingredientId: item.ingredientId,
          source: "monthly_opname_final" as const,
          referenceId: body.sessionId,
          stockBefore: String(stockBefore),
          stockAfter: String(finalActual),
          delta: String((finalActual - stockBefore).toFixed(3)),
          reason: item.ownerFinalNote ?? "Final opname bulanan",
          operatorId: authSession.user.id,
          operatorName: authSession.user.name,
        });
      }
      if (ledgerRows.length) await tx.insert(stockLedgerTable).values(ledgerRows);

      await tx
        .update(stockOpnameSessionsTable)
        .set({
          status: "finalized",
          finalizedById: authSession.user.id,
          finalizedByName: authSession.user.name,
          finalizedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stockOpnameSessionsTable.id, body.sessionId));
    });

    return ok(await getSessionPayload(body.sessionId));
  } catch (error) {
    return serverError(error);
  }
}
