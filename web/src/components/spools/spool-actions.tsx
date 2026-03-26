"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Printer, Archive, Trash2, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { SpoolDialog } from "@/components/spools/spool-dialog";
import {
  PrintLabelDialog,
  type PrintLabelItem,
} from "@/components/labels/print-label-dialog";
import { SlotPicker } from "@/components/scan/slot-picker";
import { updateUserItem, removeUserItem } from "@/lib/actions/user-library";

type SpoolData = {
  id: string;
  status: string;
  currentSlotId?: string | null;
  storageLocation?: string | null;
  currentWeightG?: number | null;
  netFilamentWeightG?: number | null;
  spoolWeightG?: number | null;
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  purchasedAt?: string | Date | null;
  lotNumber?: string | null;
  nfcUid?: string | null;
  nfcTagFormat?: string | null;
  notes?: string | null;
  [key: string]: unknown;
};

type ProductData = {
  name?: string;
  colorHex?: string;
  colorName?: string;
  brandId?: string;
  [key: string]: unknown;
} | null;

type Props = {
  spool: SpoolData;
  product: ProductData;
  brandName?: string;
  materialName?: string;
};

export function SpoolActions({ spool, product, brandName, materialName }: Props) {
  const router = useRouter();

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);

  // Print label dialog
  const [printOpen, setPrintOpen] = useState(false);

  // Archive confirm
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Move dialog
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveSlotId, setMoveSlotId] = useState<string | null>(
    spool.currentSlotId ?? null
  );
  const [moving, setMoving] = useState(false);

  const handleArchive = async () => {
    setArchiving(true);
    const result = await updateUserItem(spool.id, { status: "archived" });
    setArchiving(false);
    if (result.error === null) {
      setArchiveOpen(false);
      router.refresh();
    }
  };

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const result = await removeUserItem(spool.id);
    setDeleting(false);
    if (result.error === null) {
      setDeleteOpen(false);
      router.push("/spools");
    } else {
      setDeleteError(result.error);
    }
  };

  const handleMove = async () => {
    setMoving(true);
    const result = await updateUserItem(spool.id, {
      currentSlotId: moveSlotId,
    });
    setMoving(false);
    if (result.error === null) {
      setMoveOpen(false);
      router.refresh();
    }
  };

  const printItem: PrintLabelItem = {
    brand: brandName,
    material: materialName,
    color: product?.colorName ?? undefined,
    weight:
      spool.currentWeightG != null
        ? `${Math.round(spool.currentWeightG)}g`
        : undefined,
    location: spool.storageLocation ?? undefined,
    price:
      spool.purchasePrice != null
        ? `$${spool.purchasePrice.toFixed(2)}`
        : undefined,
    purchaseDate: spool.purchasedAt
      ? new Date(spool.purchasedAt as string | number | Date).toLocaleDateString()
      : undefined,
    lotNumber: spool.lotNumber ?? undefined,
  };

  const isArchived = spool.status === "archived";

  return (
    <>
      <TooltipProvider>
        <div className="flex flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                />
              }
            >
              <Pencil className="size-3.5" />
              Edit
            </TooltipTrigger>
            <TooltipContent>Edit spool</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPrintOpen(true)}
                />
              }
            >
              <Printer className="size-3.5" />
              Print Label
            </TooltipTrigger>
            <TooltipContent>Print label</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMoveSlotId(spool.currentSlotId ?? null);
                    setMoveOpen(true);
                  }}
                />
              }
            >
              <ArrowLeftRight className="size-3.5" />
              Move
            </TooltipTrigger>
            <TooltipContent>Move to different location</TooltipContent>
          </Tooltip>

          {!isArchived && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-600 hover:bg-amber-50"
                    onClick={() => setArchiveOpen(true)}
                  />
                }
              >
                <Archive className="size-3.5" />
                Archive
              </TooltipTrigger>
              <TooltipContent>Archive spool</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                />
              }
            >
              <Trash2 className="size-3.5" />
              Delete
            </TooltipTrigger>
            <TooltipContent>Delete spool</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Edit Dialog */}
      <SpoolDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => router.refresh()}
        existing={spool}
      />

      {/* Print Label Dialog */}
      <PrintLabelDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        items={[printItem]}
      />

      {/* Archive Confirmation */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Spool</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this spool? It will be hidden from
              the default view but can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleArchive}
              className="bg-amber-500 text-white hover:bg-amber-600"
              disabled={archiving}
            >
              {archiving ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Spool</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this spool? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive px-1">{deleteError}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleDelete}
              variant="destructive"
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Spool</DialogTitle>
            <DialogDescription>
              Select a new slot to assign this spool to:
            </DialogDescription>
          </DialogHeader>
          <SlotPicker
            selectedSlotId={moveSlotId}
            onSelect={(slotId) => setMoveSlotId(slotId)}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleMove}
              disabled={moving}
            >
              {moving ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
