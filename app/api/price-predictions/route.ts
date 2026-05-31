import { getRole, requireSession } from "@/lib/api/authz";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation } from "@/lib/api/security";

const DISABLED_MESSAGE =
  "AI prediksi kenaikan harga bahan berbasis berita nasional sudah dinonaktifkan. Gunakan rekomendasi waktu beli dan proyeksi stok mingguan.";

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can read AI operational data");

    return ok([]);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 15, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can manage AI operational data");

    return forbidden(DISABLED_MESSAGE);
  } catch (error) {
    return serverError(error);
  }
}
