"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { Header } from "./header";
import { NavTabs } from "./nav-tabs";
import { Footer } from "./footer";

export function AppShell({
  children,
  user,
}: {
  children: ReactNode;
  user?: { name?: string | null; image?: string | null } | null;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <Header user={user} />
      <NavTabs />
      <Box
        component="main"
        sx={{ maxWidth: 1200, mx: "auto", px: 3, py: 3, flex: 1, width: "100%" }}
      >
        {children}
      </Box>
      <Footer />
    </Box>
  );
}
