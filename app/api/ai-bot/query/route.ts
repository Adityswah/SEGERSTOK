import { z } from "zod";

import { handleAiBotMessage } from "@/lib/ai/bot-orchestrator";
import { getRole, requireSession } from "@/lib/api/authz";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation, parseJsonBody } from "@/lib/api/security";

const querySchema = z.object({
  message: z.string().min(2).max(500),
  activePage: z
    .enum(["dashboard", "stok", "ai", "laporan", "bahan", "pengaturan", "other"])
    .default("other"),
});

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 20, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("AI Bot hanya tersedia untuk role Owner");

    const { data: payload, response } = await parseJsonBody(request, querySchema, 16_000);
    if (response) return response;

    const result = await handleAiBotMessage({
      message: payload.message,
      userId: session.user.id,
    });

    return ok({
      reply: result.reply,
      intent: result.intent,
      flow: result.flow,
      asOf: result.asOf,
      latestRun: result.latestRun,
      risks: result.risks,
      weeklyProjection: result.weeklyProjection,
      buyRecommendations: result.buyRecommendations,
      relatedIngredients: result.relatedIngredients,
      integratedFeatures: [
        "dashboard",
        "stok",
        "rekomendasi waktu beli",
        "proyeksi stok mingguan",
        "laporan",
        "master bahan",
        "pengaturan",
      ],
      excludedFeatures: ["stok masuk", "stok keluar", "data aktual lapangan"],
    });
  } catch (error) {
    return serverError(error);
  }
}
