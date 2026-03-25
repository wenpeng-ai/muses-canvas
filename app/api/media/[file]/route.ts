import { NextResponse } from "next/server";
import { getMediaResponse } from "@/lib/server/canvas-local-service";
import { errorResponse } from "@/lib/server/route-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  try {
    const { file } = await params;
    const response = await getMediaResponse(file);

    return new NextResponse(response.buffer, {
      headers: {
        "Content-Type": response.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return errorResponse("media_not_found", { status: 404 });
  }
}
