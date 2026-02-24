"use client";

import { useState, useTransition } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Switch from "@mui/material/Switch";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Snackbar from "@mui/material/Snackbar";
import { upsertUserPreferences } from "@/lib/actions/dashboard";

type PrefsState = {
  emailNotifications: boolean;
  weightWarnings: boolean;
  autoArchiveEmpty: boolean;
  darkMode: boolean;
};

const prefsMeta: { key: keyof PrefsState; label: string; description: string }[] = [
  { key: "emailNotifications", label: "Email notifications", description: "Receive email alerts for spool events" },
  { key: "weightWarnings", label: "Weight warnings", description: "Alert when spool weight drops below 10%" },
  { key: "autoArchiveEmpty", label: "Auto-archive empty spools", description: "Automatically archive spools when emptied" },
  { key: "darkMode", label: "Dark mode", description: "Use dark theme (coming soon)" },
];

export function SettingsPreferences({
  userId,
  initialPrefs,
}: {
  userId: string | null;
  initialPrefs: PrefsState;
}) {
  const [prefs, setPrefs] = useState<PrefsState>(initialPrefs);
  const [snackOpen, setSnackOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggle(key: keyof PrefsState) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);

    if (userId) {
      startTransition(async () => {
        const result = await upsertUserPreferences(userId, updated);
        if (result.data) {
          setSnackOpen(true);
        }
      });
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Preferences" titleTypographyProps={{ fontWeight: 600 }} />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          <List>
            {prefsMeta.map((pref, i) => (
              <ListItem
                key={pref.key}
                divider={i < prefsMeta.length - 1}
                secondaryAction={
                  <Switch
                    checked={prefs[pref.key]}
                    onChange={() => handleToggle(pref.key)}
                    disabled={isPending}
                  />
                }
              >
                <ListItemText
                  primary={pref.label}
                  secondary={pref.description}
                  primaryTypographyProps={{ fontWeight: 500 }}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        message="Preferences saved"
      />
    </>
  );
}
