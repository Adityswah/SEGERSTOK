import { forbidden } from "@/lib/api/responses";
import { guardMutation } from "@/lib/api/security";
import { allowPublicSignup, auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const guard = guardMutation(request, { keyPrefix: "auth", limit: 20, windowMs: 60_000 });
  if (guard) return guard;

  if (!allowPublicSignup && new URL(request.url).pathname.includes("/sign-up")) {
    return forbidden("Pendaftaran publik ditutup. Akun baru harus dibuat oleh Owner/admin.");
  }

  return handler.POST(request);
}
