import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { z } from "zod";

import { db } from "@/db";
import * as schema from "@/db/schema";

const publicSignupRoleSchema = z.enum(["Kasir", "Cheef", "Waiters"]);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "Kasir",
        validator: {
          input: publicSignupRoleSchema,
        },
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (user.role === "Owner") {
            return {
              data: {
                role: "Kasir",
              },
            };
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
