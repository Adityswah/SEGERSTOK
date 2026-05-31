import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
  drizzleDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function getConnectionString() {
  return process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:55432/sotostock";
}

export function getClient() {
  if (!globalForDb.postgresClient) {
    globalForDb.postgresClient = postgres(getConnectionString(), {
      connect_timeout: 10,
      idle_timeout: 20,
      max: process.env.NODE_ENV === "production" ? 3 : 5,
      prepare: false,
    });
  }
  return globalForDb.postgresClient;
}

export function getDb() {
  if (!globalForDb.drizzleDb) {
    globalForDb.drizzleDb = drizzle(getClient(), { schema });
  }
  return globalForDb.drizzleDb;
}

export const client = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver);
  },
});

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});
