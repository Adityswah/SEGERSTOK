import { desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { ingredientsTable } from "@/db/schema";
import { getRole, requireSession } from "@/lib/api/authz";
import { badRequest, created, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";

const ingredientSchema = z.object({
  id: z.string().min(2).optional(),
  name: z.string().min(3).max(160),
  category: z.enum([
    "Protein & Daging",
    "Sayuran & Pelengkap",
    "Bumbu Basah & Rempah Segar",
    "Bahan Kering & Bumbu Kering",
  ]),
  unit: z.string().min(1).max(32),
  stock: z.coerce.number().nonnegative().default(0),
  minimumStock: z.coerce.number().nonnegative().default(0),
  averagePrice: z.coerce.number().int().nonnegative().default(0),
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
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can create master ingredients");

    const body = ingredientSchema.parse(await request.json());
    const id = body.id ?? crypto.randomUUID();
    const [row] = await db
      .insert(ingredientsTable)
      .values({
        id,
        name: body.name,
        category: body.category,
        unit: body.unit,
        stock: String(body.stock),
        minimumStock: String(body.minimumStock),
        averagePrice: body.averagePrice,
      })
      .returning();

    return created(row);
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Invalid JSON body");
    return serverError(error);
  }
}
