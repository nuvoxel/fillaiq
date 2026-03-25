import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  usernameClient,
  organizationClient,
  apiKeyClient,
  magicLinkClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [adminClient(), usernameClient(), organizationClient(), apiKeyClient(), magicLinkClient(), passkeyClient()],
});
