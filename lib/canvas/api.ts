import type { GraphPayload } from "@/components/canvas/workspace/shared";
import { requestJson } from "@/lib/client/json-fetch";
import type {
  CanvasImageNode,
  CanvasLink,
  CanvasNodeKind,
  CanvasProject,
  CanvasProjectSummary,
  CanvasTextNode,
  CanvasVideoNode,
  Generation,
} from "@/lib/supabase/types";

type GraphPatchPayload = {
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
};

export type CanvasImportAssetPayload = {
  kind?: "image" | "video";
  url?: string;
  posterUrl?: string | null;
  generationId?: string | null;
  imageIndex?: number | null;
  prompt?: string | null;
  width?: number | null;
  height?: number | null;
};

export async function fetchCanvasGraph(projectId: string) {
  const { response, data } = await requestJson<GraphPayload>(
    `/api/canvas/projects/${projectId}/graph`,
    {
      cache: "no-store",
    },
    {} as GraphPayload,
  );

  if (!response.ok) {
    throw new Error("canvas_graph_load_failed");
  }

  return data;
}

export async function patchCanvasGraph(projectId: string, payload: GraphPatchPayload) {
  const { response } = await requestJson<Record<string, unknown>>(
    `/api/canvas/projects/${projectId}/graph`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {},
  );

  if (!response.ok) {
    throw new Error("canvas_graph_persist_failed");
  }
}

export async function deleteCanvasGraphNodes(projectId: string, nodeIds: string[]) {
  const { response } = await requestJson<Record<string, unknown>>(
    `/api/canvas/projects/${projectId}/graph`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nodeIds,
      }),
    },
    {},
  );

  if (!response.ok) {
    throw new Error("canvas_delete_failed");
  }
}

export async function listCanvasProjects() {
  const { response, data } = await requestJson<{
    projects?: CanvasProjectSummary[];
  }>(
    "/api/canvas/projects",
    {
      cache: "no-store",
    },
    {},
  );

  if (!response.ok || !Array.isArray(data.projects)) {
    throw new Error("canvas_projects_load_failed");
  }

  return data.projects;
}

export async function createCanvasProject(title: string) {
  const { response, data } = await requestJson<{
    project?: CanvasProject;
  }>(
    "/api/canvas/projects",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
      }),
    },
    {},
  );

  if (!response.ok || !data.project?.id) {
    throw new Error("canvas_project_create_failed");
  }

  return data.project;
}

export async function updateCanvasProject(
  projectId: string,
  payload: {
    title?: string;
    viewport?: unknown;
  },
) {
  const { response, data } = await requestJson<{
    project?: CanvasProject;
  }>(
    `/api/canvas/projects/${projectId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    {},
  );

  if (!response.ok || !data.project) {
    throw new Error("canvas_project_update_failed");
  }

  return data.project;
}

export async function deleteCanvasProject(projectId: string) {
  const { response } = await requestJson<Record<string, unknown>>(
    `/api/canvas/projects/${projectId}`,
    {
      method: "DELETE",
    },
    {},
  );

  if (!response.ok) {
    throw new Error("canvas_project_delete_failed");
  }
}

export async function replaceCanvasNodeImage(params: {
  projectId: string;
  nodeId: string;
  file: File;
  width?: number | null;
  height?: number | null;
}) {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("nodeId", params.nodeId);

  if (typeof params.width === "number") {
    formData.append("width", String(params.width));
  }

  if (typeof params.height === "number") {
    formData.append("height", String(params.height));
  }

  const { response, data } = await requestJson<{
    node?: CanvasImageNode;
  }>(
    `/api/canvas/projects/${params.projectId}/replace-node-image`,
    {
      method: "POST",
      body: formData,
    },
    {},
  );

  if (!response.ok || !data.node) {
    throw new Error("canvas_replace_failed");
  }

  return data.node;
}

export async function replaceCanvasNodeVideo(params: {
  projectId: string;
  nodeId: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("nodeId", params.nodeId);

  const { response, data } = await requestJson<{
    node?: CanvasVideoNode;
  }>(
    `/api/canvas/projects/${params.projectId}/replace-node-video`,
    {
      method: "POST",
      body: formData,
    },
    {},
  );

  if (!response.ok || !data.node) {
    throw new Error("canvas_video_replace_failed");
  }

  return data.node;
}

export async function uploadCanvasNode(params: {
  projectId: string;
  file: File;
  width?: number | null;
  height?: number | null;
}) {
  const formData = new FormData();
  formData.append("file", params.file);

  if (typeof params.width === "number") {
    formData.append("width", String(params.width));
  }

  if (typeof params.height === "number") {
    formData.append("height", String(params.height));
  }

  const { response } = await requestJson<Record<string, unknown>>(
    `/api/canvas/projects/${params.projectId}/upload-node`,
    {
      method: "POST",
      body: formData,
    },
    {},
  );

  if (!response.ok) {
    throw new Error("canvas_upload_failed");
  }
}

export async function importCanvasAssets(params: {
  projectId: string;
  assets: CanvasImportAssetPayload[];
  anchorPosition?: {
    x: number;
    y: number;
  } | null;
}) {
  const { response } = await requestJson<Record<string, unknown>>(
    `/api/canvas/projects/${params.projectId}/import-assets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assets: params.assets,
        anchorPosition: params.anchorPosition ?? null,
      }),
    },
    {},
  );

  if (!response.ok) {
    throw new Error("canvas_asset_import_failed");
  }
}

export async function listCanvasGenerations(params?: {
  limit?: number;
  mediaType?: "image" | "video";
}) {
  const searchParams = new URLSearchParams();

  if (typeof params?.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }

  if (params?.mediaType) {
    searchParams.set("mediaType", params.mediaType);
  }

  const query = searchParams.toString();
  const { response, data } = await requestJson<{
    items?: Generation[];
  }>(
    `/api/generations${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
    },
    {},
  );

  if (!response.ok) {
    throw new Error("canvas_assets_load_failed");
  }

  return data.items ?? [];
}

export async function deleteGenerationAsset(generationId: string, imageIndex: number) {
  const { response } = await requestJson<Record<string, unknown>>(
    `/api/history/${encodeURIComponent(generationId)}?imageIndex=${imageIndex}`,
    {
      method: "DELETE",
    },
    {},
  );

  if (!response.ok) {
    throw new Error("canvas_asset_delete_failed");
  }
}
