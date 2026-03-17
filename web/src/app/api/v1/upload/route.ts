import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

/**
 * POST /api/v1/upload
 *
 * Upload an image file. Returns the public URL path.
 * Query params:
 *   - category: "hardware" | "brands" (determines subdirectory)
 */
export async function POST(request: NextRequest) {
  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 400 }
    );
  }

  const category = request.nextUrl.searchParams.get("category") || "general";
  const validCategories = ["hardware", "brands", "general"];
  const safeCategory = validCategories.includes(category) ? category : "general";

  // Generate unique filename
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filename = `${randomUUID()}.${ext}`;
  const dir = join(UPLOAD_DIR, safeCategory);

  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);

  const url = `/uploads/${safeCategory}/${filename}`;

  return NextResponse.json({ url });
}
