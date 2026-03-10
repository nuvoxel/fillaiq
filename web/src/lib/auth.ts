import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username, organization, apiKey } from "better-auth/plugins";
import {
  genericOAuth,
  microsoftEntraId,
} from "better-auth/plugins/generic-oauth";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  trustedOrigins: [
    "https://fillaiq.com",
    "https://www.fillaiq.com",
  ],
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  plugins: [
    nextCookies(),
    admin(),
    username(),
    organization(),
    apiKey(),
    genericOAuth({
      config: [
        microsoftEntraId({
          clientId: process.env.MS_CLIENT_ID!,
          clientSecret: process.env.MS_CLIENT_SECRET!,
          tenantId: process.env.MS_TENANT_ID!,
        }),
      ],
    }),
  ],
});
