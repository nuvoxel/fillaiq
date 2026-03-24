"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="mb-2">
      <CardContent className="flex gap-3 items-center">
        {/* Color swatch */}
        <div
          className="w-12 h-12 rounded-full border-2 border-border shrink-0 overflow-hidden"
          style={{ backgroundColor: product.colorHex ?? "#ccc" }}
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{product.name}</p>
          <div className="flex gap-1 flex-wrap mt-1">
            {brand && <Badge variant="outline">{brand.name}</Badge>}
            {product.colorName && (
              <Badge
                style={{
                  backgroundColor: product.colorHex ?? undefined,
                  color: product.colorHex
                    ? getContrastColor(product.colorHex)
                    : undefined,
                }}
              >
                {product.colorName}
              </Badge>
            )}
            {product.netWeightG && (
              <Badge variant="outline">{product.netWeightG}g</Badge>
            )}
            <Badge variant="outline">{product.category}</Badge>
          </div>
        </div>
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
