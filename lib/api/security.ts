import { ZodError, type ZodType } from "zod";

import { badRequest, forbidden, payloadTooLarge, tooManyRequests } from "@/lib/api/responses";

type RateLimitOptions = {
  limit?: number;
  windowMs?: number;
  keyPrefix?: string;
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

function getExpectedOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;

  const proto =
    request.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : new URL(request.url).protocol.replace(":", ""));

  return `${proto}://${host}`;
}

export function guardSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const expectedOrigin = getExpectedOrigin(request);
  if (!expectedOrigin) return forbidden("Origin tidak valid");

  try {
    const originUrl = new URL(origin);
    const expectedUrl = new URL(expectedOrigin);
    if (originUrl.host !== expectedUrl.host || originUrl.protocol !== expectedUrl.protocol) {
      return forbidden("Cross-origin request ditolak");
    }
  } catch {
    return forbidden("Origin tidak valid");
  }

  return null;
}

export function guardRateLimit(request: Request, options: RateLimitOptions = {}) {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60_000;
  const key = `${options.keyPrefix ?? new URL(request.url).pathname}:${getClientIp(request)}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= limit) return tooManyRequests("Terlalu banyak request, coba lagi sebentar");
  bucket.count += 1;
  return null;
}

export function guardMutation(request: Request, options?: RateLimitOptions) {
  return guardSameOrigin(request) ?? guardRateLimit(request, options);
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>, maxBytes = 64_000) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { data: null, response: payloadTooLarge("Payload terlalu besar") };
  }

  try {
    const raw = text ? JSON.parse(text) : {};
    return { data: schema.parse(raw), response: null };
  } catch (error) {
    if (error instanceof SyntaxError) return { data: null, response: badRequest("Invalid JSON body") };
    if (error instanceof ZodError) return { data: null, response: badRequest("Validation failed", error.flatten()) };
    throw error;
  }
}
