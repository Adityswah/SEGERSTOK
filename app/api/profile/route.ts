import { and, eq, ne } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";

import { db } from "@/db";
import { account, user } from "@/db/schema";
import { requireSession } from "@/lib/api/authz";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(190),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).max(128).optional(),
  })
  .refine((body) => !body.newPassword || body.currentPassword, {
    message: "Password lama wajib diisi untuk mengganti password",
    path: ["currentPassword"],
  });

export async function PATCH(request: Request) {
  try {
    const guard = guardMutation(request, { keyPrefix: "profile", limit: 12, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();

    const { data: body, response } = await parseJsonBody(request, profileSchema, 16_000);
    if (response) return response;

    const [duplicateEmail] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, body.email), ne(user.id, session.user.id)))
      .limit(1);
    if (duplicateEmail) return badRequest("Email sudah dipakai akun lain");

    const updated = await db.transaction(async (tx) => {
      if (body.newPassword) {
        const [credential] = await tx
          .select()
          .from(account)
          .where(and(eq(account.userId, session.user.id), eq(account.providerId, "credential")))
          .limit(1);
        if (!credential?.password) throw new Error("Credential account tidak ditemukan");

        const validPassword = await verifyPassword({ hash: credential.password, password: body.currentPassword ?? "" });
        if (!validPassword) throw new Error("Password lama tidak sesuai");

        await tx
          .update(account)
          .set({ password: await hashPassword(body.newPassword), updatedAt: new Date() })
          .where(eq(account.id, credential.id));
      }

      const [nextUser] = await tx
        .update(user)
        .set({
          name: body.name,
          email: body.email,
          ...(body.newPassword ? { mustChangePassword: false } : {}),
          updatedAt: new Date(),
        })
        .where(eq(user.id, session.user.id))
        .returning({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        });

      return nextUser;
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Password lama") || error.message.includes("Credential"))) {
      return badRequest(error.message);
    }
    return serverError(error);
  }
}
