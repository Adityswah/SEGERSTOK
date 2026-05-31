import { and, asc, eq, ne } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { db } from "@/db";
import { account, session as sessionTable, user } from "@/db/schema";
import { getRole, requireSession } from "@/lib/api/authz";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const resetPasswordSchema = z.object({
  action: z.literal("reset-password"),
  userId: z.string().min(1),
});

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const token = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `SJ-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
}

export async function GET() {
  try {
    const authSession = await requireSession();
    if (!authSession) return unauthorized();
    if (getRole(authSession) !== "Owner") return forbidden("Hanya Owner yang bisa mengelola karyawan");

    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(ne(user.role, "Owner"))
      .orderBy(asc(user.role), asc(user.name));

    return ok(rows);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "employees", limit: 10, windowMs: 60_000 });
    if (guard) return guard;

    const authSession = await requireSession();
    if (!authSession) return unauthorized();
    if (getRole(authSession) !== "Owner") return forbidden("Hanya Owner yang bisa reset password karyawan");

    const { data: body, response } = await parseJsonBody(request, resetPasswordSchema, 8_000);
    if (response) return response;
    if (body.userId === authSession.user.id) return badRequest("Owner tidak boleh reset password sendiri dari menu karyawan");

    const password = temporaryPassword();
    const result = await db.transaction(async (tx) => {
      const [employee] = await tx
        .select({ id: user.id, name: user.name, email: user.email, role: user.role })
        .from(user)
        .where(and(eq(user.id, body.userId), ne(user.role, "Owner")))
        .limit(1);

      if (!employee) throw new Error("Karyawan tidak ditemukan");

      const [credential] = await tx
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, employee.id), eq(account.providerId, "credential")))
        .limit(1);

      if (!credential) throw new Error("Credential karyawan tidak ditemukan");

      await tx
        .update(account)
        .set({ password: await hashPassword(password), updatedAt: new Date() })
        .where(eq(account.id, credential.id));

      await tx
        .update(user)
        .set({ mustChangePassword: true, updatedAt: new Date() })
        .where(eq(user.id, employee.id));

      await tx.delete(sessionTable).where(eq(sessionTable.userId, employee.id));

      return employee;
    });

    return ok({
      employee: result,
      temporaryPassword: password,
      mustChangePassword: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("ditemukan")) return badRequest(error.message);
    return serverError(error);
  }
}
