"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2, Usb, Bluetooth, Wifi, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  listHardwareModels,
  removeHardwareModel,
  createHardwareModel,
} from "@/lib/actions/hardware-catalog";
import { HardwareModelDialog } from "@/components/hardware/hardware-model-dialog";
import { useDeleteWithUndo } from "@/components/hardware/use-delete-with-undo";
import { hardwareCategoryLabels } from "@/components/hardware/enum-labels";

type HardwareModel = {
  id: string;
  category: string;
  manufacturer: string;
  model: string;
  slug: string;
  description: string | null;
  validationStatus: string;
  hasUsb: boolean | null;
  hasBle: boolean | null;
  hasWifi: boolean | null;
  printDpi: number | null;
  printWidthMm: number | null;
  buildVolumeX: number | null;
  buildVolumeY: number | null;
  buildVolumeZ: number | null;
  [key: string]: unknown;
};

function getSpecs(row: HardwareModel): string {
  if (row.category === "label_printer") {
    const parts = [];
    if (row.printDpi) parts.push(`${row.printDpi} DPI`);
    if (row.printWidthMm) parts.push(`${row.printWidthMm}mm`);
    return parts.join(" \u00b7 ") || "\u2014";
  }
  if (row.buildVolumeX && row.buildVolumeY && row.buildVolumeZ) {
    return `${row.buildVolumeX}\u00d7${row.buildVolumeY}\u00d7${row.buildVolumeZ} mm`;
  }
  return "\u2014";
}

export function HardwareCatalogTab({ refreshKey }: { refreshKey?: number }) {
  const [models, setModels] = useState<HardwareModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<HardwareModel | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = () => {
    setLoading(true);
    listHardwareModels().then((result) => {
      if (result.data) setModels(result.data as HardwareModel[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const { snackbarOpen, snackbarMessage, handleDelete, handleUndo, handleSnackbarClose } =
    useDeleteWithUndo<HardwareModel>({
      removeFn: removeHardwareModel,
      recreateFn: createHardwareModel,
      onRefresh: loadData,
      entityLabel: "Hardware Model",
    });

  // Show toast when snackbar state changes
  useEffect(() => {
    if (snackbarOpen && snackbarMessage) {
      toast(snackbarMessage, {
        action: {
          label: "UNDO",
          onClick: handleUndo,
        },
        duration: 6000,
        onDismiss: () => handleSnackbarClose(),
      });
    }
  }, [snackbarOpen, snackbarMessage, handleUndo, handleSnackbarClose]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full rounded" />
        ))}
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="text-center py-16">
        <LayoutGrid className="mx-auto size-12 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-medium">No hardware models in catalog</p>
        <p className="text-sm text-muted-foreground">
          Models are auto-discovered when devices connect, or you can add them manually.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Specs</TableHead>
              <TableHead>Connectivity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell>
                  <Badge variant="secondary">
                    {hardwareCategoryLabels[model.category] ?? model.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">{model.manufacturer}</span>
                </TableCell>
                <TableCell>{model.model}</TableCell>
                <TableCell>{getSpecs(model)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {model.hasUsb && <Usb className="size-4 text-muted-foreground" />}
                    {model.hasBle && <Bluetooth className="size-4 text-primary" />}
                    {model.hasWifi && <Wifi className="size-4 text-green-500" />}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {model.validationStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingModel(model);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(model)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <HardwareModelDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingModel(null);
        }}
        onSaved={loadData}
        existing={editingModel}
      />
    </>
  );
}
