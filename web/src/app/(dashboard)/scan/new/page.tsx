"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { PageHeader } from "@/components/layout/page-header";
import { IntakeForm } from "@/components/scan/intake-form";

export default function NewManualScanPage() {
  const router = useRouter();

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push("/scan")}
        sx={{ mb: 1, textTransform: "none" }}
      >
        Back to Scans
      </Button>

      <PageHeader
        title="Manual Scan"
        description="Scan a barcode or search the catalog to add a spool."
      />

      <IntakeForm />
    </Box>
  );
}
