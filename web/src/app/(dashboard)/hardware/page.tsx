"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { MachineDialog } from "@/components/hardware/machine-dialog";
import { EquipmentDialog } from "@/components/hardware/equipment-dialog";
import { MachinesTab } from "./machines-tab";
import { EquipmentTab } from "./equipment-tab";
import { FillaIqTab } from "./filla-iq-tab";

export default function HardwarePage() {
  const [tab, setTab] = useState("machines");
  const [refreshKey, setRefreshKey] = useState(0);
  const [machineDialogOpen, setMachineDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const handleAdd = () => {
    if (tab === "machines") setMachineDialogOpen(true);
    else if (tab === "equipment") setEquipmentDialogOpen(true);
  };

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <PageHeader
        title="Hardware"
        description="Manage machines and equipment."
        action={
          tab !== "fillaiq" ? (
            <Button onClick={handleAdd}>
              <Plus className="size-4 mr-1" />
              {tab === "machines" ? "Add Machine" : "Add Equipment"}
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList variant="line" className="mb-3">
          <TabsTrigger value="machines">Machines</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="fillaiq">Filla IQ</TabsTrigger>
        </TabsList>

        <TabsContent value="machines">
          <MachinesTab refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="equipment">
          <EquipmentTab refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="fillaiq">
          <FillaIqTab />
        </TabsContent>
      </Tabs>

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
