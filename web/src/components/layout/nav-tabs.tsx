"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import AssessmentIcon from "@mui/icons-material/Assessment";
import HistoryIcon from "@mui/icons-material/History";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MemoryIcon from "@mui/icons-material/Memory";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import SendIcon from "@mui/icons-material/Send";
import SettingsIcon from "@mui/icons-material/Settings";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";

const navItems = [
  { href: "/locations", label: "Dashboard", icon: <WarehouseIcon fontSize="small" /> },
  { href: "/scan", label: "Scan", icon: <QrCodeScannerIcon fontSize="small" /> },
  { href: "/spools", label: "Spools", icon: <CircleOutlinedIcon fontSize="small" /> },
  { href: "/catalog", label: "Catalog", icon: <MenuBookIcon fontSize="small" /> },
  { href: "/hardware", label: "Hardware", icon: <MemoryIcon fontSize="small" /> },
  { href: "/dashboard", label: "Reporting", icon: <AssessmentIcon fontSize="small" /> },
  { href: "/settings", label: "Settings", icon: <SettingsIcon fontSize="small" /> },
];

function resolveTab(pathname: string): number {
  for (let i = navItems.length - 1; i >= 0; i--) {
    const { href } = navItems[i];
    if (href === "/locations" ? pathname === "/locations" : pathname.startsWith(href)) return i;
  }
  return 0;
}

export function NavTabs() {
  const pathname = usePathname();
  const activeTab = resolveTab(pathname);

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.default",
        px: 3,
      }}
    >
      <Tabs
        value={activeTab}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 44,
          "& .MuiTab-root": {
            minHeight: 44,
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.875rem",
            gap: 0.75,
          },
        }}
      >
        {navItems.map(({ href, label, icon }) => (
          <Tab
            key={href}
            component={Link}
            href={href}
            label={label}
            icon={icon}
            iconPosition="start"
          />
        ))}
      </Tabs>
    </Box>
  );
}
