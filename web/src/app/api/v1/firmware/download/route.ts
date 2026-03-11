import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * GET /api/v1/firmware/download?file=scan-station-1.0.1.bin
 *
 * Serves firmware binaries via API route to avoid HTTP/2 upgrade issues
 * with ESP32 HTTPUpdate (which uses HTTP/1.1).
 */
export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file");
  if (!file || file.includes("..") || file.includes("/")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  try {
    const filePath = join(process.cwd(), "public", "firmware", file);
    const data = await readFile(filePath);

    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="${file}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
