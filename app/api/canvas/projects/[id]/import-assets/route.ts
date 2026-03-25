import { importAssets } from "@/lib/server/canvas-local-service";
import { jsonResponse, readJsonBody } from "@/lib/server/route-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await readJsonBody<{
    assets?: Array<{
      kind?: "image" | "video";
      url?: string;
      posterUrl?: string | null;
      generationId?: string | null;
      imageIndex?: number | null;
      prompt?: string | null;
      width?: number | null;
      height?: number | null;
    }>;
    anchorPosition?: {
      x?: number | null;
      y?: number | null;
    } | null;
  }>(request, {});

  await importAssets({
    projectId: id,
    assets:
      payload.assets?.filter(
        (asset): asset is NonNullable<typeof payload.assets>[number] & { url: string } =>
          typeof asset?.url === "string" && asset.url.trim().length > 0,
      ) ?? [],
    anchorPosition:
      typeof payload.anchorPosition?.x === "number" &&
      typeof payload.anchorPosition?.y === "number"
        ? {
            x: payload.anchorPosition.x,
            y: payload.anchorPosition.y,
          }
        : null,
  });

  return jsonResponse({ ok: true });
}
