import { AlertTriangle, Trash2 } from "lucide-react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getUserProfile, listApiKeys, getUserPreferences } from "@/lib/actions/dashboard";
import { SettingsPreferences } from "./preferences";
import { LabelTemplatesCard } from "@/components/settings/label-templates-card";
import { OrganizationCard } from "@/components/settings/organization-card";
import { ProfileCard } from "@/components/settings/profile-card";
import { ApiKeysCard } from "@/components/settings/api-keys-card";

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
        description="Configure your workspace identity, preferences, and developer tools."
      />

      <div className="flex flex-col gap-3 max-w-[720px]">
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
        <Card className="rounded-xl shadow-sm border-2 border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="size-5 text-destructive" />
              <h3 className="font-display font-bold text-xl text-destructive">
                Danger Zone
              </h3>
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="max-w-[420px]">
                <p className="text-sm font-semibold mb-0.5">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently remove all your organization data, spools, and
                  analytics. This action is irreversible.
                </p>
              </div>
              <Button variant="destructive" className="shrink-0">
                <Trash2 className="size-4 mr-1" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
