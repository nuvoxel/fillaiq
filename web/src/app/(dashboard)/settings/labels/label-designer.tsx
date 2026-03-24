"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Save, Star, StarOff, Tag, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  listLabelTemplates,
  createLabelTemplate,
  updateLabelTemplate,
  removeLabelTemplate,
} from "@/lib/actions/user-library";
import {
  LabelPreview,
  type LabelPreviewSettings,
} from "@/components/labels/label-preview";

// -- Types --

type LabelFormat = "labelife_image" | "labelife_native" | "png" | "pdf";

type TemplateRow = {
  id: string;
  name: string;
  labelFormat: LabelFormat;
  widthMm: number | null;
  heightMm: number | null;
  isDefault: boolean | null;
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
  qrCodeBaseUrl: string | null;
  customCss: string | null;
};

type EditorState = {
  name: string;
  labelFormat: LabelFormat;
  widthMm: number;
  heightMm: number;
  isDefault: boolean;
  showBrand: boolean;
  showMaterial: boolean;
  showColor: boolean;
  showColorSwatch: boolean;
  showTemps: boolean;
  showQrCode: boolean;
  showWeight: boolean;
  showLocation: boolean;
  showPrice: boolean;
  showPurchaseDate: boolean;
  showLotNumber: boolean;
  showDryingInfo: boolean;
  showFilamentId: boolean;
  qrCodeBaseUrl: string;
};

const DEFAULT_STATE: EditorState = {
  name: "Untitled Template",
  labelFormat: "png",
  widthMm: 50,
  heightMm: 30,
  isDefault: false,
  showBrand: true,
  showMaterial: true,
  showColor: true,
  showColorSwatch: true,
  showTemps: true,
  showQrCode: true,
  showWeight: true,
  showLocation: false,
  showPrice: false,
  showPurchaseDate: false,
  showLotNumber: false,
  showDryingInfo: true,
  showFilamentId: true,
  qrCodeBaseUrl: "app.fillaiq.com/item/",
};

const SIZE_PRESETS = [
  { label: "40 x 30 mm (Classic)", w: 40, h: 30 },
  { label: "50 x 30 mm (Expanded)", w: 50, h: 30 },
  { label: "40 x 25 mm (Compact)", w: 40, h: 25 },
  { label: "40 x 12 mm (Slim)", w: 40, h: 12 },
  { label: "30 x 40 mm (Vertical)", w: 30, h: 40 },
  { label: "25 x 40 mm (Vert. Compact)", w: 25, h: 40 },
];

const FORMAT_OPTIONS: { value: LabelFormat; label: string }[] = [
  { value: "labelife_image", label: "Labelife Image" },
  { value: "labelife_native", label: "Labelife Native" },
  { value: "png", label: "PNG" },
  { value: "pdf", label: "PDF" },
];

const CONTENT_TOGGLES: { key: keyof EditorState; label: string }[] = [
  { key: "showBrand", label: "Brand" },
  { key: "showMaterial", label: "Material" },
  { key: "showColor", label: "Color name" },
  { key: "showColorSwatch", label: "Color swatch" },
  { key: "showTemps", label: "Temperatures" },
  { key: "showWeight", label: "Weight" },
  { key: "showQrCode", label: "QR code" },
  { key: "showLocation", label: "Location" },
  { key: "showPrice", label: "Price" },
  { key: "showPurchaseDate", label: "Purchase date" },
  { key: "showLotNumber", label: "Lot number" },
  { key: "showDryingInfo", label: "Drying info" },
  { key: "showFilamentId", label: "Filament ID" },
];

function rowToEditor(row: TemplateRow): EditorState {
  return {
    name: row.name,
    labelFormat: row.labelFormat,
    widthMm: row.widthMm ?? 50,
    heightMm: row.heightMm ?? 30,
    isDefault: row.isDefault ?? false,
    showBrand: row.showBrand ?? true,
    showMaterial: row.showMaterial ?? true,
    showColor: row.showColor ?? true,
    showColorSwatch: row.showColorSwatch ?? true,
    showTemps: row.showTemps ?? true,
    showQrCode: row.showQrCode ?? true,
    showWeight: row.showWeight ?? true,
    showLocation: row.showLocation ?? false,
    showPrice: row.showPrice ?? false,
    showPurchaseDate: row.showPurchaseDate ?? false,
    showLotNumber: row.showLotNumber ?? false,
    showDryingInfo: (row as any).showDryingInfo ?? true,
    showFilamentId: (row as any).showFilamentId ?? true,
    qrCodeBaseUrl: row.qrCodeBaseUrl ?? "app.fillaiq.com/item/",
  };
}

function editorToPreview(state: EditorState): LabelPreviewSettings {
  return {
    widthMm: state.widthMm,
    heightMm: state.heightMm,
    showBrand: state.showBrand,
    showMaterial: state.showMaterial,
    showColor: state.showColor,
    showColorSwatch: state.showColorSwatch,
    showTemps: state.showTemps,
    showQrCode: state.showQrCode,
    showWeight: state.showWeight,
    showLocation: state.showLocation,
    showPrice: state.showPrice,
    showPurchaseDate: state.showPurchaseDate,
    showLotNumber: state.showLotNumber,
    showDryingInfo: state.showDryingInfo,
    showFilamentId: state.showFilamentId,
  };
}

// -- Component --

export function LabelDesigner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadTemplates = useCallback(async () => {
    const result = await listLabelTemplates();
    if (result.data) {
      setTemplates(result.data as TemplateRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && templates.length > 0) {
      const found = templates.find((t) => t.id === idParam);
      if (found) {
        setSelectedId(found.id);
        setEditor(rowToEditor(found));
      }
    }
  }, [searchParams, templates]);

  const selectTemplate = (tmpl: TemplateRow) => {
    setSelectedId(tmpl.id);
    setEditor(rowToEditor(tmpl));
    setFeedback(null);
    router.replace(`/settings/labels?id=${tmpl.id}`, { scroll: false });
  };

  const startNew = () => {
    setSelectedId(null);
    setEditor({ ...DEFAULT_STATE });
    setFeedback(null);
    router.replace("/settings/labels", { scroll: false });
  };

  const updateField = <K extends keyof EditorState>(
    key: K,
    value: EditorState[K]
  ) => {
    setEditor((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: editor.name,
        labelFormat: editor.labelFormat,
        widthMm: editor.widthMm,
        heightMm: editor.heightMm,
        isDefault: editor.isDefault,
        showBrand: editor.showBrand,
        showMaterial: editor.showMaterial,
        showColor: editor.showColor,
        showColorSwatch: editor.showColorSwatch,
        showTemps: editor.showTemps,
        showQrCode: editor.showQrCode,
        showWeight: editor.showWeight,
        showLocation: editor.showLocation,
        showPrice: editor.showPrice,
        showPurchaseDate: editor.showPurchaseDate,
        showLotNumber: editor.showLotNumber,
        qrCodeBaseUrl: editor.qrCodeBaseUrl,
      };

      if (selectedId) {
        const result = await updateLabelTemplate(selectedId, payload);
        if (result.error) {
          setFeedback({ type: "error", message: result.error });
        } else {
          setFeedback({ type: "success", message: "Template saved." });
          await loadTemplates();
        }
      } else {
        const result = await createLabelTemplate(payload);
        if (result.error) {
          setFeedback({ type: "error", message: result.error });
        } else if (result.data) {
          setFeedback({ type: "success", message: "Template created." });
          await loadTemplates();
          const created = result.data as TemplateRow;
          setSelectedId(created.id);
          router.replace(`/settings/labels?id=${created.id}`, { scroll: false });
        }
      }
    } catch {
      setFeedback({ type: "error", message: "An unexpected error occurred." });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    const result = await removeLabelTemplate(selectedId);
    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    } else {
      setFeedback({ type: "success", message: "Template deleted." });
      setSelectedId(null);
      setEditor({ ...DEFAULT_STATE });
      router.replace("/settings/labels", { scroll: false });
      await loadTemplates();
    }
    setSaving(false);
  };

  const matchingPreset = SIZE_PRESETS.find(
    (p) => p.w === editor.widthMm && p.h === editor.heightMm
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
      {/* Template List (left sidebar) */}
      <div className="md:col-span-3">
        <Card className="sticky top-4">
          <div className="flex items-center justify-between p-3 pb-0">
            <h3 className="text-base font-semibold">Templates</h3>
            <Button variant="ghost" size="icon-sm" onClick={startNew} title="New template">
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="border-t border-border mt-2" />
          <div>
            {loading ? (
              <div className="p-2">
                <Skeleton className="h-20 rounded-lg" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-3">
                <Tag className="size-8 text-muted-foreground/40 mx-auto mb-0.5" />
                <p className="text-sm text-muted-foreground">No templates yet</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => selectTemplate(tmpl)}
                    className={`flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                      tmpl.id === selectedId ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    {tmpl.isDefault ? (
                      <Star className="size-4 text-amber-500 fill-amber-500 shrink-0" />
                    ) : (
                      <Tag className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{tmpl.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {tmpl.widthMm && tmpl.heightMm
                          ? `${tmpl.widthMm}\u00D7${tmpl.heightMm}mm`
                          : "No size set"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-border" />
            <div className="p-1">
              <Button variant="ghost" className="w-full" size="sm" onClick={startNew}>
                <Plus className="size-4 mr-1" />
                New Template
              </Button>
            </div>
          </div>
        </Card>

        <Button variant="ghost" size="sm" render={<Link href="/settings" />} className="mt-1">
          <ArrowLeft className="size-4 mr-1" />
          Back to Settings
        </Button>
      </div>

      {/* Label Preview (center) */}
      <div className="md:col-span-5">
        <Card>
          <div className="p-3 pb-0">
            <h3 className="text-base font-semibold">Preview</h3>
            <p className="text-xs text-muted-foreground">{editor.widthMm} \u00D7 {editor.heightMm} mm</p>
          </div>
          <div className="border-t border-border mt-2" />
          <CardContent className="p-3">
            <div className="flex items-center justify-center min-h-[200px] p-2 bg-muted/50 rounded-lg border border-border">
              <LabelPreview
                settings={editorToPreview(editor)}
                maxWidth={360}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Preview rendered at 4px/mm. Actual print may vary.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Template Settings (right sidebar) */}
      <div className="md:col-span-4">
        <Card>
          <div className="p-3 pb-0">
            <h3 className="text-base font-semibold">
              {selectedId ? "Edit Template" : "New Template"}
            </h3>
          </div>
          <div className="border-t border-border mt-2" />
          <CardContent className="p-3">
            <div className="flex flex-col gap-2.5">
              {/* Feedback */}
              {feedback && (
                <Alert variant={feedback.type === "error" ? "destructive" : "default"}>
                  <AlertDescription>{feedback.message}</AlertDescription>
                </Alert>
              )}

              {/* Name */}
              <div>
                <label className="text-xs font-medium block mb-1">Template Name</label>
                <Input
                  value={editor.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>

              {/* Size presets */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Label Size</p>
                <div className="flex flex-wrap gap-1 mb-1">
                  {SIZE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        updateField("widthMm", p.w);
                        updateField("heightMm", p.h);
                      }}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                        matchingPreset === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <div className="flex-1">
                    <label className="text-xs font-medium block mb-1">Width (mm)</label>
                    <Input
                      type="number"
                      value={editor.widthMm}
                      onChange={(e) =>
                        updateField("widthMm", Math.max(10, parseInt(e.target.value) || 10))
                      }
                      min={10}
                      max={200}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium block mb-1">Height (mm)</label>
                    <Input
                      type="number"
                      value={editor.heightMm}
                      onChange={(e) =>
                        updateField("heightMm", Math.max(10, parseInt(e.target.value) || 10))
                      }
                      min={10}
                      max={200}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Content toggles */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Content Fields</p>
                <div className="grid grid-cols-2 gap-y-1">
                  {CONTENT_TOGGLES.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <Switch
                        size="sm"
                        checked={editor[key] as boolean}
                        onCheckedChange={(checked) => updateField(key, checked as never)}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-border" />

              {/* QR code URL */}
              <div>
                <label className="text-xs font-medium block mb-1">QR Code Base URL</label>
                <Input
                  value={editor.qrCodeBaseUrl}
                  onChange={(e) => updateField("qrCodeBaseUrl", e.target.value)}
                />
                <p className="text-[0.625rem] text-muted-foreground mt-0.5">Item ID will be appended to this URL</p>
              </div>

              {/* Default toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={editor.isDefault}
                  onCheckedChange={(checked) => updateField("isDefault", checked)}
                />
                <span className="flex items-center gap-1 text-sm">
                  {editor.isDefault ? (
                    <Star className="size-4 text-amber-500 fill-amber-500" />
                  ) : (
                    <StarOff className="size-4" />
                  )}
                  Set as default template
                </span>
              </label>

              <div className="border-t border-border" />

              {/* Action buttons */}
              <div className="flex gap-1 justify-end">
                {selectedId && (
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    <Trash2 className="size-4 mr-1" />
                    Delete
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving || !editor.name.trim()}
                >
                  <Save className="size-4 mr-1" />
                  {saving
                    ? "Saving..."
                    : selectedId
                      ? "Save Changes"
                      : "Create Template"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
