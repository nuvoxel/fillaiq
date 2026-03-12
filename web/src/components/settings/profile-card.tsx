"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { updateUser } from "@/lib/actions/user-library";

interface ProfileCardProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    username: string | null;
    image: string | null;
    role: string | null;
  };
}

export function ProfileCard({ user }: ProfileCardProps) {
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const initials =
    user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?";

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateUser(user.id, { name, email, username });
      if (result.error !== null) {
        setSnackbar({ open: true, message: result.error, severity: "error" });
      } else {
        setSnackbar({
          open: true,
          message: "Profile updated successfully.",
          severity: "success",
        });
      }
    } catch {
      setSnackbar({
        open: true,
        message: "An unexpected error occurred.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Profile" titleTypographyProps={{ fontWeight: 600 }} />
        <Divider />
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
            <Avatar
              src={user.image ?? undefined}
              sx={{ width: 72, height: 72, bgcolor: "primary.main", fontSize: 28 }}
            >
              {initials}
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {user.name ?? "Unknown User"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email ?? "\u2014"}
              </Typography>
              {user.role && (
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                size="small"
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? "Saving\u2026" : "Save Changes"}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
