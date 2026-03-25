import { deleteGenerationImage } from "@/lib/server/canvas-local-service";
import { errorResponse, jsonResponse } from "@/lib/server/route-utils";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const imageIndex = Number(url.searchParams.get("imageIndex") ?? "-1");

  if (!Number.isFinite(imageIndex) || imageIndex < 0) {
    return errorResponse("invalid_image_index");
  }

  await deleteGenerationImage({
    generationId: id,
    imageIndex,
  });

  return jsonResponse({ ok: true });
}
