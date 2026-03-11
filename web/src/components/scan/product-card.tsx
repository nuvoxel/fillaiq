"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";

type ProductInfo = {
  product: {
    id: string;
    name: string;
    colorName: string | null;
    colorHex: string | null;
    netWeightG: number | null;
    packageStyle: string | null;
    category: string;
    imageUrl: string | null;
  };
  brand: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
};

export function ProductCard({ data }: { data: ProductInfo }) {
  const { product, brand } = data;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ display: "flex", gap: 2, alignItems: "center" }}>
        {/* Color swatch */}
        <Avatar
          sx={{
            width: 48,
            height: 48,
            bgcolor: product.colorHex ?? "#ccc",
            border: "2px solid",
            borderColor: "divider",
            fontSize: 0,
          }}
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {product.name}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
            {brand && (
              <Chip label={brand.name} size="small" variant="outlined" />
            )}
            {product.colorName && (
              <Chip
                label={product.colorName}
                size="small"
                sx={{
                  bgcolor: product.colorHex ?? undefined,
                  color: product.colorHex
                    ? getContrastColor(product.colorHex)
                    : undefined,
                }}
              />
            )}
            {product.netWeightG && (
              <Chip label={`${product.netWeightG}g`} size="small" variant="outlined" />
            )}
            <Chip label={product.category} size="small" variant="outlined" />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}
