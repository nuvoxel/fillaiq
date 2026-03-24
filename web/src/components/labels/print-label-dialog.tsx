"use client";

import { useState, useEffect, useMemo } from "react";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  LabelPreview,
  type LabelPreviewData,
  type LabelPreviewSettings,
} from "./label-preview";
import {
  listLabelTemplates,
  listMyStations,
  createPrintJob,
  createBatchPrintJobs,
} from "@/lib/actions/user-library";

type TemplateRow = {
  id: string;
  name: string;
  widthMm: number | null;
  heightMm: number | null;
  showBrand: boolean | null;
  showMaterial: boolean | null;
  showColor: boolean | null;
  showColorSwatch: boolean | null;
  showTemps: boolean | null;
  showQrCode: boolean | null;
  showWeight: boolean | null;
  showLocation: boolean | null;
  showPrice: boolean | null;
  showPurchaseDate: boolean | null;
  showLotNumber: boolean | null;
  isDefault: boolean | null;
  [key: string]: unknown;
};

type StationRow = {
  id: string;
  name: string;
  isOnline: boolean | null;
  [key: string]: unknown;
};

export type PrintLabelItem = {
  brand?: string;
  brandLogoUrl?: string;
  material?: string;
  color?: string;
  colorName?: string;
  nozzleTemp?: string;
  bedTemp?: string;
  dryingInfo?: string;
  flowRatio?: string;
  td?: string;
  weight?: string;
  location?: string;
  price?: string;
  purchaseDate?: string;
  lotNumber?: string;
  filamentId?: string;
  /** For unique identification in batch mode */
  label?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Single item or batch of items to print labels for */
  items: PrintLabelItem[];
  /** Dialog title override */
  title?: string;
};

function templateToSettings(t: TemplateRow): LabelPreviewSettings {
  return {
    widthMm: t.widthMm ?? 40,
    heightMm: t.heightMm ?? 30,
    showBrand: t.showBrand ?? true,
    showMaterial: t.showMaterial ?? true,
    showColor: t.showColor ?? true,
    showColorSwatch: t.showColorSwatch ?? true,
    showTemps: t.showTemps ?? true,
    showQrCode: t.showQrCode ?? true,
    showWeight: t.showWeight ?? true,
    showLocation: t.showLocation ?? false,
    showPrice: t.showPrice ?? false,
    showPurchaseDate: t.showPurchaseDate ?? false,
    showLotNumber: t.showLotNumber ?? false,
    showDryingInfo: (t as any).showDryingInfo ?? true,
    showFilamentId: (t as any).showFilamentId ?? true,
  };
}

export function PrintLabelDialog({ open, onClose, items, title }: Props) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedStation, setSelectedStation] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const isBatch = items.length > 1;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(false);
    setSending(false);
    setPreviewError(false);
    setPreviewLoading(true);

    (async () => {
      setLoading(true);
      const [tRes, sRes] = await Promise.all([
        listLabelTemplates(),
        listMyStations(),
      ]);
      if (tRes.data) {
        setTemplates(tRes.data as TemplateRow[]);
        const def = (tRes.data as TemplateRow[]).find((t) => t.isDefault);
        if (def) setSelectedTemplate(def.id);
        else if (tRes.data.length > 0)
          setSelectedTemplate((tRes.data as TemplateRow[])[0].id);
      }
      if (sRes.data) {
        setStations(sRes.data as StationRow[]);
        const online = (sRes.data as StationRow[]).find((s) => s.isOnline);
        if (online) setSelectedStation(online.id);
        else if (sRes.data.length > 0)
          setSelectedStation((sRes.data as StationRow[])[0].id);
      }
      setLoading(false);
    })();
  }, [open]);

  const template = templates.find((t) => t.id === selectedTemplate);
  const settings = template ? templateToSettings(template) : null;
  const previewItem = items[0] ?? {};

  // Build a server-rendered PNG preview URL from the first item's data
  const previewUrl = useMemo(() => {
    if (!selectedTemplate || !previewItem) return null;
    const params = new URLSearchParams();
    params.set("format", "png");
    params.set("width", "384");
    params.set("dpi", "203");
    params.set("templateId", selectedTemplate);
    if (previewItem.brand) params.set("brand", previewItem.brand);
    if (previewItem.material) params.set("material", previewItem.material);
    if (previewItem.color) params.set("colorHex", previewItem.color);
    if (previewItem.nozzleTemp) {
      const tempMatch = previewItem.nozzleTemp.match(/(\d+)\s*[-\u2013]\s*(\d+)/);
      if (tempMatch) {
        params.set("nozzleTempMin", tempMatch[1]);
        params.set("nozzleTempMax", tempMatch[2]);
      } else {
        const single = previewItem.nozzleTemp.match(/(\d+)/);
        if (single) params.set("nozzleTempMin", single[1]);
      }
    }
    if (previewItem.bedTemp) {
      const bedMatch = previewItem.bedTemp.match(/(\d+)/);
      if (bedMatch) params.set("bedTemp", bedMatch[1]);
    }
    if (previewItem.weight) params.set("weight", previewItem.weight);
    if (previewItem.location) params.set("location", previewItem.location);
    return `/api/v1/label/render?${params.toString()}`;
  }, [selectedTemplate, previewItem]);

  const handlePrint = async () => {
    setError(null);
    setSending(true);

    try {
      if (items.length === 1) {
        const result = await createPrintJob({
          templateId: selectedTemplate || undefined,
          stationId: selectedStation || undefined,
          labelData: items[0],
        });
        if (result.error) {
          setError(result.error);
          setSending(false);
          return;
        }
      } else {
        const result = await createBatchPrintJobs(
          items.map((item) => ({
            templateId: selectedTemplate || undefined,
            stationId: selectedStation || undefined,
            labelData: item,
          }))
        );
        if (result.error) {
          setError(result.error);
          setSending(false);
          return;
        }
      }

      setSuccess(true);
      setSending(false);
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  };

  const dialogTitle =
    title ??
    (isBatch ? `Print ${items.length} Labels` : "Print Label");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>
                {isBatch
                  ? `${items.length} print jobs queued!`
                  : "Print job queued!"}
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              {/* Template picker */}
              {templates.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No label templates configured. Create one in Settings &gt;
                    Labels first.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Label Template</label>
                  <Select value={selectedTemplate} onValueChange={(v) => v && setSelectedTemplate(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          {t.widthMm && t.heightMm
                            ? ` (${t.widthMm}\u00d7${t.heightMm}mm)`
                            : ""}
                          {t.isDefault ? " \u2605" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Station picker */}
              {stations.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No scan stations found. Pair a FillaScan device first.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Print Station</label>
                  <Select value={selectedStation} onValueChange={(v) => v && setSelectedStation(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.isOnline ? " (online)" : " (offline)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Preview */}
              {settings && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Preview
                  </p>
                  {previewUrl && !previewError ? (
                    <div className="relative text-center">
                      {previewLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                          <Loader2 className="size-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Label preview"
                        onLoad={() => setPreviewLoading(false)}
                        onError={() => {
                          setPreviewLoading(false);
                          setPreviewError(true);
                        }}
                        style={{
                          maxWidth: "100%",
                          imageRendering: "pixelated",
                          opacity: previewLoading ? 0.3 : 1,
                          transition: "opacity 0.2s",
                        }}
                        className="rounded border border-border"
                      />
                    </div>
                  ) : (
                    <LabelPreview
                      settings={settings}
                      data={previewItem as LabelPreviewData}
                      maxWidth={350}
                    />
                  )}
                </div>
              )}

              {/* Batch info */}
              {isBatch && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {items.length} labels:
                  </span>
                  {items.slice(0, 10).map((item, i) => (
                    <Badge key={i} variant="outline">
                      {item.label ??
                        item.material ??
                        item.brand ??
                        `Label ${i + 1}`}
                    </Badge>
                  ))}
                  {items.length > 10 && (
                    <Badge variant="outline">
                      +{items.length - 10} more
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={sending}>
            Cancel
          </DialogClose>
          <Button
            onClick={handlePrint}
            disabled={
              sending ||
              success ||
              loading ||
              templates.length === 0 ||
              stations.length === 0 ||
              !selectedTemplate
            }
          >
            <Printer className="size-4 mr-1.5" />
            {sending
              ? "Sending..."
              : success
              ? "Sent!"
              : isBatch
              ? `Print ${items.length} Labels`
              : "Print"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
