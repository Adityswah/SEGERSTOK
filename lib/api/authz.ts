import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import type { Role } from "@/lib/data";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export function getRole(session: Awaited<ReturnType<typeof getSession>>) {
  return (session?.user.role ?? "Kasir") as Role;
}

export function canReadOwnerData(role: Role) {
  return role === "Owner";
}

export function canWriteStock(role: Role) {
  return ["Owner", "Kasir", "Cheef", "Waiters"].includes(role);
}

export function canWriteActual(role: Role) {
  return ["Owner", "Kasir", "Cheef", "Waiters"].includes(role);
}
