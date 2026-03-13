"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
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

  const handleDelete = async () => {
    setDeleting(true);
    const result = await removeUserItem(spool.id);
    setDeleting(false);
    if (result.error === null) {
      setDeleteOpen(false);
      router.push("/spools");
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
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        <Tooltip title="Edit spool">
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditOpen(true)}
          >
            Edit
          </Button>
        </Tooltip>

        <Tooltip title="Print label">
          <Button
            size="small"
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => setPrintOpen(true)}
          >
            Print Label
          </Button>
        </Tooltip>

        <Tooltip title="Move to different location">
          <Button
            size="small"
            variant="outlined"
            startIcon={<SwapHorizIcon />}
            onClick={() => {
              setMoveSlotId(spool.currentSlotId ?? null);
              setMoveOpen(true);
            }}
          >
            Move
          </Button>
        </Tooltip>

        {!isArchived && (
          <Tooltip title="Archive spool">
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<ArchiveIcon />}
              onClick={() => setArchiveOpen(true)}
            >
              Archive
            </Button>
          </Tooltip>
        )}

        <Tooltip title="Delete spool">
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </Tooltip>
      </Stack>

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
      <Dialog open={archiveOpen} onClose={() => setArchiveOpen(false)}>
        <DialogTitle>Archive Spool</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to archive this spool? It will be hidden from
            the default view but can be restored later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveOpen(false)}>Cancel</Button>
          <Button
            onClick={handleArchive}
            color="warning"
            variant="contained"
            disabled={archiving}
          >
            {archiving ? "Archiving..." : "Archive"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Spool</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to permanently delete this spool? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Dialog */}
      <Dialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Move Spool</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a new slot to assign this spool to:
          </Typography>
          <SlotPicker
            selectedSlotId={moveSlotId}
            onSelect={(slotId) => setMoveSlotId(slotId)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)}>Cancel</Button>
          <Button
            onClick={handleMove}
            variant="contained"
            disabled={moving}
          >
            {moving ? "Moving..." : "Move"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
