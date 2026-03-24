"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { IntakeForm } from "@/components/scan/intake-form";

export default function NewManualScanPage() {
  const router = useRouter();

  return (
    <div>
      <Button variant="ghost" onClick={() => router.push("/scan")} className="mb-1">
        <ArrowLeft className="size-4 mr-1" />
        Back to Scans
      </Button>

      <PageHeader
        title="Manual Scan"
        description="Scan a barcode or search the catalog to add a spool."
      />

      <IntakeForm />
    </div>
  );
}
