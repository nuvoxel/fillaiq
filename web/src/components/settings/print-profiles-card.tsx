"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import TuneIcon from "@mui/icons-material/Tune";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { listUserPrintProfiles } from "@/lib/actions/user-library";

type PrintProfile = {
  id: string;
  name: string | null;
  nozzleTemp: number | null;
  bedTemp: number | null;
  printSpeed: number | null;
  flowRate: number | null;
  machineId: string | null;
  createdAt: Date;
};

export function PrintProfilesCard() {
  const [profiles, setProfiles] = useState<PrintProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listUserPrintProfiles().then((result) => {
      if (result.data) setProfiles(result.data as PrintProfile[]);
      setLoading(false);
    });
  }, []);

  return (
    <Card>
      <CardHeader
        title="Print Profiles"
        titleTypographyProps={{ fontWeight: 600 }}
        action={
          <Button size="small" startIcon={<AddIcon />} variant="outlined">
            Add Profile
          </Button>
        }
      />
      <Divider />
      <CardContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={120} />
          </Box>
        ) : profiles.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <TuneIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No print profiles configured. Create one for each filament/machine combo.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Nozzle Temp</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Bed Temp</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Speed</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Flow</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>{profile.name ?? "Unnamed"}</TableCell>
                    <TableCell>
                      {profile.nozzleTemp != null ? `${profile.nozzleTemp}°C` : "—"}
                    </TableCell>
                    <TableCell>
                      {profile.bedTemp != null ? `${profile.bedTemp}°C` : "—"}
                    </TableCell>
                    <TableCell>
                      {profile.printSpeed != null ? `${profile.printSpeed} mm/s` : "—"}
                    </TableCell>
                    <TableCell>
                      {profile.flowRate != null ? `${Math.round(profile.flowRate * 100)}%` : "—"}
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
