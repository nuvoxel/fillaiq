"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { PageHeader } from "@/components/layout/page-header";
import { ZoneDialog } from "@/components/locations/zone-dialog";
import { RackTopologyTab } from "../hardware/rack-topology-tab";

export default function LocationsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Define your storage layout and see what's where."
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setZoneDialogOpen(true)}
          >
            Add Zone
          </Button>
        }
      />

      <RackTopologyTab key={refreshKey} />

      <ZoneDialog
        open={zoneDialogOpen}
        onClose={() => setZoneDialogOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
