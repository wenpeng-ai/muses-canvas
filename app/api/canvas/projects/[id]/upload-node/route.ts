import { uploadNode } from "@/lib/server/canvas-local-service";
import {
  errorResponse,
  jsonResponse,
  parseNumberInput,
} from "@/lib/server/route-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return errorResponse("file_required");
  }

  await uploadNode({
    projectId: id,
    file,
    width: parseNumberInput(formData.get("width"), 220),
    height: parseNumberInput(formData.get("height"), 220),
  });

  return jsonResponse({ ok: true });
}
