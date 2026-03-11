import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/Key";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getUserProfile, listApiKeys, getUserPreferences } from "@/lib/actions/dashboard";
import { SettingsPreferences } from "./preferences";
import { LabelTemplatesCard } from "@/components/settings/label-templates-card";
import { OrganizationCard } from "@/components/settings/organization-card";

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

  const initials = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account and preferences."
      />

      <Stack spacing={3}>
        {/* Profile */}
        <Card>
          <CardHeader title="Profile" titleTypographyProps={{ fontWeight: 600 }} />
          <Divider />
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
              <Avatar
                src={user?.image ?? undefined}
                sx={{ width: 72, height: 72, bgcolor: "primary.main", fontSize: 28 }}
              >
                {initials}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {user?.name ?? "Unknown User"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.email ?? "—"}
                </Typography>
                {user?.role && (
                  <Chip
                    label={user.role}
                    size="small"
                    color={user.role === "admin" ? "primary" : "default"}
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Name"
                  defaultValue={user?.name ?? ""}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Email"
                  defaultValue={user?.email ?? ""}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Username"
                  defaultValue={user?.username ?? ""}
                  size="small"
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
              <Button variant="contained">Save Changes</Button>
            </Box>
          </CardContent>
        </Card>

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
        <Card>
          <CardHeader
            title="API Keys"
            titleTypographyProps={{ fontWeight: 600 }}
            action={
              <Button size="small" startIcon={<KeyIcon />} variant="outlined">
                Generate Key
              </Button>
            }
          />
          <Divider />
          <CardContent sx={{ p: 0 }}>
            {apiKeys.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <KeyIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No API keys configured.
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Key Prefix</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Last Used</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>{key.name ?? "Unnamed"}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                            {key.prefix ?? "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={key.enabled ? "Active" : "Disabled"}
                            size="small"
                            color={key.enabled ? "success" : "default"}
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(key.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {key.lastRequest
                            ? new Date(key.lastRequest).toLocaleDateString()
                            : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

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
