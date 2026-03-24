"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listMyEquipment, removeEquipment, createEquipment } from "@/lib/actions/user-library";
import { EquipmentDialog } from "@/components/hardware/equipment-dialog";
import { useDeleteWithUndo } from "@/components/hardware/use-delete-with-undo";
import { toast } from "sonner";

type Equipment = {
  id: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  capacity: number | null;
  maxTemp: number | null;
  hasHumidityControl: boolean | null;
  notes: string | null;
  [key: string]: unknown;
};

export function EquipmentTab({ refreshKey }: { refreshKey?: number }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = () => {
    setLoading(true);
    listMyEquipment().then((result) => {
      if (result.data) setEquipment(result.data as Equipment[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const { snackbarOpen, snackbarMessage, handleDelete, handleUndo, handleSnackbarClose } =
    useDeleteWithUndo<Equipment>({
      removeFn: removeEquipment,
      recreateFn: createEquipment,
      onRefresh: loadData,
      entityLabel: "Equipment",
    });

  // Show toast when snackbar triggers
  useEffect(() => {
    if (snackbarOpen && snackbarMessage) {
      toast(snackbarMessage, {
        action: { label: "UNDO", onClick: handleUndo },
        duration: 6000,
        onAutoClose: () => handleSnackbarClose(),
        onDismiss: () => handleSnackbarClose(),
      });
    }
  }, [snackbarOpen, snackbarMessage, handleUndo, handleSnackbarClose]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-13 rounded-lg" />
        ))}
      </div>
    );
  }

  if (equipment.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="size-12 text-muted-foreground mx-auto mb-1" />
        <p className="font-medium">No equipment configured</p>
        <p className="text-sm text-muted-foreground">
          Add dryers, storage bins, and other equipment.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Max Temp</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.map((eq) => (
              <TableRow key={eq.id}>
                <TableCell className="font-medium">{eq.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {eq.type.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>{eq.manufacturer ?? "\u2014"}</TableCell>
                <TableCell>{eq.model ?? "\u2014"}</TableCell>
                <TableCell>{eq.capacity != null ? `${eq.capacity} spools` : "\u2014"}</TableCell>
                <TableCell>{eq.maxTemp != null ? `${eq.maxTemp}\u00b0C` : "\u2014"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingEquipment(eq);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(eq);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <EquipmentDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingEquipment(null);
        }}
        onSaved={loadData}
        existing={editingEquipment}
      />
    </>
  );
}
