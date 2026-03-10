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
import { PageHeader } from "@/components/layout/page-header";
import { listBrands } from "@/lib/actions/central-catalog";
import { listMaterials } from "@/lib/actions/central-catalog";
import { listProducts } from "@/lib/actions/central-catalog";

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

export default function CatalogPage() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [brands, setBrands] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === 0) {
      const r = await listBrands({ search: search || undefined });
      if (r.data) setBrands(r.data);
    } else if (tab === 1) {
      const r = await listMaterials({ search: search || undefined });
      if (r.data) setMaterials(r.data);
    } else {
      const r = await listProducts({ search: search || undefined });
      if (r.data) setProducts(r.data);
    }
    setLoading(false);
  }, [tab, search]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = tab === 0 ? brands : tab === 1 ? materials : products;
  const cols = tab === 0 ? brandColumns : tab === 1 ? materialColumns : productColumns;

  return (
    <div>
      <PageHeader
        title="Catalog"
        description="Browse the central product catalog."
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
        </Tabs>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder={`Search ${["brands", "materials", "products"][tab]}...`}
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
    </div>
  );
}
