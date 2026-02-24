import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  usernameClient,
  organizationClient,
  apiKeyClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient(), usernameClient(), organizationClient(), apiKeyClient()],
});
