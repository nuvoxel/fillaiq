"use client";

import { useState, useRef } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { updateBrand } from "@/lib/actions/central-catalog";

type Props = {
  brandId: string;
  brandName: string;
  logoUrl: string | null;
  logoBwUrl: string | null;
};

export function BrandLogoUpload({ brandId, brandName, logoUrl: initialLogoUrl, logoBwUrl: initialLogoBwUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoBwUrl, setLogoBwUrl] = useState(initialLogoBwUrl);
  const [uploadingColor, setUploadingColor] = useState(false);
  const [uploadingBw, setUploadingBw] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const bwInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: "color" | "bw") => {
    const setUploading = type === "color" ? setUploadingColor : setUploadingBw;
    const setUrl = type === "color" ? setLogoUrl : setLogoBwUrl;
    const field = type === "color" ? "logoUrl" : "logoBwUrl";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/upload?category=brands", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) { console.error(result.error); return; }

      setUrl(result.url);
      await updateBrand(brandId, { [field]: result.url });
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (type: "color" | "bw") => {
    const setUrl = type === "color" ? setLogoUrl : setLogoBwUrl;
    const field = type === "color" ? "logoUrl" : "logoBwUrl";
    setUrl(null);
    await updateBrand(brandId, { [field]: null });
  };

  return (
    <TooltipProvider>
      <div className="flex gap-3 flex-wrap">
        {/* Color Logo */}
        <div>
          <p className="text-xs text-muted-foreground block mb-1.5">Color Logo</p>
          <div className="flex items-center gap-1.5">
            {logoUrl ? (
              <div className="relative">
                <img
                  src={logoUrl}
                  alt={`${brandName} logo`}
                  className="h-12 max-w-40 object-contain rounded border border-border p-0.5"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        onClick={() => handleRemove("color")}
                        className="absolute -top-2 -right-2 bg-background shadow-sm rounded-full p-0.5 hover:bg-destructive hover:text-white transition-colors"
                      />
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <Avatar className="size-12">
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {brandName[0]}
                </AvatarFallback>
              </Avatar>
            )}
            <input ref={colorInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "color"); e.target.value = ""; }} />
            <Button size="sm" variant="outline" disabled={uploadingColor} onClick={() => colorInputRef.current?.click()}>
              {uploadingColor ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
              {uploadingColor ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>

        {/* B&W Logo */}
        <div>
          <p className="text-xs text-muted-foreground block mb-1.5">B&W Logo (for labels)</p>
          <div className="flex items-center gap-1.5">
            {logoBwUrl ? (
              <div className="relative">
                <img
                  src={logoBwUrl}
                  alt={`${brandName} B&W logo`}
                  className="h-12 max-w-40 object-contain rounded border border-border p-0.5 bg-white"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        onClick={() => handleRemove("bw")}
                        className="absolute -top-2 -right-2 bg-background shadow-sm rounded-full p-0.5 hover:bg-destructive hover:text-white transition-colors"
                      />
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="w-12 h-12 rounded border border-dashed border-border flex items-center justify-center">
                <span className="text-xs text-muted-foreground/50">B&W</span>
              </div>
            )}
            <input ref={bwInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "bw"); e.target.value = ""; }} />
            <Button size="sm" variant="outline" disabled={uploadingBw} onClick={() => bwInputRef.current?.click()}>
              {uploadingBw ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
              {uploadingBw ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
