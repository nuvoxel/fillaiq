"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={editing ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setEditing((v) => !v)}
                  />
                }
              >
                <Pencil className="size-4" />
              </TooltipTrigger>
              <TooltipContent>{editing ? "Done editing" : "Edit layout"}</TooltipContent>
            </Tooltip>
            {editing && (
              <Button onClick={() => setZoneDialogOpen(true)}>
                <Plus className="size-4" data-icon="inline-start" />
                Add Zone
              </Button>
            )}
          </div>
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
