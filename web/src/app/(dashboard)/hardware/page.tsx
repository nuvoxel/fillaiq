"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import AddIcon from "@mui/icons-material/Add";
import { PageHeader } from "@/components/layout/page-header";
import { MachineDialog } from "@/components/hardware/machine-dialog";
import { EquipmentDialog } from "@/components/hardware/equipment-dialog";
import { RackTopologyTab } from "./rack-topology-tab";
import { MachinesTab } from "./machines-tab";
import { EquipmentTab } from "./equipment-tab";
import { FillaIqTab } from "./filla-iq-tab";

export default function HardwarePage() {
  const [tab, setTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [machineDialogOpen, setMachineDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const handleAdd = () => {
    if (tab === 1) setMachineDialogOpen(true);
    else if (tab === 2) setEquipmentDialogOpen(true);
  };

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <PageHeader
        title="Hardware"
        description="Manage zones, machines, and equipment."
        action={
          tab !== 3 ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
              {tab === 0 ? "Add Zone" : tab === 1 ? "Add Machine" : "Add Equipment"}
            </Button>
          ) : undefined
        }
      />

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Zones" />
          <Tab label="Machines" />
          <Tab label="Equipment" />
          <Tab label="Filla IQ" />
        </Tabs>
      </Box>

      {tab === 0 && <RackTopologyTab />}
      {tab === 1 && <MachinesTab refreshKey={refreshKey} />}
      {tab === 2 && <EquipmentTab refreshKey={refreshKey} />}
      {tab === 3 && <FillaIqTab />}

      <MachineDialog
        open={machineDialogOpen}
        onClose={() => setMachineDialogOpen(false)}
        onSaved={handleSaved}
      />
      <EquipmentDialog
        open={equipmentDialogOpen}
        onClose={() => setEquipmentDialogOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
