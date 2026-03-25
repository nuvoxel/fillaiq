import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username, organization, apiKey, magicLink } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import {
  genericOAuth,
  microsoftEntraId,
} from "better-auth/plugins/generic-oauth";
import { EmailClient } from "@azure/communication-email";
import { db } from "@/db";
import * as schema from "@/db/schema";

let _emailClient: EmailClient | undefined;
function getEmailClient() {
  if (!_emailClient) {
    _emailClient = new EmailClient(process.env.ACS_CONNECTION_STRING!);
  }
  return _emailClient;
}

async function sendEmail(to: string, subject: string, html: string) {
  await getEmailClient().beginSend({
    senderAddress: process.env.ACS_SENDER_ADDRESS!,
    content: { subject, html },
    recipients: { to: [{ address: to }] },
  });
}

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
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Reset your FillaIQ password",
        `<p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p>`,
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Verify your FillaIQ email",
        `<p>Click the link below to verify your email address:</p><p><a href="${url}">${url}</a></p>`,
      );
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    nextCookies(),
    admin(),
    username(),
    organization(),
    apiKey(),
    passkey(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail(
          email,
          "Sign in to FillaIQ",
          `<p>Click the link below to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 5 minutes.</p>`,
        );
      },
    }),
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
