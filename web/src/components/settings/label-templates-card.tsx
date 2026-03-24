"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Tag, Star, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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

const formatVariants: Record<string, "default" | "secondary" | "outline"> = {
  labelife_image: "default",
  labelife_native: "secondary",
  png: "outline",
  pdf: "default",
};

export function LabelTemplatesCard({
  cardSx: _cardSx,
  titleSx: _titleSx,
}: {
  cardSx?: unknown;
  titleSx?: unknown;
} = {}) {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    listLabelTemplates().then((result) => {
      if (result.data) setTemplates(result.data as LabelTemplate[]);
      setLoading(false);
    });
  }, []);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-xl flex items-center gap-1.5 before:content-[''] before:inline-block before:w-1 before:h-5 before:rounded-sm before:bg-[#00D2FF] before:shrink-0">
            Label Templates
          </h3>
          <div className="flex gap-1 items-center">
            <Button variant="ghost" size="sm" render={<Link href="/settings/labels" />}>
              <Settings className="size-4 mr-1" />
              Manage Labels
            </Button>
            <Button variant="outline" size="sm" render={<Link href="/settings/labels" />}>
              <Plus className="size-4 mr-1" />
              Add Template
            </Button>
          </div>
        </div>

        <div className="border-t border-border" />

        {loading ? (
          <div className="p-2">
            <Skeleton className="h-[120px] rounded-lg" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-4">
            <Tag className="size-10 text-muted-foreground/40 mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">
              No label templates configured.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Name</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Format</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Size</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-[0.1em] font-bold">Default</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tmpl) => (
                <TableRow
                  key={tmpl.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/settings/labels?id=${tmpl.id}`)}
                >
                  <TableCell>
                    <Link
                      href={`/settings/labels?id=${tmpl.id}`}
                      className="font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {tmpl.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={formatVariants[tmpl.labelFormat] ?? "outline"}
                      className="capitalize"
                    >
                      {tmpl.labelFormat.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[0.8125rem]">
                      {tmpl.widthMm != null && tmpl.heightMm != null
                        ? `${tmpl.widthMm} x ${tmpl.heightMm} mm`
                        : "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {tmpl.isDefault && (
                      <Star className="size-5 text-amber-500 fill-amber-500" />
                    )}
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
