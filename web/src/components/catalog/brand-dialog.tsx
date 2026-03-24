"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createBrand, updateBrand } from "@/lib/actions/central-catalog";
import { ImageUpload } from "@/components/image-upload";

const validationStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "validated", label: "Validated" },
  { value: "deprecated", label: "Deprecated" },
];

type Brand = {
  id: string;
  name: string;
  slug: string;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Brand | null;
};

export function BrandDialog({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [validationStatus, setValidationStatus] = useState("draft");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-generate slug from name
  useEffect(() => {
    if (!existing) {
      const s = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+$/, "")
        .replace(/^-+/, "");
      setSlug(s);
    }
  }, [name, existing]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      const e = existing as Record<string, any>;
      setName(e.name ?? "");
      setSlug(e.slug ?? "");
      setWebsite(e.website ?? "");
      setLogoUrl(e.logoUrl ?? null);
      setCountryOfOrigin(e.countryOfOrigin ?? "");
      setValidationStatus(e.validationStatus ?? "draft");
    } else {
      setName("");
      setSlug("");
      setWebsite("");
      setLogoUrl(null);
      setCountryOfOrigin("");
      setValidationStatus("draft");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      slug,
      website: website || null,
      logoUrl: logoUrl || null,
      countryOfOrigin: countryOfOrigin || null,
      validationStatus,
    };

    const result = existing
      ? await updateBrand(existing.id, payload)
      : await createBrand(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Brand" : "Add Brand"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <ImageUpload
              value={logoUrl}
              onChange={setLogoUrl}
              category="brands"
              label="Logo"
              width={80}
              height={80}
              circular
            />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium block mb-1">Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Slug *</label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <p className="text-[0.625rem] text-muted-foreground mt-0.5">Auto-generated URL identifier</p>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium block mb-1">Website</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Country of Origin</label>
                <Input
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  maxLength={2}
                />
                <p className="text-[0.625rem] text-muted-foreground mt-0.5">2-letter country code (e.g. US, CN)</p>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Validation Status</label>
                <Select value={validationStatus} onValueChange={(v) => v && setValidationStatus(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {validationStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            onClick={handleSave}
            disabled={!name || !slug || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
