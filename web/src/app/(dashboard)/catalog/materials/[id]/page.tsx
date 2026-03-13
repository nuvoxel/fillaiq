import { notFound } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Button from "@mui/material/Button";
import { getMaterialById, listProducts } from "@/lib/actions/central-catalog";

const validationColors: Record<string, "default" | "info" | "success" | "error"> = {
  draft: "default",
  submitted: "info",
  validated: "success",
  deprecated: "error",
};

const materialClassColors: Record<string, "primary" | "secondary"> = {
  fff: "primary",
  sla: "secondary",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
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
      <Button
        component={Link}
        href="/catalog"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 1, textTransform: "none" }}
      >
        Catalog
      </Button>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
        <Typography variant="h4" fontWeight={600}>
          {mat.name}
        </Typography>
        {mat.abbreviation && (
          <Chip label={mat.abbreviation} size="small" variant="outlined" />
        )}
        {mat.materialClass && (
          <Chip
            label={mat.materialClass.toUpperCase()}
            size="small"
            color={materialClassColors[mat.materialClass] ?? "default"}
          />
        )}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, mb: 3 }}>
        {/* Properties */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
              Properties
            </Typography>
            <Field label="Category" value={mat.category} />
            <Field label="ISO Classification" value={mat.isoClassification} />
            <Field label="Density" value={mat.density != null ? `${mat.density} g/cm³` : null} />
            <Field label="Hygroscopic" value={mat.hygroscopic ? "Yes" : null} />
            <Field label="Default Drying Temp" value={mat.defaultDryingTemp ? `${mat.defaultDryingTemp}°C` : null} />
            <Field label="Default Drying Time" value={mat.defaultDryingTimeMin ? `${mat.defaultDryingTimeMin} min` : null} />
          </CardContent>
        </Card>

        {/* Fill & Hardness */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
              Fill &amp; Hardness
            </Typography>
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
      </Box>

      {/* Products */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
        Products ({matProducts.length})
      </Typography>
      {matProducts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No products found using this material.
        </Typography>
      ) : (
        <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40}></TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Color</TableCell>
                <TableCell>Weight</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matProducts.map((product: any) => (
                <TableRow
                  key={product.id}
                  hover
                  sx={{ cursor: "pointer", textDecoration: "none" }}
                  component={Link}
                  href={`/catalog/products/${product.id}`}
                >
                  <TableCell>
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        bgcolor: product.colorHex || "#ccc",
                        border: 1,
                        borderColor: "divider",
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {product.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{product.colorName ?? "--"}</TableCell>
                  <TableCell>{product.netWeightG ? `${product.netWeightG}g` : "--"}</TableCell>
                  <TableCell>
                    <Chip
                      label={product.validationStatus}
                      size="small"
                      color={validationColors[product.validationStatus] ?? "default"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
