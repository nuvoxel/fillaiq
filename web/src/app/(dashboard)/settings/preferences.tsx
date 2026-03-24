"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { upsertUserPreferences } from "@/lib/actions/dashboard";
import { toast } from "sonner";

type PrefsState = {
  autoArchiveEmpty: boolean;
};

const prefsMeta: { key: keyof PrefsState; label: string; description: string }[] = [
  { key: "autoArchiveEmpty", label: "Auto-archive empty spools", description: "Cleanup database automatically every 24h" },
];

export function SettingsPreferences({
  userId,
  initialPrefs,
  cardSx: _cardSx,
  titleSx: _titleSx,
}: {
  userId: string | null;
  initialPrefs: PrefsState;
  cardSx?: unknown;
  titleSx?: unknown;
}) {
  const [prefs, setPrefs] = useState<PrefsState>(initialPrefs);
  const [isPending, startTransition] = useTransition();

  function handleToggle(key: keyof PrefsState) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);

    if (userId) {
      startTransition(async () => {
        const result = await upsertUserPreferences(userId, updated);
        if (result.data) {
          toast.success("Preferences saved");
        }
      });
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4">
        <h3 className="font-display font-bold text-xl flex items-center gap-1.5 mb-3 before:content-[''] before:inline-block before:w-1 before:h-5 before:rounded-sm before:bg-[#00D2FF] before:shrink-0">
          Preferences
        </h3>

        <div className="border-t border-border" />

        {prefsMeta.map((pref, i) => (
          <div key={pref.key}>
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-bold">{pref.label}</p>
                <p className="text-xs text-muted-foreground">{pref.description}</p>
              </div>
              <Switch
                checked={prefs[pref.key]}
                onCheckedChange={() => handleToggle(pref.key)}
                disabled={isPending}
              />
            </div>
            {i < prefsMeta.length - 1 && <div className="border-t border-border" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
