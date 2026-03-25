import { jsonResponse, readJsonBody } from "@/lib/server/route-utils";
import {
  deleteGraphNodes,
  getGraph,
  patchGraph,
} from "@/lib/server/canvas-local-service";
import type {
  CanvasImageNode,
  CanvasLink,
  CanvasNodeKind,
  CanvasTextNode,
  CanvasVideoNode,
} from "@/lib/supabase/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const graph = await getGraph(id);
  return jsonResponse(graph);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await readJsonBody<{
    nodes?: Array<{
      id: string;
      kind?: CanvasNodeKind;
      x: number;
      y: number;
      width?: number;
      height?: number;
    }>;
    textNodes?: CanvasTextNode[];
    imageNodes?: CanvasImageNode[];
    videoNodes?: CanvasVideoNode[];
    links?: CanvasLink[];
  }>(request, {});

  await patchGraph(id, payload);
  return jsonResponse({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await readJsonBody<{
    nodeIds?: string[];
  }>(request, {});

  await deleteGraphNodes({
    projectId: id,
    nodeIds: payload.nodeIds ?? [],
  });

  return jsonResponse({ ok: true });
}
