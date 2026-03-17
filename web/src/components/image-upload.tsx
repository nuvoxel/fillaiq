"use client";

import { useRef, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";

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
    <Box>
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
        <Box sx={{ position: "relative", display: "inline-block" }}>
          <Box
            component="img"
            src={value}
            alt=""
            sx={{
              width,
              height,
              objectFit: "contain",
              borderRadius: circular ? "50%" : 2,
              border: 1,
              borderColor: "divider",
              bgcolor: "grey.50",
              cursor: "pointer",
            }}
            onClick={() => inputRef.current?.click()}
          />
          <IconButton
            size="small"
            sx={{
              position: "absolute",
              top: -8,
              right: -8,
              bgcolor: "background.paper",
              boxShadow: 1,
              "&:hover": { bgcolor: "error.light", color: "white" },
            }}
            onClick={() => onChange(null)}
          >
            <DeleteIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      ) : (
        <Box
          onClick={() => !uploading && inputRef.current?.click()}
          sx={{
            width,
            height,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            borderRadius: circular ? "50%" : 2,
            border: "2px dashed",
            borderColor: error ? "error.main" : "divider",
            bgcolor: "grey.50",
            cursor: uploading ? "default" : "pointer",
            "&:hover": uploading ? {} : { borderColor: "primary.main", bgcolor: "action.hover" },
            transition: "all 0.2s",
          }}
        >
          {uploading ? (
            <CircularProgress size={24} />
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 24, color: "text.disabled" }} />
              <Typography variant="caption" color="text.disabled" textAlign="center" px={1}>
                {label}
              </Typography>
            </>
          )}
        </Box>
      )}
      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
