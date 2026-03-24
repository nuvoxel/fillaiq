import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getMaterialById, listProducts } from "@/lib/actions/central-catalog";

const validationVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  submitted: "outline",
  validated: "default",
  deprecated: "destructive",
};

const materialClassVariants: Record<string, "default" | "secondary"> = {
  fff: "default",
  sla: "secondary",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <div className="py-1">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const materialResult = await getMaterialById(id);
  if (materialResult.error !== null) notFound();
  const mat = materialResult.data;

  const productsResult = await listProducts({ materialId: mat.id });
  const matProducts = productsResult.data ?? [];

  return (
    <div>
      <Button variant="ghost" size="sm" render={<Link href="/catalog" />} className="mb-1">
        <ArrowLeft className="size-4 mr-1" />
        Catalog
      </Button>

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <h1 className="text-2xl font-semibold">{mat.name}</h1>
        {mat.abbreviation && (
          <Badge variant="outline">{mat.abbreviation}</Badge>
        )}
        {mat.materialClass && (
          <Badge variant={materialClassVariants[mat.materialClass] ?? "secondary"}>
            {mat.materialClass.toUpperCase()}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
        {/* Properties */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-1.5">Properties</h2>
            <Field label="Category" value={mat.category} />
            <Field label="ISO Classification" value={mat.isoClassification} />
            <Field label="Density" value={mat.density != null ? `${mat.density} g/cm\u00B3` : null} />
            <Field label="Hygroscopic" value={mat.hygroscopic ? "Yes" : null} />
            <Field label="Default Drying Temp" value={mat.defaultDryingTemp ? `${mat.defaultDryingTemp}\u00B0C` : null} />
            <Field label="Default Drying Time" value={mat.defaultDryingTimeMin ? `${mat.defaultDryingTimeMin} min` : null} />
          </CardContent>
        </Card>

        {/* Fill & Hardness */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-1.5">Fill &amp; Hardness</h2>
            <Field
              label="Fill Type"
              value={mat.fillType ? mat.fillType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : null}
            />
            <Field label="Fill Percentage" value={mat.fillPercentage != null ? `${mat.fillPercentage}%` : null} />
            <Field label="Fiber Length" value={mat.fiberLengthMm != null ? `${mat.fiberLengthMm}mm` : null} />
            <Field label="Shore Hardness A" value={mat.shoreHardnessA} />
            <Field label="Shore Hardness D" value={mat.shoreHardnessD} />
          </CardContent>
        </Card>
      </div>

      {/* Products */}
      <h2 className="text-lg font-semibold mb-1.5">
        Products ({matProducts.length})
      </h2>
      {matProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No products found using this material.
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
              {matProducts.map((product: any) => (
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
