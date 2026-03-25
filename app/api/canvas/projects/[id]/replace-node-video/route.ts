import { replaceNodeVideo } from "@/lib/server/canvas-local-service";
import { errorResponse, jsonResponse } from "@/lib/server/route-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  const nodeId = formData.get("nodeId");

  if (!(file instanceof File) || typeof nodeId !== "string") {
    return errorResponse("node_id_and_file_required");
  }

  const node = await replaceNodeVideo({
    projectId: id,
    nodeId,
    file,
  });

  return jsonResponse({ node });
}
