"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Pencil, Trash2, Usb, Bluetooth, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/layout/page-header";
import { listBrands, removeBrand, listMaterials, removeMaterial, listProducts, removeProduct } from "@/lib/actions/central-catalog";
import { listHardwareModels, removeHardwareModel } from "@/lib/actions/hardware-catalog";
import { HardwareModelDialog } from "@/components/hardware/hardware-model-dialog";
import { BrandDialog } from "@/components/catalog/brand-dialog";
import { MaterialDialog } from "@/components/catalog/material-dialog";
import { ProductDialog } from "@/components/catalog/product-dialog";
import { hardwareCategoryLabels } from "@/components/hardware/enum-labels";

/* ── Status badge styling ──────────────────────────────────────────── */
const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  validated: "default",
  submitted: "outline",
  draft: "secondary",
  deprecated: "destructive",
};

const materialClassVariants: Record<string, "default" | "secondary"> = {
  fff: "default",
  sla: "secondary",
};

export default function CatalogPage() {
  const router = useRouter();
  const [tab, setTab] = useState("brands");
  const [search, setSearch] = useState("");
  const [brands, setBrands] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [hardwareModelsData, setHardwareModelsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hardwareDialogOpen, setHardwareDialogOpen] = useState(false);
  const [editingHardware, setEditingHardware] = useState<any>(null);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const handleDeleteHardware = async (id: string) => {
    if (!confirm("Delete this hardware model?")) return;
    setDeleting(id);
    await removeHardwareModel(id);
    setDeleting(null);
    load();
  };

  const handleDeleteBrand = async (id: string) => {
    if (!confirm("Delete this brand?")) return;
    setDeleting(id);
    await removeBrand(id);
    setDeleting(null);
    load();
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    setDeleting(id);
    await removeMaterial(id);
    setDeleting(null);
    load();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    setDeleting(id);
    await removeProduct(id);
    setDeleting(null);
    load();
  };

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === "brands") {
      const r = await listBrands({ search: search || undefined });
      if (r.data) setBrands(r.data);
    } else if (tab === "materials") {
      const r = await listMaterials({ search: search || undefined });
      if (r.data) setMaterials(r.data);
    } else if (tab === "products") {
      const r = await listProducts({ search: search || undefined });
      if (r.data) setProducts(r.data);
    } else if (tab === "hardware") {
      const r = await listHardwareModels();
      if (r.data) setHardwareModelsData(r.data);
    }
    setLoading(false);
  }, [tab, search]);

  useEffect(() => {
    setPage(0);
    load();
  }, [load]);

  const rows = tab === "brands" ? brands : tab === "materials" ? materials : tab === "products" ? products : hardwareModelsData;
  const totalPages = Math.ceil(rows.length / pageSize);
  const pagedRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  const addLabels: Record<string, string> = { brands: "Brand", materials: "Material", products: "Product", hardware: "Model" };
  const addHandlers: Record<string, () => void> = {
    brands: () => { setEditingBrand(null); setBrandDialogOpen(true); },
    materials: () => { setEditingMaterial(null); setMaterialDialogOpen(true); },
    products: () => { setEditingProduct(null); setProductDialogOpen(true); },
    hardware: () => { setEditingHardware(null); setHardwareDialogOpen(true); },
  };

  const handleRowClick = (row: any) => {
    if (tab === "brands") router.push(`/catalog/brands/${row.id}`);
    else if (tab === "materials") router.push(`/catalog/materials/${row.id}`);
    else if (tab === "products") router.push(`/catalog/products/${row.id}`);
  };

  const getEditHandler = (row: any) => {
    if (tab === "brands") return () => { setEditingBrand(row); setBrandDialogOpen(true); };
    if (tab === "materials") return () => { setEditingMaterial(row); setMaterialDialogOpen(true); };
    if (tab === "products") return () => { setEditingProduct(row); setProductDialogOpen(true); };
    if (tab === "hardware") return () => { setEditingHardware(row); setHardwareDialogOpen(true); };
    return () => {};
  };

  const getDeleteHandler = (row: any) => {
    if (tab === "brands") return () => handleDeleteBrand(row.id);
    if (tab === "materials") return () => handleDeleteMaterial(row.id);
    if (tab === "products") return () => handleDeleteProduct(row.id);
    if (tab === "hardware") return () => handleDeleteHardware(row.id);
    return () => {};
  };

  return (
    <TooltipProvider>
      <div>
        <PageHeader
          title="Catalog"
          description="Browse the central product and hardware catalog."
        />

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setSearch(""); setPage(0); }}>
          <div className="flex items-center justify-between border-b border-border mb-3">
            <TabsList variant="line">
              <TabsTrigger value="brands">Brands</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="hardware">Hardware</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 pb-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
                <Input
                  placeholder={`Search ${tab}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 pl-8 rounded-full bg-muted/50 border-transparent focus-visible:border-ring"
                />
              </div>
              <Button onClick={addHandlers[tab]} className="bg-[#00D2FF] text-[#001F28] hover:bg-[#00D2FF]/90">
                <Plus className="size-4 mr-1" />
                Add {addLabels[tab]}
              </Button>
            </div>
          </div>

          {/* Data table for all tabs */}
          {loading ? (
            <div className="bg-card rounded-xl shadow-sm p-2">
              <div className="flex flex-col gap-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-card rounded-xl shadow-sm text-center py-10">
              <p className="text-base font-semibold font-display">No results found</p>
              <p className="text-sm text-muted-foreground mt-0.5">Try adjusting your search query.</p>
            </div>
          ) : (
            <>
              <div className="bg-card rounded-xl shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* Dynamic headers per tab */}
                      {tab === "brands" && (
                        <>
                          <TableHead className="w-14" />
                          <TableHead>Brand Name</TableHead>
                          <TableHead>Slug</TableHead>
                          <TableHead>Website</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20" />
                        </>
                      )}
                      {tab === "materials" && (
                        <>
                          <TableHead>Name</TableHead>
                          <TableHead>Abbrev.</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Density</TableHead>
                          <TableHead className="w-20" />
                        </>
                      )}
                      {tab === "products" && (
                        <>
                          <TableHead className="w-12" />
                          <TableHead>Name</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead>Diameter</TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20" />
                        </>
                      )}
                      {tab === "hardware" && (
                        <>
                          <TableHead className="w-14" />
                          <TableHead>Category</TableHead>
                          <TableHead>Manufacturer</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Specs</TableHead>
                          <TableHead>Connectivity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20" />
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row: any) => (
                      <TableRow
                        key={row.id}
                        className={tab !== "hardware" ? "cursor-pointer" : ""}
                        onClick={() => tab !== "hardware" && handleRowClick(row)}
                      >
                        {/* Brands */}
                        {tab === "brands" && (
                          <>
                            <TableCell>
                              <Avatar className="size-8 rounded-lg">
                                {row.logoUrl && <AvatarImage src={row.logoUrl} />}
                                <AvatarFallback className="rounded-lg text-xs">
                                  {row.name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell className="font-semibold">{row.name}</TableCell>
                            <TableCell><span className="font-mono text-xs text-muted-foreground">{row.slug}</span></TableCell>
                            <TableCell>
                              {row.website ? (
                                <span className="text-sm text-[#00677F] hover:underline">
                                  {row.website.replace(/^https?:\/\//, "")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">\u2014</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariants[row.validationStatus] ?? "secondary"}>
                                {row.validationStatus}
                              </Badge>
                            </TableCell>
                          </>
                        )}

                        {/* Materials */}
                        {tab === "materials" && (
                          <>
                            <TableCell className="font-semibold">{row.name}</TableCell>
                            <TableCell>{row.abbreviation ?? "\u2014"}</TableCell>
                            <TableCell>{row.category ?? "\u2014"}</TableCell>
                            <TableCell>
                              {row.materialClass ? (
                                <Badge variant={materialClassVariants[row.materialClass] ?? "secondary"}>
                                  {row.materialClass.toUpperCase()}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/50">\u2014</span>
                              )}
                            </TableCell>
                            <TableCell>{row.density != null ? `${row.density} g/cm\u00B3` : "\u2014"}</TableCell>
                          </>
                        )}

                        {/* Products */}
                        {tab === "products" && (
                          <>
                            <TableCell>
                              <div
                                className="w-6 h-6 rounded-full border border-border shadow-inner"
                                style={{ backgroundColor: row.colorHex || "#ccc" }}
                              />
                            </TableCell>
                            <TableCell className="font-semibold">{row.name}</TableCell>
                            <TableCell>{row.colorName ?? "\u2014"}</TableCell>
                            <TableCell>{row.diameter != null ? `${row.diameter}mm` : "\u2014"}</TableCell>
                            <TableCell>{row.netWeightG != null ? `${row.netWeightG}g` : "\u2014"}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariants[row.validationStatus] ?? "secondary"}>
                                {row.validationStatus}
                              </Badge>
                            </TableCell>
                          </>
                        )}

                        {/* Hardware */}
                        {tab === "hardware" && (
                          <>
                            <TableCell>
                              <Avatar className="size-8 rounded-lg">
                                {row.imageUrl && <AvatarImage src={row.imageUrl} />}
                                <AvatarFallback className="rounded-lg text-xs">
                                  {row.model?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {hardwareCategoryLabels[row.category] ?? row.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{row.manufacturer}</TableCell>
                            <TableCell>{row.model}</TableCell>
                            <TableCell>
                              {(() => {
                                if (row.category === "label_printer") {
                                  const parts = [];
                                  if (row.printDpi) parts.push(`${row.printDpi} DPI`);
                                  if (row.printWidthMm) parts.push(`${row.printWidthMm}mm`);
                                  return parts.join(" \u00B7 ") || "\u2014";
                                }
                                if (row.buildVolumeX && row.buildVolumeY && row.buildVolumeZ) {
                                  return `${row.buildVolumeX}\u00D7${row.buildVolumeY}\u00D7${row.buildVolumeZ} mm`;
                                }
                                return "\u2014";
                              })()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 items-center">
                                {row.hasUsb && <Usb className="size-4 text-muted-foreground" />}
                                {row.hasBle && <Bluetooth className="size-4 text-blue-500" />}
                                {row.hasWifi && <Wifi className="size-4 text-green-500" />}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariants[row.validationStatus] ?? "secondary"}>
                                {row.validationStatus}
                              </Badge>
                            </TableCell>
                          </>
                        )}

                        {/* Action buttons */}
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={(e) => { e.stopPropagation(); getEditHandler(row)(); }}
                                  />
                                }
                              >
                                <Pencil className="size-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    disabled={deleting === row.id}
                                    onClick={(e) => { e.stopPropagation(); getDeleteHandler(row)(); }}
                                    className="hover:text-destructive"
                                  />
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages} ({rows.length} total)
                  </p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      Previous
                    </Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Tabs>

        {/* Dialogs */}
        <BrandDialog
          open={brandDialogOpen}
          onClose={() => { setBrandDialogOpen(false); setEditingBrand(null); }}
          onSaved={load}
          existing={editingBrand}
        />
        <MaterialDialog
          open={materialDialogOpen}
          onClose={() => { setMaterialDialogOpen(false); setEditingMaterial(null); }}
          onSaved={load}
          existing={editingMaterial}
        />
        <ProductDialog
          open={productDialogOpen}
          onClose={() => { setProductDialogOpen(false); setEditingProduct(null); }}
          onSaved={load}
          existing={editingProduct}
        />
        <HardwareModelDialog
          open={hardwareDialogOpen}
          onClose={() => { setHardwareDialogOpen(false); setEditingHardware(null); }}
          onSaved={load}
          existing={editingHardware}
        />
      </div>
    </TooltipProvider>
  );
}
