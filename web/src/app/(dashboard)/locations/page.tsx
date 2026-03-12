"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { PageHeader } from "@/components/layout/page-header";
import { RackTopologyTab } from "../hardware/rack-topology-tab";

export default function LocationsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Define your storage layout and see what's where."
        action={
          <Button variant="contained" startIcon={<AddIcon />}>
            Add Zone
          </Button>
        }
      />

      <RackTopologyTab key={refreshKey} />
    </div>
  );
}
