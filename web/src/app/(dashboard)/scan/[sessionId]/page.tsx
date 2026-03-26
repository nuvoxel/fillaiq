"use client";

import { useParams, useRouter } from "next/navigation";
import { AddItemSheet } from "@/components/intake/add-item-sheet";

export default function ScanSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  return (
    <AddItemSheet
      open={true}
      sessionId={sessionId}
      onClose={() => router.push("/scan-station")}
      onSaved={() => router.push("/scan-station")}
    />
  );
}
