"use client";

import { PageHeader } from "@/components/layout/page-header";
import { FillaIqTab } from "../hardware/filla-iq-tab";

export default function StationsPage() {
  return (
    <div>
      <PageHeader
        title="Stations"
        description="Manage scan stations, shelf modules, and label printers."
      />
      <FillaIqTab />
    </div>
  );
}
