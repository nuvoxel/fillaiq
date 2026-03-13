"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CancelIcon from "@mui/icons-material/Cancel";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import { listMyPrintJobs, cancelPrintJob } from "@/lib/actions/user-library";

type PrintJob = {
  id: string;
  status: string;
  stationId: string | null;
  labelData: Record<string, any>;
  copies: number;
  errorMessage: string | null;
  printedAt: Date | null;
  createdAt: Date;
};

const statusColors: Record<
  string,
  "default" | "primary" | "info" | "success" | "error" | "warning"
> = {
  pending: "warning",
  sent: "info",
  printing: "primary",
  done: "success",
  failed: "error",
  cancelled: "default",
};

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelSummary(data: Record<string, any>): string {
  const parts: string[] = [];
  if (data.brand) parts.push(data.brand);
  if (data.material) parts.push(data.material);
  if (data.colorName || data.color) parts.push(data.colorName ?? data.color);
  return parts.length > 0 ? parts.join(" / ") : "Label";
}

export function PrintJobsCard() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    listMyPrintJobs({ limit: 50 }).then((result) => {
      if (result.data) setJobs(result.data as PrintJob[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    const result = await cancelPrintJob(id);
    setCancelling(null);
    if (!result.error) {
      loadData();
    }
  };

  return (
    <Card>
      <CardHeader
        title="Print Jobs"
        titleTypographyProps={{ fontWeight: 600 }}
        action={
          <IconButton onClick={loadData} size="small" title="Refresh">
            <RefreshIcon />
          </IconButton>
        }
      />
      <Divider />
      <CardContent>
        {loading ? (
          <Stack spacing={1}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={40} />
            ))}
          </Stack>
        ) : jobs.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <PrintIcon
              sx={{ fontSize: 48, color: "text.disabled", mb: 1 }}
            />
            <Typography variant="subtitle1" fontWeight={500}>
              No print jobs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Print jobs will appear here when you print labels from the Spools
              page.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Label</TableCell>
                  <TableCell>Copies</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Printed</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} hover>
                    <TableCell>
                      <Chip
                        label={job.status}
                        size="small"
                        color={statusColors[job.status] ?? "default"}
                        sx={{ textTransform: "capitalize" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {labelSummary(
                          job.labelData as Record<string, any>
                        )}
                      </Typography>
                      {job.errorMessage && (
                        <Typography
                          variant="caption"
                          color="error.main"
                          display="block"
                        >
                          {job.errorMessage}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{job.copies}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(job.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {job.printedAt ? formatDate(job.printedAt) : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {job.status === "pending" && (
                        <IconButton
                          size="small"
                          color="error"
                          title="Cancel"
                          disabled={cancelling === job.id}
                          onClick={() => handleCancel(job.id)}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
