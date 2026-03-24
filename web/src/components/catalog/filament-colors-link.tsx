"use client";

import { ExternalLink, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FilamentColorsLinkProps {
  slug?: string | null;
}

const FILAMENT_COLORS_BASE = "https://filamentcolors.xyz/swatch";

export default function FilamentColorsLink({ slug }: FilamentColorsLinkProps) {
  if (!slug) {
    return (
      <a
        href="https://filamentcolors.xyz/library/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Badge variant="outline" className="opacity-70 cursor-pointer">
          <LinkIcon className="size-3 mr-1" />
          FilamentColors: Not linked
        </Badge>
      </a>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      render={
        <a
          href={`${FILAMENT_COLORS_BASE}/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
        />
      }
    >
      FilamentColors.xyz
      <ExternalLink className="size-3.5 ml-1.5" />
    </Button>
  );
}
