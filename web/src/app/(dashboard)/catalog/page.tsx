"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { PageHeader } from "@/components/layout/page-header";
import { listBrands } from "@/lib/actions/central-catalog";
import { listMaterials } from "@/lib/actions/central-catalog";
import { listProducts } from "@/lib/actions/central-catalog";
import { listHardwareModels } from "@/lib/actions/hardware-catalog";
import { HardwareModelDialog } from "@/components/hardware/hardware-model-dialog";
import { hardwareCategoryLabels } from "@/components/hardware/enum-labels";
import UsbIcon from "@mui/icons-material/Usb";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import WifiIcon from "@mui/icons-material/Wifi";

const validationColors: Record<string, "default" | "info" | "success" | "error"> = {
  draft: "default",
  submitted: "info",
  validated: "success",
  deprecated: "error",
};

const materialClassColors: Record<string, "primary" | "secondary"> = {
  fff: "primary",
  sla: "secondary",
};

const brandColumns: GridColDef[] = [
  {
    field: "logoUrl",
    headerName: "",
    width: 56,
    sortable: false,
    filterable: false,
    renderCell: (params) => (
      <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
        <Avatar
          src={params.value as string}
          sx={{ width: 32, height: 32, bgcolor: "primary.light", color: "primary.main", fontSize: 14 }}
        >
          {(params.row.name as string)?.[0]}
        </Avatar>
      </Box>
    ),
  },
  { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
  { field: "slug", headerName: "Slug", width: 140 },
  {
    field: "website",
    headerName: "Website",
    width: 200,
    renderCell: (params) =>
      params.value ? (
        <Typography variant="body2" color="info.main" sx={{ textDecoration: "underline" }}>
          {(params.value as string).replace(/^https?:\/\//, "")}
        </Typography>
      ) : (
        "—"
      ),
  },
  {
    field: "validationStatus",
    headerName: "Status",
    width: 130,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={validationColors[params.value as string] ?? "default"}
      />
    ),
  },
];

const materialColumns: GridColDef[] = [
  { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
  { field: "abbreviation", headerName: "Abbrev.", width: 100 },
  { field: "category", headerName: "Category", width: 140 },
  {
    field: "materialClass",
    headerName: "Class",
    width: 100,
    renderCell: (params) =>
      params.value ? (
        <Chip
          label={(params.value as string).toUpperCase()}
          size="small"
          color={materialClassColors[params.value as string] ?? "default"}
        />
      ) : (
        "—"
      ),
  },
  {
    field: "density",
    headerName: "Density",
    width: 100,
    valueFormatter: (value: number | null) => (value != null ? `${value} g/cm³` : "—"),
  },
];

const productColumns: GridColDef[] = [
  {
    field: "colorHex",
    headerName: "",
    width: 48,
    sortable: false,
    filterable: false,
    renderCell: (params) => (
      <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            bgcolor: (params.value as string) || "#ccc",
            border: 1,
            borderColor: "divider",
          }}
        />
      </Box>
    ),
  },
  { field: "name", headerName: "Name", flex: 1, minWidth: 200 },
  { field: "colorName", headerName: "Color", width: 120 },
  {
    field: "diameter",
    headerName: "Diameter",
    width: 100,
    valueFormatter: (value: number | null) => (value != null ? `${value}mm` : "—"),
  },
  {
    field: "netWeightG",
    headerName: "Weight",
    width: 100,
    valueFormatter: (value: number | null) => (value != null ? `${value}g` : "—"),
  },
  {
    field: "validationStatus",
    headerName: "Status",
    width: 130,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={validationColors[params.value as string] ?? "default"}
      />
    ),
  },
];

const hardwareCategoryColors: Record<string, "primary" | "secondary" | "default" | "success" | "warning" | "info"> = {
  label_printer: "secondary",
  scan_station: "primary",
  shelf_station: "primary",
  fdm_printer: "success",
  resin_printer: "success",
  cnc: "warning",
  laser_cutter: "warning",
  laser_engraver: "warning",
  drybox: "info",
  filament_changer: "info",
  enclosure: "default",
  other: "default",
};

const hardwareColumns: GridColDef[] = [
  {
    field: "category",
    headerName: "Category",
    width: 150,
    renderCell: (params) => (
      <Chip
        label={hardwareCategoryLabels[params.value as string] ?? params.value}
        size="small"
        color={hardwareCategoryColors[params.value as string] ?? "default"}
      />
    ),
  },
  {
    field: "manufacturer",
    headerName: "Manufacturer",
    width: 160,
    renderCell: (params) => (
      <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
    ),
  },
  { field: "model", headerName: "Model", width: 160 },
  {
    field: "specs",
    headerName: "Specs",
    width: 200,
    sortable: false,
    valueGetter: (_value: unknown, row: any) => {
      if (row.category === "label_printer") {
        const parts = [];
        if (row.printDpi) parts.push(`${row.printDpi} DPI`);
        if (row.printWidthMm) parts.push(`${row.printWidthMm}mm`);
        return parts.join(" · ") || "—";
      }
      if (row.buildVolumeX && row.buildVolumeY && row.buildVolumeZ) {
        return `${row.buildVolumeX}×${row.buildVolumeY}×${row.buildVolumeZ} mm`;
      }
      return "—";
    },
  },
  {
    field: "connectivity",
    headerName: "Connectivity",
    width: 140,
    sortable: false,
    renderCell: (params) => (
      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
        {params.row.hasUsb && <UsbIcon sx={{ fontSize: 16, color: "text.secondary" }} />}
        {params.row.hasBle && <BluetoothIcon sx={{ fontSize: 16, color: "primary.main" }} />}
        {params.row.hasWifi && <WifiIcon sx={{ fontSize: 16, color: "success.main" }} />}
      </Box>
    ),
  },
  {
    field: "validationStatus",
    headerName: "Status",
    width: 130,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={validationColors[params.value as string] ?? "default"}
      />
    ),
  },
];

export default function CatalogPage() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [brands, setBrands] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [hardwareModelsData, setHardwareModelsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hardwareDialogOpen, setHardwareDialogOpen] = useState(false);
  const [editingHardware, setEditingHardware] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === 0) {
      const r = await listBrands({ search: search || undefined });
      if (r.data) setBrands(r.data);
    } else if (tab === 1) {
      const r = await listMaterials({ search: search || undefined });
      if (r.data) setMaterials(r.data);
    } else if (tab === 2) {
      const r = await listProducts({ search: search || undefined });
      if (r.data) setProducts(r.data);
    } else if (tab === 3) {
      const r = await listHardwareModels();
      if (r.data) setHardwareModelsData(r.data);
    }
    setLoading(false);
  }, [tab, search]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = tab === 0 ? brands : tab === 1 ? materials : tab === 2 ? products : hardwareModelsData;
  const cols = tab === 0 ? brandColumns : tab === 1 ? materialColumns : tab === 2 ? productColumns : hardwareColumns;

  return (
    <div>
      <PageHeader
        title="Catalog"
        description="Browse the central product and hardware catalog."
        action={
          tab === 3 ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingHardware(null); setHardwareDialogOpen(true); }}>
              Add Model
            </Button>
          ) : undefined
        }
      />

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); setSearch(""); }}
          sx={{
            "& .MuiTab-root": { textTransform: "none", fontWeight: 500 },
          }}
        >
          <Tab label="Brands" />
          <Tab label="Materials" />
          <Tab label="Products" />
          <Tab label="Hardware" />
        </Tabs>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder={`Search ${["brands", "materials", "products", "hardware"][tab]}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 320 }}
        />
      </Box>

      {loading ? (
        <Stack spacing={1}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={52} />
          ))}
        </Stack>
      ) : rows.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="subtitle1" fontWeight={500}>
            No results found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search query.
          </Typography>
        </Box>
      ) : (
        <DataGrid
          rows={rows}
          columns={cols}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 3,
            "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper" },
          }}
        />
      )}

      <HardwareModelDialog
        open={hardwareDialogOpen}
        onClose={() => { setHardwareDialogOpen(false); setEditingHardware(null); }}
        onSaved={load}
        existing={editingHardware}
      />
    </div>
  );
}
