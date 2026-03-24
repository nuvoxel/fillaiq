import { notFound } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Button from "@mui/material/Button";
import { getBrandById, listProducts } from "@/lib/actions/central-catalog";
import { PageHeader } from "@/components/layout/page-header";
import { BrandLogoUpload } from "@/components/catalog/brand-logo-upload";

const validationColors: Record<string, "default" | "info" | "success" | "error"> = {
  draft: "default",
  submitted: "info",
  validated: "success",
  deprecated: "error",
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        {brand.logoUrl ? (
          <Box component="img" src={brand.logoUrl} alt={brand.name}
            sx={{ height: 48, maxWidth: 160, objectFit: "contain" }} />
        ) : (
          <Avatar sx={{ width: 64, height: 64, bgcolor: "primary.light", color: "primary.main", fontSize: 24 }}>
            {brand.name[0]}
          </Avatar>
        )}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="h4" fontWeight={600}>
              {brand.name}
            </Typography>
            <Chip
              label={brand.validationStatus}
              size="small"
              color={validationColors[brand.validationStatus] ?? "default"}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {brand.slug}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, mb: 3 }}>
        {/* Brand Info */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
              Details
            </Typography>

            {/* Logo Upload */}
            <Box sx={{ py: 1, mb: 1 }}>
              <BrandLogoUpload
                brandId={brand.id}
                brandName={brand.name}
                logoUrl={brand.logoUrl}
                logoBwUrl={(brand as any).logoBwUrl}
              />
            </Box>

            {brand.website && (
              <Box sx={{ py: 0.75 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                  Website
                </Typography>
                <Typography variant="body2">
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    {brand.website.replace(/^https?:\/\//, "")} <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </a>
                </Typography>
              </Box>
            )}
            {brand.countryOfOrigin && (
              <Box sx={{ py: 0.75 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                  Country of Origin
                </Typography>
                <Typography variant="body2">{brand.countryOfOrigin}</Typography>
              </Box>
            )}
            <Box sx={{ py: 0.75 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                Products in Catalog
              </Typography>
              <Typography variant="body2">{brandProducts.length}</Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Products */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
        Products ({brandProducts.length})
      </Typography>
      {brandProducts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No products found for this brand.
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
              {brandProducts.map((product: any) => (
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
