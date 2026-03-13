"use client";

import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LinkOffIcon from "@mui/icons-material/LinkOff";

interface FilamentColorsLinkProps {
  slug?: string | null;
}

const FILAMENT_COLORS_BASE = "https://filamentcolors.xyz/swatch";

export default function FilamentColorsLink({ slug }: FilamentColorsLinkProps) {
  if (!slug) {
    return (
      <Chip
        icon={<LinkOffIcon />}
        label="FilamentColors: Not linked"
        size="small"
        variant="outlined"
        component="a"
        href="https://filamentcolors.xyz/library/"
        target="_blank"
        rel="noopener noreferrer"
        clickable
        sx={{ opacity: 0.7 }}
      />
    );
  }

  return (
    <Button
      variant="outlined"
      size="small"
      endIcon={<OpenInNewIcon />}
      href={`${FILAMENT_COLORS_BASE}/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      sx={{ textTransform: "none" }}
    >
      FilamentColors.xyz
    </Button>
  );
}
