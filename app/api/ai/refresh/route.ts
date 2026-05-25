import { getRole, requireSession } from "@/lib/api/authz";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";
import { guardMutation } from "@/lib/api/security";
import { runAiPipeline } from "@/lib/ai/pipeline";

function hasValidCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  return bearer === secret;
}

async function refreshPipeline() {
  const result = await runAiPipeline();
  return ok({
    status: result.status,
    metrics: result.metrics,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  try {
    if (!hasValidCronSecret(request)) return unauthorized("Invalid cron secret");
    return await refreshPipeline();
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const guard = guardMutation(request, { limit: 5, windowMs: 60_000 });
    if (guard) return guard;

    const session = await requireSession();
    if (!session) return unauthorized();
    if (getRole(session) !== "Owner") return forbidden("Only Owner can trigger AI refresh manually");

    return await refreshPipeline();
  } catch (error) {
    return serverError(error);
  }
}
