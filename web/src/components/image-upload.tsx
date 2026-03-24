"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  category?: string;
  label?: string;
  width?: number;
  height?: number;
  circular?: boolean;
};

export function ImageUpload({
  value,
  onChange,
  category = "general",
  label = "Upload Image",
  width = 120,
  height = 120,
  circular = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/v1/upload?category=${category}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      onChange(data.url);
    } catch (e) {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="cursor-pointer border border-border bg-muted/30 object-contain"
            style={{
              width,
              height,
              borderRadius: circular ? "50%" : 8,
            }}
            onClick={() => inputRef.current?.click()}
          />
          <button
            className="absolute -top-2 -right-2 flex items-center justify-center rounded-full border bg-background shadow-sm hover:bg-destructive hover:text-white transition-colors"
            style={{ width: 22, height: 22 }}
            onClick={() => onChange(null)}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed transition-all ${
            error ? "border-destructive" : "border-border hover:border-primary hover:bg-muted/50"
          } ${uploading ? "cursor-default" : "cursor-pointer"}`}
          style={{
            width,
            height,
            borderRadius: circular ? "50%" : 8,
            backgroundColor: "var(--color-muted)",
          }}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="size-6 text-muted-foreground/50" />
              <span className="text-[0.65rem] text-muted-foreground/50 text-center px-1">
                {label}
              </span>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
