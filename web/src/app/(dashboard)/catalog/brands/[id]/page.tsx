import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getBrandById, listProducts } from "@/lib/actions/central-catalog";
import { BrandLogoUpload } from "@/components/catalog/brand-logo-upload";

const validationVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  submitted: "outline",
  validated: "default",
  deprecated: "destructive",
};

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brandResult = await getBrandById(id);
  if (brandResult.error !== null) notFound();
  const brand = brandResult.data;

  const productsResult = await listProducts({ brandId: brand.id });
  const brandProducts = productsResult.data ?? [];

  return (
    <div>
      <Button variant="ghost" size="sm" render={<Link href="/catalog" />} className="mb-1">
        <ArrowLeft className="size-4 mr-1" />
        Catalog
      </Button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} className="h-12 max-w-40 object-contain" />
        ) : (
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              {brand.name[0]}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-2xl font-semibold">{brand.name}</h1>
            <Badge variant={validationVariants[brand.validationStatus] ?? "secondary"}>
              {brand.validationStatus}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{brand.slug}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
        {/* Brand Info */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-1.5">Details</h2>

            {/* Logo Upload */}
            <div className="py-1 mb-1">
              <BrandLogoUpload
                brandId={brand.id}
                brandName={brand.name}
                logoUrl={brand.logoUrl}
                logoBwUrl={(brand as any).logoBwUrl}
              />
            </div>

            {brand.website && (
              <div className="py-1">
                <p className="text-xs text-muted-foreground mb-0.5">Website</p>
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {brand.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
            {brand.countryOfOrigin && (
              <div className="py-1">
                <p className="text-xs text-muted-foreground mb-0.5">Country of Origin</p>
                <p className="text-sm">{brand.countryOfOrigin}</p>
              </div>
            )}
            <div className="py-1">
              <p className="text-xs text-muted-foreground mb-0.5">Products in Catalog</p>
              <p className="text-sm">{brandProducts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products */}
      <h2 className="text-lg font-semibold mb-1.5">
        Products ({brandProducts.length})
      </h2>
      {brandProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No products found for this brand.
        </p>
      ) : (
        <Card className="rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brandProducts.map((product: any) => (
                <TableRow key={product.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/catalog/products/${product.id}`} className="block">
                      <div
                        className="w-5 h-5 rounded-full border border-border"
                        style={{ backgroundColor: product.colorHex || "#ccc" }}
                      />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/catalog/products/${product.id}`} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell>{product.colorName ?? "--"}</TableCell>
                  <TableCell>{product.netWeightG ? `${product.netWeightG}g` : "--"}</TableCell>
                  <TableCell>
                    <Badge variant={validationVariants[product.validationStatus] ?? "secondary"}>
                      {product.validationStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
