import { jsonResponse, readJsonBody } from "@/lib/server/route-utils";
import {
  deleteProject,
  patchProject,
} from "@/lib/server/canvas-local-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await readJsonBody<{
    title?: string;
    viewport?: unknown;
  }>(request, {});
  const project = await patchProject(id, payload);

  return jsonResponse({ project });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await deleteProject(id);

  return jsonResponse({ deletedId: id });
}
