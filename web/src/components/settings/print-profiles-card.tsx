"use client";

import { useState, useEffect } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
      <CardHeader className="border-b">
        <CardTitle className="font-semibold">Print Profiles</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline">
            <Plus className="size-4 mr-1" />
            Add Profile
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4">
            <Skeleton className="h-[120px] w-full rounded" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-8">
            <SlidersHorizontal className="mx-auto size-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No print profiles configured. Create one for each filament/machine combo.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Nozzle Temp</TableHead>
                <TableHead className="font-semibold">Bed Temp</TableHead>
                <TableHead className="font-semibold">Speed</TableHead>
                <TableHead className="font-semibold">Flow</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>{profile.name ?? "Unnamed"}</TableCell>
                  <TableCell>
                    {profile.nozzleTemp != null ? `${profile.nozzleTemp}\u00b0C` : "\u2014"}
                  </TableCell>
                  <TableCell>
                    {profile.bedTemp != null ? `${profile.bedTemp}\u00b0C` : "\u2014"}
                  </TableCell>
                  <TableCell>
                    {profile.printSpeed != null ? `${profile.printSpeed} mm/s` : "\u2014"}
                  </TableCell>
                  <TableCell>
                    {profile.flowRate != null ? `${Math.round(profile.flowRate * 100)}%` : "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
