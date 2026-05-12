import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function badRequest(message: string, issues?: unknown) {
  return NextResponse.json({ error: { message, issues } }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: { message } }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: { message } }, { status: 403 });
}

export function serverError(error: unknown) {
  if (error instanceof ZodError) {
    return badRequest("Validation failed", error.flatten());
  }

  console.error(error);
  return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
}
