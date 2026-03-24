"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateUser } from "@/lib/actions/user-library";
import { toast } from "sonner";

interface ProfileCardProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    username: string | null;
    image: string | null;
    role: string | null;
  };
  cardSx?: unknown;
  titleSx?: unknown;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [saving, setSaving] = useState(false);

  const initials =
    user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?";

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateUser(user.id, { name, email: user.email, username });
      if (result.error !== null) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated successfully.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4">
        {/* Section title */}
        <h3 className="font-display font-bold text-xl flex items-center gap-1.5 mb-3 before:content-[''] before:inline-block before:w-1 before:h-5 before:rounded-sm before:bg-[#00D2FF] before:shrink-0">
          Profile
        </h3>

        {/* Avatar + identity header */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar size="lg" className="size-16 border-2 border-[#00D2FF]">
            {user.image && <AvatarImage src={user.image} />}
            <AvatarFallback className="bg-[#00D2FF] text-2xl font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-lg">
                {user.name ?? "Unknown User"}
              </span>
              {user.role && (
                <Badge
                  variant={user.role === "admin" ? "default" : "secondary"}
                  className={user.role === "admin" ? "bg-[#00D2FF] text-[#00566a]" : ""}
                >
                  {user.role}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {user.email ?? "\u2014"}
            </p>
          </div>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[0.625rem] uppercase tracking-[0.1em] font-bold text-muted-foreground block mb-1">
              Full Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[0.625rem] uppercase tracking-[0.1em] font-bold text-muted-foreground block mb-1">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[0.625rem] uppercase tracking-[0.1em] font-bold text-muted-foreground block mb-1">
              Email Address
            </label>
            <div className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1.5">
              <Lock className="size-4 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#00D2FF] text-[#00566a] hover:bg-[#00bce6]"
          >
            {saving ? "Saving\u2026" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
