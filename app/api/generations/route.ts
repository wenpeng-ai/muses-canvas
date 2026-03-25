import { inferMediaKindFromUrl } from "@/lib/media/media-url";
import { jsonResponse } from "@/lib/server/route-utils";
import { listGenerations } from "@/lib/server/canvas-local-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "80");
  const mediaType = url.searchParams.get("mediaType");
  const effectiveLimit = Number.isFinite(limit) ? limit : 80;
  const items = await listGenerations(Number.MAX_SAFE_INTEGER);
  const filteredItems =
    mediaType === "image" || mediaType === "video"
      ? items.filter((item) =>
          (item.result_urls ?? []).some(
            (resultUrl) => inferMediaKindFromUrl(resultUrl) === mediaType,
          ),
        )
      : items;

  return jsonResponse({ items: filteredItems.slice(0, effectiveLimit) });
}
