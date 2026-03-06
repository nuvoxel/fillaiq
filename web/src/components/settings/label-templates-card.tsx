"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import LabelIcon from "@mui/icons-material/Label";
import StarIcon from "@mui/icons-material/Star";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { listLabelTemplates } from "@/lib/actions/user-library";

type LabelTemplate = {
  id: string;
  name: string;
  labelFormat: string;
  widthMm: number | null;
  heightMm: number | null;
  isDefault: boolean | null;
  createdAt: Date;
};

const formatColors: Record<string, "primary" | "secondary" | "default" | "success"> = {
  labelife_image: "primary",
  labelife_native: "secondary",
  png: "default",
  pdf: "success",
};

export function LabelTemplatesCard() {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listLabelTemplates().then((result) => {
      if (result.data) setTemplates(result.data as LabelTemplate[]);
      setLoading(false);
    });
  }, []);

  return (
    <Card>
      <CardHeader
        title="Label Templates"
        titleTypographyProps={{ fontWeight: 600 }}
        action={
          <Button size="small" startIcon={<AddIcon />} variant="outlined">
            Add Template
          </Button>
        }
      />
      <Divider />
      <CardContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={120} />
          </Box>
        ) : templates.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <LabelIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No label templates configured. Create one to print spool labels.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Format</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Default</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((tmpl) => (
                  <TableRow key={tmpl.id}>
                    <TableCell>{tmpl.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={tmpl.labelFormat.replace(/_/g, " ")}
                        size="small"
                        color={formatColors[tmpl.labelFormat] ?? "default"}
                        sx={{ textTransform: "capitalize" }}
                      />
                    </TableCell>
                    <TableCell>
                      {tmpl.widthMm != null && tmpl.heightMm != null
                        ? `${tmpl.widthMm} x ${tmpl.heightMm} mm`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {tmpl.isDefault && (
                        <StarIcon sx={{ color: "warning.main", fontSize: 20 }} />
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
