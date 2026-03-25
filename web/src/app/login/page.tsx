"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
              Filament spool monitoring platform
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
              Continue with GitHub
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
