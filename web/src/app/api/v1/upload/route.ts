import { NextRequest, NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const CONTAINER_NAME = "uploads";

function getBlobServiceClient(): BlobServiceClient {
  // Prefer managed identity (prod) via AZURE_STORAGE_ACCOUNT
  const accountName = process.env.AZURE_STORAGE_ACCOUNT;
  if (accountName) {
    return new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      new DefaultAzureCredential()
    );
  }

  // Fallback to connection string (local dev)
  const connStr = process.env.AZURE_BLOB_CONNECTION_STRING;
  if (connStr) {
    return BlobServiceClient.fromConnectionString(connStr);
  }

  throw new Error("Azure Blob Storage is not configured — set AZURE_STORAGE_ACCOUNT or AZURE_BLOB_CONNECTION_STRING");
}

/**
 * POST /api/v1/upload
 *
 * Upload an image file to Azure Blob Storage. Returns the public URL.
 * Query params:
 *   - category: "hardware" | "brands" | "scans" (determines blob prefix)
 *
 * The "scans" category allows unauthenticated uploads (public phone enrichment flow).
 */
export async function POST(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category") || "general";

  // Auth check — skip for "scans" category (public enrichment flow)
  if (category !== "scans") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Accepted: PNG, JPEG, WebP, SVG, GIF` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    );
  }

  const validCategories = ["hardware", "brands", "scans", "general"];
  const safeCategory = validCategories.includes(category) ? category : "general";

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const blobName = `${safeCategory}/${randomUUID()}.${ext}`;

  try {
    const blobServiceClient = getBlobServiceClient();
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type },
    });

    return NextResponse.json({ url: blockBlobClient.url });
  } catch (e) {
    console.error("Upload to Azure Blob Storage failed:", e);
    return NextResponse.json(
      { error: "Upload failed — please try again" },
      { status: 500 }
    );
  }
}
