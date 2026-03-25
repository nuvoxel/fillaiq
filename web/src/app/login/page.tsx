"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Fingerprint } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleMagicLink() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.magicLink({ email, callbackURL: "/locations" });
      if (result.error) {
        setError(result.error.message ?? "Failed to send magic link");
      } else {
        setSuccess("Check your email for a sign-in link.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed");
      } else {
        router.push("/locations");
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
        router.push("/locations");
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[420px]">
        <CardContent className="p-6">
          {/* Logo */}
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex gap-1">
              <div className="h-7 w-1.5 rounded-full bg-primary" />
              <div className="h-7 w-1.5 rounded-full bg-primary" />
            </div>
            <h1 className="font-display text-xl font-bold">FillaIQ</h1>
            <p className="text-sm text-muted-foreground">
              Smart workshop inventory
            </p>
          </div>

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setError(null);
            }}
            className="mb-6"
          >
            <TabsList className="w-full">
              <TabsTrigger value="sign-in" className="flex-1">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="sign-up" className="flex-1">
                Sign Up
              </TabsTrigger>
            </TabsList>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mt-4">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="sign-in">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSignIn();
                }}
                className="mt-4 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    minLength={8}
                  />
                </div>
                <Button type="submit" disabled={loading} className="mt-1">
                  {loading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    "Sign In"
                  )}
                </Button>
                <div className="relative my-2">
                  <Separator />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    or
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={loading || !email}
                  onClick={handleMagicLink}
                >
                  Email me a sign-in link
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sign-up">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSignUp();
                }}
                className="mt-4 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="signup-name">Name</Label>
                  <Input
                    id="signup-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters
                  </p>
                </div>
                <Button type="submit" disabled={loading} className="mt-1">
                  {loading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <Separator />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
              or
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                authClient.signIn.social({
                  provider: "microsoft-entra-id",
                  callbackURL: "/locations",
                });
              }}
            >
              <svg className="size-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Continue with Microsoft
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                authClient.signIn.social({
                  provider: "google",
                  callbackURL: "/locations",
                });
              }}
            >
              <svg className="size-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                authClient.signIn.social({
                  provider: "github",
                  callbackURL: "/locations",
                });
              }}
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Continue with GitHub
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError(null);
                const result = await authClient.signIn.passkey();
                if (result?.error) {
                  setError(result.error.message ?? "Passkey sign-in failed");
                } else {
                  router.push("/locations");
                  router.refresh();
                }
                setLoading(false);
              }}
            >
              <Fingerprint className="size-5" />
              Sign in with Passkey
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
