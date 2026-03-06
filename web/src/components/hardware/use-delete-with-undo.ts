"use client";

import { useState, useRef, useCallback } from "react";

type DeleteWithUndoOptions<T> = {
  removeFn: (id: string) => Promise<{ error: string | null }>;
  recreateFn: (data: Partial<T>) => Promise<{ error: string | null }>;
  onRefresh: () => void;
  entityLabel?: string;
};

export function useDeleteWithUndo<T extends { id: string; createdAt?: unknown; updatedAt?: unknown }>({
  removeFn,
  recreateFn,
  onRefresh,
  entityLabel = "Item",
}: DeleteWithUndoOptions<T>) {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const snapshotRef = useRef<Partial<T> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDelete = useCallback(
    async (entity: T) => {
      const result = await removeFn(entity.id);
      if (result.error) return;

      // Save snapshot for undo (strip server-managed fields)
      const { id, createdAt, updatedAt, ...rest } = entity as any;
      snapshotRef.current = rest;

      setSnackbarMessage(`${entityLabel} deleted`);
      setSnackbarOpen(true);
      onRefresh();

      // Auto-clear snapshot after 6s
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        snapshotRef.current = null;
      }, 6000);
    },
    [removeFn, onRefresh, entityLabel]
  );

  const handleUndo = useCallback(async () => {
    if (!snapshotRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const result = await recreateFn(snapshotRef.current);
    snapshotRef.current = null;
    setSnackbarOpen(false);
    if (!result.error) onRefresh();
  }, [recreateFn, onRefresh]);

  const handleSnackbarClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === "clickaway") return;
      setSnackbarOpen(false);
    },
    []
  );

  return { snackbarOpen, snackbarMessage, handleDelete, handleUndo, handleSnackbarClose };
}
