import { notFound } from "next/navigation";
import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import LinearProgress from "@mui/material/LinearProgress";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import { getProductWithRelations } from "@/lib/actions/central-catalog";
import { PageHeader } from "@/components/layout/page-header";

const validationColors: Record<string, "default" | "info" | "success" | "error"> = {
  draft: "default",
  submitted: "info",
  validated: "success",
  deprecated: "error",
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
      {children}
    </Typography>
  );
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProductWithRelations(id);
  if (result.error !== null) notFound();
  const p = result.data;

  const fp = p.filamentProfile;
  const brand = p.brand;
  const material = p.material;
  const allAliases = [
    ...(p.aliases ?? []).map((a: any) => ({
      ...a,
      direction: "outgoing" as const,
      otherProduct: a.relatedProduct,
    })),
    ...(p.aliasedBy ?? []).map((a: any) => ({
      ...a,
      direction: "incoming" as const,
      otherProduct: a.product,
    })),
  ];

  return (
    <div>
      {/* Back link */}
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
        {brand?.logoUrl ? (
          <Avatar src={brand.logoUrl} sx={{ width: 48, height: 48 }} />
        ) : brand ? (
          <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.light", color: "primary.main" }}>
            {brand.name[0]}
          </Avatar>
        ) : null}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="h4" fontWeight={600}>
              {p.name}
            </Typography>
            <Chip
              label={p.validationStatus}
              size="small"
              color={validationColors[p.validationStatus] ?? "default"}
            />
            {p.discontinued && <Chip label="Discontinued" size="small" color="error" variant="outlined" />}
          </Box>
          {brand && (
            <Typography
              variant="body2"
              color="text.secondary"
              component={Link}
              href={`/catalog/brands/${brand.id}`}
              sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              {brand.name}
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5 }}>
        {/* Color Section */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <SectionTitle>Color</SectionTitle>
            <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "flex-start" }}>
              {/* Main swatch */}
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: 2,
                  bgcolor: p.colorHex || "#ccc",
                  border: 1,
                  borderColor: "divider",
                  flexShrink: 0,
                  ...(p.translucent ? { opacity: 0.7 } : {}),
                }}
              />
              <Box>
                <Field label="Color Name" value={p.colorName} />
                <Field label="Hex" value={p.colorHex} />
                {p.colorParent && <Field label="Parent Category" value={p.colorParent} />}
              </Box>
            </Box>

            {/* Lab values */}
            {(p.colorLabL != null || p.colorLabA != null || p.colorLabB != null) && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  CIE Lab Values
                </Typography>
                <Stack direction="row" spacing={2}>
                  {p.colorLabL != null && (
                    <Chip label={`L* ${p.colorLabL.toFixed(2)}`} size="small" variant="outlined" />
                  )}
                  {p.colorLabA != null && (
                    <Chip label={`a* ${p.colorLabA.toFixed(2)}`} size="small" variant="outlined" />
                  )}
                  {p.colorLabB != null && (
                    <Chip label={`b* ${p.colorLabB.toFixed(2)}`} size="small" variant="outlined" />
                  )}
                </Stack>
              </Box>
            )}

            {/* Color matches */}
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5, mb: 1 }}>
              {p.closestPantone && <Chip label={`Pantone ${p.closestPantone}`} size="small" color="info" variant="outlined" />}
              {p.closestRal && <Chip label={`RAL ${p.closestRal}`} size="small" color="info" variant="outlined" />}
              {p.closestPms && <Chip label={`PMS ${p.closestPms}`} size="small" color="info" variant="outlined" />}
            </Stack>

            {/* Multi-color */}
            {p.multiColorHexes && p.multiColorHexes.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  Multi-Color {p.multiColorDirection && `(${p.multiColorDirection})`}
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  {p.multiColorHexes.map((hex: string, i: number) => (
                    <Tooltip key={i} title={hex}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1,
                          bgcolor: hex,
                          border: 1,
                          borderColor: "divider",
                        }}
                      />
                    </Tooltip>
                  ))}
                  {p.multiColorDirection && (
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center", ml: 1 }}>
                      {p.multiColorDirection === "coaxial" ? "Concentric layers" : "Along filament length"}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            {/* Appearance badges */}
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.5 }}>
              {p.translucent && <Chip label="Translucent" size="small" color="info" />}
              {p.glow && <Chip label="Glow" size="small" color="warning" />}
              {p.finish && <Chip label={p.finish.charAt(0).toUpperCase() + p.finish.slice(1)} size="small" variant="outlined" />}
              {p.pattern && p.pattern !== "solid" && (
                <Chip label={p.pattern.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} size="small" variant="outlined" />
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Specifications */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <SectionTitle>Specifications</SectionTitle>
            {material && (
              <Box sx={{ py: 0.75 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                  Material
                </Typography>
                <Typography
                  variant="body2"
                  component={Link}
                  href={`/catalog/materials/${material.id}`}
                  sx={{ textDecoration: "none", color: "info.main", "&:hover": { textDecoration: "underline" } }}
                >
                  {material.name} {material.abbreviation ? `(${material.abbreviation})` : ""}
                </Typography>
              </Box>
            )}
            <Field label="Category" value={p.category} />
            <Field label="Diameter" value={fp?.diameter ? `${fp.diameter}mm` : null} />
            <Field label="Net Weight" value={p.netWeightG ? `${p.netWeightG}g` : null} />
            <Field label="Actual Net Weight" value={p.actualNetWeightG ? `${p.actualNetWeightG}g` : null} />
            <Field label="Package Weight" value={p.packageWeightG ? `${p.packageWeightG}g` : null} />
            <Field
              label="Package Style"
              value={p.packageStyle ? p.packageStyle.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : null}
            />
            <Field label="Package Barcode" value={p.packageBarcode ? `${p.packageBarcode}${p.packageBarcodeFormat ? ` (${p.packageBarcodeFormat})` : ""}` : null} />
            <Field label="Country of Origin" value={p.countryOfOrigin} />
            {p.certifications && p.certifications.length > 0 && (
              <Box sx={{ py: 0.75 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                  Certifications
                </Typography>
                <Stack direction="row" spacing={0.5}>
                  {p.certifications.map((cert: string, i: number) => (
                    <Chip key={i} label={cert} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}
            <Field label="GTIN" value={p.gtin} />
          </CardContent>
        </Card>

        {/* Filament Profile */}
        {fp && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <SectionTitle>Filament Profile</SectionTitle>

              {/* Temperatures */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1.5 }}>
                <Field
                  label="Nozzle Temp"
                  value={fp.nozzleTempMin || fp.nozzleTempMax ? `${fp.nozzleTempMin ?? "?"}--${fp.nozzleTempMax ?? "?"}°C` : null}
                />
                <Field
                  label="Bed Temp"
                  value={fp.bedTempMin || fp.bedTempMax ? `${fp.bedTempMin ?? "?"}--${fp.bedTempMax ?? "?"}°C` : null}
                />
                <Field
                  label="Chamber Temp"
                  value={fp.chamberTempMin || fp.chamberTempMax ? `${fp.chamberTempMin ?? "?"}--${fp.chamberTempMax ?? "?"}°C` : fp.chamberTemp ? `${fp.chamberTemp}°C` : null}
                />
                <Field label="Preheat Temp" value={fp.preheatTemp ? `${fp.preheatTemp}°C` : null} />
              </Box>

              {/* Drying */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1.5 }}>
                <Field label="Drying Temp" value={fp.dryingTemp ? `${fp.dryingTemp}°C` : null} />
                <Field label="Drying Time" value={fp.dryingTimeMin ? `${fp.dryingTimeMin} min` : null} />
              </Box>

              {/* Physical */}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1.5 }}>
                <Field label="Diameter" value={fp.diameter ? `${fp.diameter}mm` : null} />
                <Field label="Measured Diameter" value={fp.measuredDiameter ? `${fp.measuredDiameter}mm` : null} />
                <Field label="Diameter Tolerance" value={fp.diameterTolerance ? `±${fp.diameterTolerance}mm` : null} />
                <Field label="Min Nozzle Diameter" value={fp.minNozzleDiameter ? `${fp.minNozzleDiameter}mm` : null} />
                <Field label="Filament Length" value={fp.filamentLengthM ? `${fp.filamentLengthM}m` : null} />
                <Field label="Actual Filament Length" value={fp.actualFilamentLengthM ? `${fp.actualFilamentLengthM}m` : null} />
              </Box>

              {/* Speeds / flow */}
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1.5 }}>
                <Field label="Flow Ratio" value={fp.defaultFlowRatio} />
                <Field label="Pressure Advance" value={fp.defaultPressureAdvance} />
                <Field label="Fan Speed Min" value={fp.fanSpeedMin != null ? `${fp.fanSpeedMin}%` : null} />
                <Field label="Min Volumetric Speed" value={fp.minVolumetricSpeed ? `${fp.minVolumetricSpeed} mm³/s` : null} />
                <Field label="Max Volumetric Speed" value={fp.maxVolumetricSpeed ? `${fp.maxVolumetricSpeed} mm³/s` : null} />
                <Field label="Target Volumetric Speed" value={fp.targetVolumetricSpeed ? `${fp.targetVolumetricSpeed} mm³/s` : null} />
              </Box>

              {/* Transmission Distance */}
              {fp.transmissionDistance != null && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    Transmission Distance (HueForge)
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((fp.transmissionDistance / 8) * 100, 100)}
                        sx={{
                          height: 12,
                          borderRadius: 1,
                          bgcolor: "grey.200",
                          "& .MuiLinearProgress-bar": {
                            bgcolor: p.colorHex || "primary.main",
                            borderRadius: 1,
                          },
                        }}
                      />
                    </Box>
                    <Typography variant="body2" fontWeight={600}>
                      {fp.transmissionDistance.toFixed(2)}
                    </Typography>
                  </Box>
                  {fp.tdVoteCount != null && (
                    <Typography variant="caption" color="text.secondary">
                      Based on {fp.tdVoteCount} vote{fp.tdVoteCount !== 1 ? "s" : ""}
                    </Typography>
                  )}
                </>
              )}

              {/* Spool dimensions */}
              {(fp.spoolOuterDiameterMm || fp.spoolInnerDiameterMm || fp.spoolWidthMm) && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Spool Dimensions</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                    <Field label="Outer Diameter" value={fp.spoolOuterDiameterMm ? `${fp.spoolOuterDiameterMm}mm` : null} />
                    <Field label="Inner Diameter" value={fp.spoolInnerDiameterMm ? `${fp.spoolInnerDiameterMm}mm` : null} />
                    <Field label="Width" value={fp.spoolWidthMm ? `${fp.spoolWidthMm}mm` : null} />
                    <Field label="Hub Hole Diameter" value={fp.spoolHubHoleDiameterMm ? `${fp.spoolHubHoleDiameterMm}mm` : null} />
                    <Field label="Rim Depth" value={fp.spoolRimDepthMm ? `${fp.spoolRimDepthMm}mm` : null} />
                    <Field label="Spool Material" value={fp.spoolMaterialType} />
                    <Field label="Spool Color" value={fp.spoolColor} />
                    <Field label="Spool Weight" value={fp.spoolWeightG ? `${fp.spoolWeightG}g` : null} />
                    <Field label="Cardboard Insert" value={fp.spoolHasCardboardInsert ? "Yes" : null} />
                    <Field label="Winding Width" value={fp.windingWidthMm ? `${fp.windingWidthMm}mm` : null} />
                    <Field label="Winding Diameter" value={fp.windingDiameterMm ? `${fp.windingDiameterMm}mm` : null} />
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* External Links */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <SectionTitle>External Links</SectionTitle>
            <Stack spacing={1}>
              {p.externalFilamentColorsSlug && (
                <Typography variant="body2">
                  <a
                    href={`https://filamentcolors.xyz/swatch/${p.externalFilamentColorsSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    FilamentColors.xyz <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </a>
                </Typography>
              )}
              {p.externalSpoolmanDbId && (
                <Typography variant="body2">
                  <a
                    href={`https://github.com/Donkie/SpoolmanDB/blob/main/filaments/${p.externalSpoolmanDbId}.json`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    SpoolmanDB: {p.externalSpoolmanDbId} <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </a>
                </Typography>
              )}
              {p.websiteUrl && (
                <Typography variant="body2">
                  <a
                    href={p.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    Product Website <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </a>
                </Typography>
              )}
              {p.amazonAsin && (
                <Typography variant="body2">
                  <a
                    href={`https://www.amazon.com/dp/${p.amazonAsin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    Amazon: {p.amazonAsin} <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </a>
                </Typography>
              )}
              {p.external3dFpShortCode && (
                <Field label="3DFP Short Code" value={p.external3dFpShortCode} />
              )}
              {!p.externalFilamentColorsSlug && !p.externalSpoolmanDbId && !p.websiteUrl && !p.amazonAsin && !p.external3dFpShortCode && (
                <Typography variant="body2" color="text.secondary">No external links available.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Aliases / Equivalences */}
        {allAliases.length > 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <SectionTitle>Aliases / Equivalences</SectionTitle>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Confidence</TableCell>
                      <TableCell>Bidir.</TableCell>
                      <TableCell>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allAliases.map((alias: any) => (
                      <TableRow key={alias.id}>
                        <TableCell>
                          <Typography
                            variant="body2"
                            component={Link}
                            href={`/catalog/products/${alias.otherProduct?.id}`}
                            sx={{ textDecoration: "none", color: "info.main", "&:hover": { textDecoration: "underline" } }}
                          >
                            {alias.otherProduct?.brand?.name ? `${alias.otherProduct.brand.name} ` : ""}
                            {alias.otherProduct?.name ?? "Unknown"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={alias.aliasType.replace(/_/g, " ")}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {alias.confidence != null ? `${(alias.confidence * 100).toFixed(0)}%` : "--"}
                        </TableCell>
                        <TableCell>{alias.bidirectional ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {alias.source ?? "--"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* SKU Mappings */}
        {p.skuMappings && p.skuMappings.length > 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <SectionTitle>SKU Mappings</SectionTitle>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>SKU</TableCell>
                      <TableCell>Barcode</TableCell>
                      <TableCell>GTIN</TableCell>
                      <TableCell>Retailer</TableCell>
                      <TableCell>Price</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {p.skuMappings.map((sku: any) => (
                      <TableRow key={sku.id}>
                        <TableCell>{sku.sku ?? "--"}</TableCell>
                        <TableCell>
                          {sku.barcode ?? "--"}
                          {sku.barcodeFormat && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                              ({sku.barcodeFormat})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{sku.gtin ?? "--"}</TableCell>
                        <TableCell>
                          {sku.productUrl ? (
                            <a href={sku.productUrl} target="_blank" rel="noopener noreferrer">
                              {sku.retailer ?? "Link"} <OpenInNewIcon sx={{ fontSize: 12 }} />
                            </a>
                          ) : (
                            sku.retailer ?? "--"
                          )}
                        </TableCell>
                        <TableCell>
                          {sku.priceAmount != null
                            ? `${sku.priceCurrency ?? "$"}${sku.priceAmount.toFixed(2)}`
                            : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* NFC Tag Patterns */}
        {p.nfcTagPatterns && p.nfcTagPatterns.length > 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <SectionTitle>NFC Tag Patterns</SectionTitle>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Format</TableCell>
                      <TableCell>Identifiers</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {p.nfcTagPatterns.map((pat: any) => {
                      const ids: string[] = [];
                      if (pat.bambuVariantId) ids.push(`Bambu Variant: ${pat.bambuVariantId}`);
                      if (pat.bambuMaterialId) ids.push(`Bambu Material: ${pat.bambuMaterialId}`);
                      if (pat.tigerTagProductId != null) ids.push(`TigerTag Product: ${pat.tigerTagProductId}`);
                      if (pat.tigerTagMaterialId != null) ids.push(`TigerTag Material: ${pat.tigerTagMaterialId}`);
                      if (pat.optPackageUuid) ids.push(`OPT Package: ${pat.optPackageUuid}`);
                      if (pat.openSpoolVendor) ids.push(`OpenSpool: ${pat.openSpoolVendor} / ${pat.openSpoolType ?? ""}`);
                      if (pat.patternField) ids.push(`${pat.patternField}: ${pat.patternValue}`);
                      return (
                        <TableRow key={pat.id}>
                          <TableCell>
                            <Chip label={pat.tagFormat.replace(/_/g, " ")} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            {ids.length > 0 ? (
                              <Stack spacing={0.25}>
                                {ids.map((id, i) => (
                                  <Typography key={i} variant="caption">{id}</Typography>
                                ))}
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary">--</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={pat.validationStatus}
                              size="small"
                              color={validationColors[pat.validationStatus] ?? "default"}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}
      </Box>
    </div>
  );
}
