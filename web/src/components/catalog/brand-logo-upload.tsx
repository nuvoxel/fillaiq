"use client";

import { useState, useRef } from "react";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
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
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {/* Color Logo */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
          Color Logo
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {logoUrl ? (
            <Box sx={{ position: "relative" }}>
              <Box
                component="img"
                src={logoUrl}
                alt={`${brandName} logo`}
                sx={{ height: 48, maxWidth: 160, objectFit: "contain", borderRadius: 1, border: 1, borderColor: "divider", p: 0.5 }}
              />
              <Tooltip title="Remove">
                <IconButton size="small" onClick={() => handleRemove("color")}
                  sx={{ position: "absolute", top: -8, right: -8, bgcolor: "background.paper", boxShadow: 1, p: 0.25, "&:hover": { bgcolor: "error.light", color: "white" } }}>
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.light", color: "primary.main", fontSize: 20 }}>
              {brandName[0]}
            </Avatar>
          )}
          <input ref={colorInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "color"); e.target.value = ""; }} />
          <Button size="small" variant="outlined" startIcon={uploadingColor ? <CircularProgress size={14} /> : <CloudUploadIcon />}
            disabled={uploadingColor} onClick={() => colorInputRef.current?.click()} sx={{ textTransform: "none" }}>
            {uploadingColor ? "Uploading..." : "Upload"}
          </Button>
        </Box>
      </Box>

      {/* B&W Logo (for label printing) */}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
          B&W Logo (for labels)
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {logoBwUrl ? (
            <Box sx={{ position: "relative" }}>
              <Box
                component="img"
                src={logoBwUrl}
                alt={`${brandName} B&W logo`}
                sx={{ height: 48, maxWidth: 160, objectFit: "contain", borderRadius: 1, border: 1, borderColor: "divider", p: 0.5, bgcolor: "white" }}
              />
              <Tooltip title="Remove">
                <IconButton size="small" onClick={() => handleRemove("bw")}
                  sx={{ position: "absolute", top: -8, right: -8, bgcolor: "background.paper", boxShadow: 1, p: 0.25, "&:hover": { bgcolor: "error.light", color: "white" } }}>
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Box sx={{ width: 48, height: 48, borderRadius: 1, border: "1px dashed", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography variant="caption" color="text.disabled">B&W</Typography>
            </Box>
          )}
          <input ref={bwInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "bw"); e.target.value = ""; }} />
          <Button size="small" variant="outlined" startIcon={uploadingBw ? <CircularProgress size={14} /> : <CloudUploadIcon />}
            disabled={uploadingBw} onClick={() => bwInputRef.current?.click()} sx={{ textTransform: "none" }}>
            {uploadingBw ? "Uploading..." : "Upload"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
