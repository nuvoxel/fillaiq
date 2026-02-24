"use client";

import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    action_create: Palette["primary"];
    action_update: Palette["primary"];
    action_delete: Palette["primary"];
    action_review: Palette["primary"];
    action_login: Palette["primary"];
    action_logout: Palette["primary"];
  }
  interface PaletteOptions {
    action_create?: PaletteOptions["primary"];
    action_update?: PaletteOptions["primary"];
    action_delete?: PaletteOptions["primary"];
    action_review?: PaletteOptions["primary"];
    action_login?: PaletteOptions["primary"];
    action_logout?: PaletteOptions["primary"];
  }
}

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#FF5C2E",
      dark: "#E8471A",
      light: "#FFF0EB",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#FFFFFF",
      paper: "#F8F8F8",
    },
    text: {
      primary: "#171717",
      secondary: "#6B6B6B",
      disabled: "#9B9B9B",
    },
    divider: "#E4E4E4",
    secondary: {
      main: "#7C3AED",
      light: "#EDE9FE",
      dark: "#5B21B6",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#16A34A",
      light: "#F0FDF4",
      dark: "#15803D",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#D97706",
      light: "#FFFBEB",
      dark: "#B45309",
      contrastText: "#FFFFFF",
    },
    info: {
      main: "#2563EB",
      light: "#EFF6FF",
      dark: "#1D4ED8",
      contrastText: "#FFFFFF",
    },
    error: {
      main: "#DC2626",
      light: "#FEF2F2",
      dark: "#B91C1C",
      contrastText: "#FFFFFF",
    },
    action_create: { main: "#16A34A", light: "#F0FDF4", contrastText: "#FFFFFF" },
    action_update: { main: "#2563EB", light: "#EFF6FF", contrastText: "#FFFFFF" },
    action_delete: { main: "#DC2626", light: "#FEF2F2", contrastText: "#FFFFFF" },
    action_review: { main: "#9333EA", light: "#FAF5FF", contrastText: "#FFFFFF" },
    action_login: { main: "#0891B2", light: "#ECFEFF", contrastText: "#FFFFFF" },
    action_logout: { main: "#6B7280", light: "#F3F4F6", contrastText: "#FFFFFF" },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    fontWeightBold: 700,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: "1px solid",
          borderColor: "#E4E4E4",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
          },
          transition: "box-shadow 0.2s ease",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          fontWeight: 600,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 12,
          fontWeight: 600,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

export default theme;
