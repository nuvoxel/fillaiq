import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import DeleteIcon from "@mui/icons-material/Delete";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getUserProfile, listApiKeys, getUserPreferences } from "@/lib/actions/dashboard";
import { SettingsPreferences } from "./preferences";
import { LabelTemplatesCard } from "@/components/settings/label-templates-card";
import { OrganizationCard } from "@/components/settings/organization-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { ApiKeysCard } from "@/components/settings/api-keys-card";
// Print jobs moved to Hardware > Printers tab

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const [userResult, keysResult] = await Promise.allSettled([
    userId ? getUserProfile(userId) : Promise.reject("no session"),
    listApiKeys(),
  ]);

  const user =
    userResult.status === "fulfilled" && userResult.value.data
      ? userResult.value.data
      : null;
  const apiKeys =
    keysResult.status === "fulfilled" && keysResult.value.data
      ? keysResult.value.data
      : [];

  // Load preferences for the current user
  let prefs = { autoArchiveEmpty: false };
  if (user) {
    const prefsResult = await getUserPreferences(user.id);
    if (prefsResult.data) {
      prefs = prefsResult.data;
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account and preferences."
      />

      <Stack spacing={3}>
        {/* Profile */}
        {user && (
          <ProfileCard
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              username: user.username ?? null,
              image: user.image ?? null,
              role: user.role ?? null,
            }}
          />
        )}

        {/* Organization */}
        <OrganizationCard />

        {/* Preferences */}
        <SettingsPreferences
          userId={user?.id ?? null}
          initialPrefs={prefs}
        />

        {/* Label Templates */}
        <LabelTemplatesCard />

        {/* API Keys */}
        <ApiKeysCard initialApiKeys={apiKeys} />

        {/* Danger Zone */}
        <Card sx={{ borderColor: "error.main" }}>
          <CardHeader
            title="Danger Zone"
            titleTypographyProps={{ fontWeight: 600, color: "error.main" }}
          />
          <Divider sx={{ borderColor: "error.light" }} />
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography fontWeight={500}>Delete Account</Typography>
                <Typography variant="body2" color="text.secondary">
                  Permanently delete your account and all associated data.
                </Typography>
              </Box>
              <Button variant="outlined" color="error" startIcon={<DeleteIcon />}>
                Delete Account
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </div>
  );
}
