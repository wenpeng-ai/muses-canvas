import { createdResponse, jsonResponse, readJsonBody } from "@/lib/server/route-utils";
import {
  createProject,
  listProjects,
} from "@/lib/server/canvas-local-service";

export async function GET() {
  const projects = await listProjects();
  return jsonResponse({ projects });
}

export async function POST(request: Request) {
  const payload = await readJsonBody<{ title?: string }>(request, {});
  const project = await createProject(payload.title);

  return createdResponse({ project });
}
