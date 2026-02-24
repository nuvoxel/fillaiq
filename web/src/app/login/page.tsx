"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message ?? "Sign up failed");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: "primary.main",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1.5,
              }}
            >
              <Typography
                variant="h6"
                sx={{ color: "primary.contrastText", fontWeight: 700 }}
              >
                F
              </Typography>
            </Box>
            <Typography variant="h5" fontWeight={700}>
              FillaIQ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Filament spool monitoring platform
            </Typography>
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setError(null); }}
            variant="fullWidth"
            sx={{ mb: 3, "& .MuiTab-root": { textTransform: "none", fontWeight: 500 } }}
          >
            <Tab label="Sign In" />
            <Tab label="Sign Up" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              tab === 0 ? handleSignIn() : handleSignUp();
            }}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            {tab === 1 && (
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                autoComplete="name"
              />
            )}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete={tab === 0 ? "current-password" : "new-password"}
              inputProps={{ minLength: 8 }}
              helperText={tab === 1 ? "Minimum 8 characters" : undefined}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : tab === 0 ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
