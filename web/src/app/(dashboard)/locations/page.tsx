"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { PageHeader } from "@/components/layout/page-header";
import { LocationDialog } from "@/components/locations/location-dialog";
import { RackTopologyTab } from "../hardware/rack-topology-tab";

export default function LocationsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your storage layout and what's where."
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Tooltip title={editing ? "Done editing" : "Edit layout"}>
              <IconButton
                onClick={() => setEditing((v) => !v)}
                sx={editing ? { bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" } } : {}}
              >
                <EditIcon />
              </IconButton>
            </Tooltip>
            {editing && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setZoneDialogOpen(true)}
              >
                Add Zone
              </Button>
            )}
          </Box>
        }
      />

      <RackTopologyTab key={refreshKey} editing={editing} />

      <LocationDialog
        open={zoneDialogOpen}
        level="zone"
        onClose={() => setZoneDialogOpen(false)}
        onSaved={() => {
          setZoneDialogOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
