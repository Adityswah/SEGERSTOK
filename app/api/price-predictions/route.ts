import { desc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { pricePredictionsTable } from "@/db/schema";
import { getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";

const predictionSchema = z.object({
  ingredientId: z.string().min(1).optional(),
  itemName: z.string().min(2).max(160),
  currentPrice: z.coerce.number().int().nonnegative(),
  predictedPrice: z.coerce.number().int().nonnegative(),
  changePercent: z.coerce.number(),
  risk: z.enum(["Rendah", "Sedang", "Tinggi"]),
  sourceName: z.string().min(2).max(160),
  sourceUrl: z.string().url(),
  summary: z.string().min(10),
  publishedAt: z.coerce.date().optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read price predictions");

    const rows = await db
      .select()
      .from(pricePredictionsTable)
      .orderBy(desc(pricePredictionsTable.createdAt))
      .limit(50);

    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can create price predictions");

    const body = predictionSchema.parse(await request.json());
    const [row] = await db
      .insert(pricePredictionsTable)
      .values({
        id: crypto.randomUUID(),
        ingredientId: body.ingredientId,
        itemName: body.itemName,
        currentPrice: body.currentPrice,
        predictedPrice: body.predictedPrice,
        changePercent: String(body.changePercent),
        risk: body.risk,
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
        summary: body.summary,
        publishedAt: body.publishedAt,
      })
      .returning();

    return created(row);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    return serverError(error);
  }
}
