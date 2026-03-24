import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";
import { getProductWithRelations } from "@/lib/actions/central-catalog";
import { amazonAffiliateUrl, amazonSearchUrl, RESELLER_INFO, affiliateUrl } from "@/lib/services/affiliate";

const validationVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  submitted: "outline",
  validated: "default",
  deprecated: "destructive",
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold mb-1.5">{children}</h2>;
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
    <TooltipProvider>
      <div>
        {/* Back link */}
        <Button variant="ghost" size="sm" render={<Link href="/catalog" />} className="mb-1">
          <ArrowLeft className="size-4 mr-1" />
          Catalog
        </Button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          {brand?.logoUrl ? (
            <Avatar className="size-12">
              <AvatarImage src={brand.logoUrl} />
              <AvatarFallback>{brand.name[0]}</AvatarFallback>
            </Avatar>
          ) : brand ? (
            <Avatar className="size-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {brand.name[0]}
              </AvatarFallback>
            </Avatar>
          ) : null}
          <div className="flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-2xl font-semibold">{p.name}</h1>
              <Badge variant={validationVariants[p.validationStatus] ?? "secondary"}>
                {p.validationStatus}
              </Badge>
              {p.discontinued && <Badge variant="destructive">Discontinued</Badge>}
            </div>
            {brand && (
              <Link
                href={`/catalog/brands/${brand.id}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                {brand.name}
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Color Section */}
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <SectionTitle>Color</SectionTitle>
              <div className="flex gap-2 mb-2 items-start">
                {/* Main swatch */}
                <div
                  className="w-20 h-20 rounded-lg border border-border shrink-0"
                  style={{
                    backgroundColor: p.colorHex || "#ccc",
                    ...(p.translucent ? { opacity: 0.7 } : {}),
                  }}
                />
                <div>
                  <Field label="Color Name" value={p.colorName} />
                  <Field label="Hex" value={p.colorHex} />
                  {p.colorParent && <Field label="Parent Category" value={p.colorParent} />}
                </div>
              </div>

              {/* Lab values */}
              {(p.colorLabL != null || p.colorLabA != null || p.colorLabB != null) && (
                <div className="mb-1.5">
                  <p className="text-xs text-muted-foreground mb-1">CIE Lab Values</p>
                  <div className="flex gap-2">
                    {p.colorLabL != null && <Badge variant="outline">L* {p.colorLabL.toFixed(2)}</Badge>}
                    {p.colorLabA != null && <Badge variant="outline">a* {p.colorLabA.toFixed(2)}</Badge>}
                    {p.colorLabB != null && <Badge variant="outline">b* {p.colorLabB.toFixed(2)}</Badge>}
                  </div>
                </div>
              )}

              {/* Color matches */}
              <div className="flex flex-wrap gap-1 mb-1">
                {p.closestPantone && <Badge variant="outline">Pantone {p.closestPantone}</Badge>}
                {p.closestRal && <Badge variant="outline">RAL {p.closestRal}</Badge>}
                {p.closestPms && <Badge variant="outline">PMS {p.closestPms}</Badge>}
              </div>

              {/* Multi-color */}
              {p.multiColorHexes && p.multiColorHexes.length > 0 && (
                <div className="mb-1.5">
                  <p className="text-xs text-muted-foreground mb-1">
                    Multi-Color {p.multiColorDirection && `(${p.multiColorDirection})`}
                  </p>
                  <div className="flex gap-1 items-center">
                    {p.multiColorHexes.map((hex: string, i: number) => (
                      <Tooltip key={i}>
                        <TooltipTrigger
                          render={
                            <div
                              className="w-7 h-7 rounded border border-border cursor-default"
                              style={{ backgroundColor: hex }}
                            />
                          }
                        />
                        <TooltipContent>{hex}</TooltipContent>
                      </Tooltip>
                    ))}
                    {p.multiColorDirection && (
                      <span className="text-xs text-muted-foreground ml-1">
                        {p.multiColorDirection === "coaxial" ? "Concentric layers" : "Along filament length"}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Appearance badges */}
              <div className="flex flex-wrap gap-1">
                {p.translucent && <Badge>Translucent</Badge>}
                {p.glow && <Badge className="bg-amber-500">Glow</Badge>}
                {p.finish && <Badge variant="outline">{p.finish.charAt(0).toUpperCase() + p.finish.slice(1)}</Badge>}
                {p.pattern && p.pattern !== "solid" && (
                  <Badge variant="outline">{p.pattern.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Specifications */}
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <SectionTitle>Specifications</SectionTitle>
              {material && (
                <div className="py-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Material</p>
                  <Link
                    href={`/catalog/materials/${material.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {material.name} {material.abbreviation ? `(${material.abbreviation})` : ""}
                  </Link>
                </div>
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
                <div className="py-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Certifications</p>
                  <div className="flex gap-1">
                    {p.certifications.map((cert: string, i: number) => (
                      <Badge key={i} variant="outline">{cert}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <Field label="GTIN" value={p.gtin} />
            </CardContent>
          </Card>

          {/* Filament Profile */}
          {fp && (
            <Card className="rounded-xl">
              <CardContent className="p-4">
                <SectionTitle>Filament Profile</SectionTitle>

                {/* Temperatures */}
                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  <Field
                    label="Nozzle Temp"
                    value={fp.nozzleTempMin || fp.nozzleTempMax ? `${fp.nozzleTempMin ?? "?"}--${fp.nozzleTempMax ?? "?"}\u00B0C` : null}
                  />
                  <Field
                    label="Bed Temp"
                    value={fp.bedTempMin || fp.bedTempMax ? `${fp.bedTempMin ?? "?"}--${fp.bedTempMax ?? "?"}\u00B0C` : null}
                  />
                  <Field
                    label="Chamber Temp"
                    value={fp.chamberTempMin || fp.chamberTempMax ? `${fp.chamberTempMin ?? "?"}--${fp.chamberTempMax ?? "?"}\u00B0C` : fp.chamberTemp ? `${fp.chamberTemp}\u00B0C` : null}
                  />
                  <Field label="Preheat Temp" value={fp.preheatTemp ? `${fp.preheatTemp}\u00B0C` : null} />
                </div>

                {/* Drying */}
                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  <Field label="Drying Temp" value={fp.dryingTemp ? `${fp.dryingTemp}\u00B0C` : null} />
                  <Field label="Drying Time" value={fp.dryingTimeMin ? `${fp.dryingTimeMin} min` : null} />
                </div>

                {/* Physical */}
                <div className="border-t border-border my-1" />
                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  <Field label="Diameter" value={fp.diameter ? `${fp.diameter}mm` : null} />
                  <Field label="Measured Diameter" value={fp.measuredDiameter ? `${fp.measuredDiameter}mm` : null} />
                  <Field label="Diameter Tolerance" value={fp.diameterTolerance ? `\u00B1${fp.diameterTolerance}mm` : null} />
                  <Field label="Min Nozzle Diameter" value={fp.minNozzleDiameter ? `${fp.minNozzleDiameter}mm` : null} />
                  <Field label="Filament Length" value={fp.filamentLengthM ? `${fp.filamentLengthM}m` : null} />
                  <Field label="Actual Filament Length" value={fp.actualFilamentLengthM ? `${fp.actualFilamentLengthM}m` : null} />
                </div>

                {/* Speeds / flow */}
                <div className="border-t border-border my-1" />
                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  <Field label="Flow Ratio" value={fp.defaultFlowRatio} />
                  <Field label="Pressure Advance" value={fp.defaultPressureAdvance} />
                  <Field label="Fan Speed Min" value={fp.fanSpeedMin != null ? `${fp.fanSpeedMin}%` : null} />
                  <Field label="Min Volumetric Speed" value={fp.minVolumetricSpeed ? `${fp.minVolumetricSpeed} mm\u00B3/s` : null} />
                  <Field label="Max Volumetric Speed" value={fp.maxVolumetricSpeed ? `${fp.maxVolumetricSpeed} mm\u00B3/s` : null} />
                  <Field label="Target Volumetric Speed" value={fp.targetVolumetricSpeed ? `${fp.targetVolumetricSpeed} mm\u00B3/s` : null} />
                </div>

                {/* Transmission Distance */}
                {fp.transmissionDistance != null && (
                  <>
                    <div className="border-t border-border my-1" />
                    <p className="text-xs text-muted-foreground mb-1">Transmission Distance (HueForge)</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${Math.min((fp.transmissionDistance / 8) * 100, 100)}%`,
                            backgroundColor: p.colorHex || "var(--primary)",
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold">{fp.transmissionDistance.toFixed(2)}</span>
                    </div>
                    {fp.tdVoteCount != null && (
                      <p className="text-xs text-muted-foreground">
                        Based on {fp.tdVoteCount} vote{fp.tdVoteCount !== 1 ? "s" : ""}
                      </p>
                    )}
                  </>
                )}

                {/* Spool dimensions */}
                {(fp.spoolOuterDiameterMm || fp.spoolInnerDiameterMm || fp.spoolWidthMm) && (
                  <>
                    <div className="border-t border-border my-1" />
                    <p className="text-sm font-medium mb-1">Spool Dimensions</p>
                    <div className="grid grid-cols-2 gap-1">
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
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Where to Buy */}
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <SectionTitle>Where to Buy</SectionTitle>
              <div className="flex flex-col gap-2">
                {/* Amazon — from ASIN or search */}
                {p.amazonAsin ? (
                  <a
                    href={amazonAffiliateUrl(p.amazonAsin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: "#FF990020" }}>
                      <ShoppingCart className="size-5" style={{ color: "#FF9900" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Amazon</p>
                      <p className="text-xs text-muted-foreground">ASIN: {p.amazonAsin}</p>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                  </a>
                ) : (
                  <a
                    href={amazonSearchUrl(`${brand?.name ?? ""} ${p.name}`.trim())}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: "#FF990020" }}>
                      <ShoppingCart className="size-5" style={{ color: "#FF9900" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Search on Amazon</p>
                      <p className="text-xs text-muted-foreground truncate">{brand?.name ?? ""} {p.name}</p>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                  </a>
                )}

                {/* Reseller links from DB */}
                {(p.resellerLinks ?? []).map((link: any) => {
                  const info = RESELLER_INFO[link.reseller] ?? RESELLER_INFO.other;
                  const url = affiliateUrl(link.reseller, link.affiliateUrl ?? link.url);
                  const hasDiscount = link.listPrice && link.salePrice && link.salePrice < link.listPrice;
                  const hasCoupon = link.couponCode && (!link.couponExpiresAt || new Date(link.couponExpiresAt) > new Date());
                  const tiers = (link.priceTiers ?? []).filter((t: any) => !t.expiresAt || new Date(t.expiresAt) > new Date());
                  return (
                    <div key={link.id} className="rounded-lg border border-border overflow-hidden">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: `${info.color}20` }}>
                          <span>{info.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{info.name}</p>
                          <div className="flex items-center gap-1.5">
                            {hasDiscount ? (
                              <>
                                <span className="text-xs font-semibold text-green-600">${link.salePrice.toFixed(2)}</span>
                                <span className="text-xs text-muted-foreground line-through">${link.listPrice.toFixed(2)}</span>
                                <Badge variant="destructive" className="text-[0.6rem] h-4 px-1">
                                  {Math.round((1 - link.salePrice / link.listPrice) * 100)}% off
                                </Badge>
                              </>
                            ) : link.price != null ? (
                              <span className="text-xs font-semibold text-green-600">${link.price.toFixed(2)}</span>
                            ) : null}
                            {link.inStock === false && <Badge variant="outline" className="text-[0.6rem] h-4 px-1 text-red-500 border-red-200">Out of stock</Badge>}
                          </div>
                        </div>
                        <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                      </a>
                      {/* Coupon */}
                      {hasCoupon && (
                        <div className="px-3 pb-2 flex items-center gap-1.5">
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[0.65rem]">
                            {link.couponCode}
                          </Badge>
                          {link.couponDiscountPct && (
                            <span className="text-xs text-amber-700">Save {link.couponDiscountPct}%</span>
                          )}
                          {link.couponExpiresAt && (
                            <span className="text-[0.6rem] text-muted-foreground">
                              expires {new Date(link.couponExpiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Bulk tiers */}
                      {tiers.length > 0 && (
                        <div className="px-3 pb-2 flex flex-wrap gap-1">
                          {tiers.map((tier: any) => (
                            <Badge key={tier.id} variant="outline" className="text-[0.6rem]">
                              {tier.minQuantity}+: ${tier.price.toFixed(2)}
                              {tier.discountLabel && ` (${tier.discountLabel})`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Manufacturer website */}
                {p.websiteUrl && (
                  <a
                    href={p.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted text-lg">
                      🏭
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Manufacturer</p>
                      <p className="text-xs text-muted-foreground truncate">{p.websiteUrl.replace(/^https?:\/\//, "")}</p>
                    </div>
                    <ExternalLink className="size-4 text-muted-foreground shrink-0" />
                  </a>
                )}
              </div>

              {/* Reference Links */}
              {(p.externalSpoolmanDbId || p.externalFilamentColorsSlug || p.external3dFpShortCode) && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1.5">Reference</p>
                  <div className="flex flex-col gap-0.5">
                    {p.externalSpoolmanDbId && (
                      <a href={`https://github.com/Donkie/SpoolmanDB`} target="_blank" rel="noopener noreferrer"
                        className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                        SpoolmanDB <ExternalLink className="size-3" />
                      </a>
                    )}
                    {p.externalFilamentColorsSlug && (
                      <a href={`https://filamentcolors.xyz/swatch/${p.externalFilamentColorsSlug}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                        FilamentColors.xyz <ExternalLink className="size-3" />
                      </a>
                    )}
                    {p.external3dFpShortCode && (
                      <span className="text-xs text-muted-foreground">3DFP: {p.external3dFpShortCode}</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equivalent Products & Price Comparison */}
          {allAliases.length > 0 && (() => {
            // Build comparison data: this product + all equivalents with their best price
            const getBestPrice = (prod: any) => {
              const links = prod.resellerLinks ?? [];
              if (links.length === 0) return null;
              let best = Infinity;
              for (const l of links) {
                const effective = l.salePrice ?? l.price;
                if (effective != null && effective < best) best = effective;
              }
              return best === Infinity ? null : best;
            };

            const thisPrice = getBestPrice(p);
            const equivalents = allAliases
              .map((alias: any) => {
                const other = alias.otherProduct;
                if (!other) return null;
                const bestPrice = getBestPrice(other);
                return {
                  id: other.id,
                  name: other.name,
                  brandName: other.brand?.name,
                  colorHex: other.colorHex,
                  aliasType: alias.aliasType,
                  confidence: alias.confidence,
                  bestPrice,
                  resellerCount: (other.resellerLinks ?? []).length,
                };
              })
              .filter(Boolean)
              .sort((a: any, b: any) => {
                // Sort: cheapest first, then products with prices before those without
                if (a.bestPrice != null && b.bestPrice != null) return a.bestPrice - b.bestPrice;
                if (a.bestPrice != null) return -1;
                if (b.bestPrice != null) return 1;
                return 0;
              });

            const cheapest = equivalents.find((e: any) => e.bestPrice != null);
            const isCheapest = !cheapest || (thisPrice != null && thisPrice <= cheapest.bestPrice);

            return (
              <Card className="rounded-xl md:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <SectionTitle>Equivalent Products</SectionTitle>
                    {cheapest && !isCheapest && (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        Cheaper option: ${cheapest.bestPrice.toFixed(2)} at {cheapest.brandName ?? "other brand"}
                      </Badge>
                    )}
                    {isCheapest && thisPrice != null && equivalents.length > 0 && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        Best price
                      </Badge>
                    )}
                  </div>

                  {/* This product row */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-primary/20 mb-1.5">
                    <div className="w-6 h-6 rounded-full border border-border shrink-0" style={{ backgroundColor: p.colorHex || "#ccc" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{brand?.name ? `${brand.name} ` : ""}{p.name}</p>
                      <p className="text-xs text-muted-foreground">This product</p>
                    </div>
                    {thisPrice != null ? (
                      <span className="text-sm font-bold text-green-600 shrink-0">${thisPrice.toFixed(2)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">No price</span>
                    )}
                  </div>

                  {/* Equivalent product rows */}
                  <div className="flex flex-col gap-1">
                    {equivalents.map((eq: any) => (
                      <Link
                        key={eq.id}
                        href={`/catalog/products/${eq.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full border border-border shrink-0" style={{ backgroundColor: eq.colorHex || "#ccc" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{eq.brandName ? `${eq.brandName} ` : ""}{eq.name}</p>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[0.6rem] h-4 px-1">
                              {eq.aliasType.replace(/_/g, " ")}
                            </Badge>
                            {eq.confidence != null && (
                              <span className="text-[0.6rem] text-muted-foreground">{(eq.confidence * 100).toFixed(0)}% match</span>
                            )}
                          </div>
                        </div>
                        {eq.bestPrice != null ? (
                          <span className={`text-sm font-bold shrink-0 ${
                            thisPrice != null && eq.bestPrice < thisPrice ? "text-green-600" :
                            thisPrice != null && eq.bestPrice > thisPrice ? "text-muted-foreground" :
                            "text-foreground"
                          }`}>
                            ${eq.bestPrice.toFixed(2)}
                            {thisPrice != null && eq.bestPrice < thisPrice && (
                              <span className="text-xs ml-1">(-${(thisPrice - eq.bestPrice).toFixed(2)})</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground shrink-0">No price</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* SKU Mappings */}
          {p.skuMappings && p.skuMappings.length > 0 && (
            <Card className="rounded-xl">
              <CardContent className="p-4">
                <SectionTitle>SKU Mappings</SectionTitle>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>GTIN</TableHead>
                      <TableHead>Retailer</TableHead>
                      <TableHead>Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.skuMappings.map((sku: any) => (
                      <TableRow key={sku.id}>
                        <TableCell>{sku.sku ?? "--"}</TableCell>
                        <TableCell>
                          {sku.barcode ?? "--"}
                          {sku.barcodeFormat && (
                            <span className="text-xs text-muted-foreground ml-0.5">
                              ({sku.barcodeFormat})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{sku.gtin ?? "--"}</TableCell>
                        <TableCell>
                          {sku.productUrl ? (
                            <a href={sku.productUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                              {sku.retailer ?? "Link"} <ExternalLink className="size-3" />
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
              </CardContent>
            </Card>
          )}

          {/* NFC Tag Patterns */}
          {p.nfcTagPatterns && p.nfcTagPatterns.length > 0 && (
            <Card className="rounded-xl">
              <CardContent className="p-4">
                <SectionTitle>NFC Tag Patterns</SectionTitle>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Format</TableHead>
                      <TableHead>Identifiers</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
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
                            <Badge variant="outline">{pat.tagFormat.replace(/_/g, " ")}</Badge>
                          </TableCell>
                          <TableCell>
                            {ids.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {ids.map((id, i) => (
                                  <span key={i} className="text-xs">{id}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={validationVariants[pat.validationStatus] ?? "secondary"}>
                              {pat.validationStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
