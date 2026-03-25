import path from "node:path";
import type {
  CanvasImageNode,
  CanvasLink,
  CanvasNodeKind,
  CanvasOperation,
  CanvasTextNode,
  CanvasVideoNode,
  Generation,
  Json,
} from "@/lib/supabase/types";
import {
  resolveCanvasEditRequest,
  type CanvasOperationParams,
} from "@/lib/canvas/edit-router";
import type { CanvasActionType, CanvasEngine } from "@/lib/canvas/actions";
import {
  createProject as createStoredProject,
  deleteProject as deleteStoredProject,
  isMediaFileReferenced,
  loadLibrary,
  loadProjectGraph,
  listProjects as listStoredProjects,
  mutateLibrary,
  mutateProjectGraph,
  readMediaFile,
  removeMediaFile,
  writeMediaFile,
} from "@/lib/server/local-canvas-store";

type GraphPayload = Awaited<ReturnType<typeof loadProjectGraph>>;

const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 220;
const DEFAULT_TEXT_NODE_WIDTH = 200;
const DEFAULT_TEXT_NODE_HEIGHT = 200;
const DEFAULT_IMAGE_NODE_WIDTH = DEFAULT_TEXT_NODE_WIDTH;
const DEFAULT_IMAGE_NODE_HEIGHT = Math.round((DEFAULT_IMAGE_NODE_WIDTH * 16) / 9);
const DEFAULT_VIDEO_NODE_WIDTH = 384;
const DEFAULT_VIDEO_NODE_HEIGHT = 216;
const GENERATED_NODE_X_OFFSET = 360;
const GENERATED_NODE_Y_OFFSET = 260;
const REVISION_BRANCH_GAP = 72;
const DEFAULT_TEXT_NODE_STYLE = {
  color: "#111111",
  fontFamily: "Inter",
  fontWeight: 500,
  fontSize: 14,
  align: "left" as const,
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getImageNodeDimensions(width: number, height: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_IMAGE_NODE_WIDTH;
  const safeHeight =
    Number.isFinite(height) && height > 0 ? height : DEFAULT_IMAGE_NODE_HEIGHT;
  const scale = Math.min(
    DEFAULT_IMAGE_NODE_WIDTH / safeWidth,
    DEFAULT_IMAGE_NODE_HEIGHT / safeHeight,
  );

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function getVideoNodeDimensions(width: number, height: number) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_VIDEO_NODE_WIDTH;
  const safeHeight =
    Number.isFinite(height) && height > 0 ? height : DEFAULT_VIDEO_NODE_HEIGHT;
  const scale = Math.min(
    DEFAULT_VIDEO_NODE_WIDTH / safeWidth,
    DEFAULT_VIDEO_NODE_HEIGHT / safeHeight,
  );

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function getDefaultImageNodeMeta(imageUrl: string) {
  return {
    prompt: "",
    model: imageUrl ? "image-node" : "gemini-2.5-flash-image",
    size: "auto",
  };
}

function inferImportedVideoSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "16:9";
  }

  const ratio = width / Math.max(height, 1);
  if (Math.abs(ratio - 1) < 0.08) {
    return "1:1";
  }

  return ratio < 1 ? "9:16" : "16:9";
}

function getNextNodeOffset(index: number) {
  return {
    x: 80 + index * 30,
    y: 96 + index * 24,
  };
}

function getImportedAssetPositions(params: {
  dimensions: Array<{ width: number; height: number }>;
  anchorPosition?: { x: number; y: number } | null;
}) {
  if (!params.anchorPosition || params.dimensions.length === 0) {
    return [];
  }

  const count = params.dimensions.length;
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);
  const gapX = 40;
  const gapY = 48;
  const columnWidths = Array.from({ length: columns }, (_, columnIndex) =>
    params.dimensions.reduce((max, dimension, index) => {
      if (index % columns !== columnIndex) {
        return max;
      }

      return Math.max(max, dimension.width);
    }, 0),
  );
  const rowHeights = Array.from({ length: rows }, (_, rowIndex) =>
    params.dimensions.reduce((max, dimension, index) => {
      if (Math.floor(index / columns) !== rowIndex) {
        return max;
      }

      return Math.max(max, dimension.height);
    }, 0),
  );
  const totalWidth =
    columnWidths.reduce((sum, width) => sum + width, 0) + gapX * (columns - 1);
  const totalHeight =
    rowHeights.reduce((sum, height) => sum + height, 0) + gapY * (rows - 1);
  const startX = params.anchorPosition.x - totalWidth / 2;
  const startY = params.anchorPosition.y - totalHeight / 2;

  return params.dimensions.map((dimension, index) => {
    const columnIndex = index % columns;
    const rowIndex = Math.floor(index / columns);
    const x =
      startX +
      columnWidths.slice(0, columnIndex).reduce((sum, width) => sum + width, 0) +
      gapX * columnIndex +
      (columnWidths[columnIndex] - dimension.width) / 2;
    const y =
      startY +
      rowHeights.slice(0, rowIndex).reduce((sum, height) => sum + height, 0) +
      gapY * rowIndex +
      (rowHeights[rowIndex] - dimension.height) / 2;

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  });
}

function getExtensionFromContentType(contentType: string | null | undefined) {
  const normalized = (contentType ?? "").toLowerCase();

  if (normalized.includes("mp4")) {
    return "mp4";
  }

  if (normalized.includes("webm")) {
    return "webm";
  }

  if (normalized.includes("quicktime") || normalized.includes("mov")) {
    return "mov";
  }

  if (normalized.includes("png")) {
    return "png";
  }

  if (normalized.includes("webp")) {
    return "webp";
  }

  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }

  return "png";
}

function getContentTypeFromExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

function getMediaUrl(fileName: string) {
  return `/api/media/${fileName}`;
}

function getFileNameFromMediaUrl(mediaUrl: string) {
  const prefix = "/api/media/";
  return mediaUrl.startsWith(prefix) ? mediaUrl.slice(prefix.length) : null;
}

function averagePosition(
  nodes: Array<Pick<CanvasImageNode, "x" | "y" | "width" | "height">>,
) {
  if (nodes.length === 0) {
    return { x: 80, y: 80 };
  }

  return {
    x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
  };
}

function sortOperationsByCreatedAt(
  left: Pick<CanvasOperation, "id" | "created_at">,
  right: Pick<CanvasOperation, "id" | "created_at">,
) {
  const diff =
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime();

  return diff !== 0 ? diff : left.id.localeCompare(right.id);
}

function getRevisionLevel(
  operation: Pick<CanvasOperation, "id" | "created_at" | "revision_of_operation_id">,
  operations: Array<
    Pick<CanvasOperation, "id" | "created_at" | "revision_of_operation_id">
  >,
): number {
  if (!operation.revision_of_operation_id) {
    return 0;
  }

  const siblings = operations
    .filter(
      (item) => item.revision_of_operation_id === operation.revision_of_operation_id,
    )
    .sort(sortOperationsByCreatedAt);
  const siblingIndex = Math.max(
    0,
    siblings.findIndex((item) => item.id === operation.id),
  );
  const parent = operations.find(
    (item) => item.id === operation.revision_of_operation_id,
  );

  return (parent ? getRevisionLevel(parent, operations) : 0) + siblingIndex + 1;
}

function getGeneratedNodePositions(params: {
  count: number;
  inputNodes: Array<Pick<CanvasImageNode, "x" | "y" | "width" | "height">>;
  revisionLevel: number;
}) {
  const pivot = averagePosition(params.inputNodes);
  const rightMost = params.inputNodes.reduce(
    (max, node) => Math.max(max, node.x + node.width),
    pivot.x,
  );
  const primaryHeight = params.inputNodes[0]?.height ?? DEFAULT_NODE_HEIGHT;
  const branchShiftY =
    params.revisionLevel <= 0
      ? 0
      : params.revisionLevel *
        Math.max(primaryHeight + REVISION_BRANCH_GAP, GENERATED_NODE_Y_OFFSET);
  const startY = pivot.y - ((params.count - 1) * GENERATED_NODE_Y_OFFSET) / 2;

  return Array.from({ length: params.count }, (_, index) => ({
    x: rightMost + GENERATED_NODE_X_OFFSET,
    y: startY + branchShiftY + index * GENERATED_NODE_Y_OFFSET,
  }));
}

async function saveBufferAsLocalMedia(params: {
  buffer: Buffer;
  contentType: string;
}) {
  const extension = getExtensionFromContentType(params.contentType);
  const fileName = `${createId("media")}.${extension}`;

  await writeMediaFile({
    fileName,
    buffer: params.buffer,
  });

  return {
    fileName,
    url: getMediaUrl(fileName),
    contentType: getContentTypeFromExtension(extension),
  };
}

async function fetchUrlAsLocalMedia(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`media_fetch_failed:${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();

  return saveBufferAsLocalMedia({
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "image/png",
  });
}

function buildGeneration(params: {
  prompt: string;
  model: string;
  imageUrls: string[];
  referenceImages?: string[];
}) {
  const now = nowIso();
  return {
    id: createId("generation"),
    user_id: null,
    guest_session_id: null,
    task_id: createId("task"),
    prompt: params.prompt,
    negative_prompt: null,
    model: params.model,
    size: "auto",
    quality: "high",
    style: null,
    status: "completed",
    progress: 100,
    output_count: params.imageUrls.length,
    result_urls: params.imageUrls,
    reference_images: params.referenceImages ?? null,
    batch_task_ids: null,
    error_message: null,
    credits_used: 0,
    created_at: now,
    updated_at: now,
  } satisfies Generation;
}

async function removeMediaFileIfUnreferenced(fileName: string | null) {
  if (!fileName) {
    return;
  }

  if (await isMediaFileReferenced(fileName)) {
    return;
  }

  await removeMediaFile(fileName);
}

async function executeLocalCanvasOperation(params: {
  inputImages: string[];
  outputCount: number;
}) {
  if (params.inputImages.length === 0) {
    throw new Error("canvas_input_required");
  }

  return Array.from(
    { length: params.outputCount },
    (_, index) => params.inputImages[index % params.inputImages.length],
  );
}

async function persistOutputImages(imageUrls: string[]) {
  const persisted: string[] = [];

  for (const imageUrl of imageUrls) {
    if (imageUrl.startsWith("/api/media/")) {
      persisted.push(imageUrl);
      continue;
    }

    if (imageUrl.startsWith("data:")) {
      const [meta, data] = imageUrl.split(",", 2);
      const mimeMatch = meta.match(/^data:(.*?);base64$/);
      const buffer = Buffer.from(data ?? "", "base64");
      const media = await saveBufferAsLocalMedia({
        buffer,
        contentType: mimeMatch?.[1] || "image/png",
      });
      persisted.push(media.url);
      continue;
    }

    const media = await fetchUrlAsLocalMedia(imageUrl);
    persisted.push(media.url);
  }

  return persisted;
}

async function executeCanvasOperation(params: {
  outputCount: number;
  inputImages: string[];
}) {
  return executeLocalCanvasOperation(params);
}

export async function getGraph(projectId: string) {
  const graph = await loadProjectGraph(projectId);

  return {
    ...graph,
    operations: [],
  };
}

export async function listProjects() {
  return listStoredProjects();
}

export async function createProject(title?: string) {
  const graph = await createStoredProject(title);
  return graph.project;
}

export async function deleteProject(projectId: string) {
  await deleteStoredProject(projectId);
}

export async function patchProject(
  projectId: string,
  patch: { title?: string; viewport?: unknown },
) {
  const next = await mutateProjectGraph(projectId, (current) => {
    const now = nowIso();
    return {
      ...current,
      project: {
        ...current.project,
        ...(typeof patch.title === "string" ? { title: patch.title } : {}),
        ...(patch.viewport ? { viewport_json: patch.viewport as Json } : {}),
        updated_at: now,
      },
    };
  });

  return next.project;
}

export async function patchGraph(
  projectId: string,
  patch: {
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
  },
) {
  await mutateProjectGraph(projectId, (current) => {
    const now = nowIso();

    if (
      patch.textNodes ||
      patch.imageNodes ||
      patch.videoNodes ||
      patch.links
    ) {
      return {
        ...current,
        textNodes: patch.textNodes ?? current.textNodes,
        imageNodes: patch.imageNodes ?? current.imageNodes,
        videoNodes: patch.videoNodes ?? current.videoNodes,
        links: patch.links ?? current.links,
        project: {
          ...current.project,
          updated_at: now,
        },
      };
    }

    return {
      ...current,
      textNodes: current.textNodes.map((node) => {
        const match = patch.nodes?.find((item) => item.id === node.id);
        return match
          ? {
              ...node,
              x: match.x,
              y: match.y,
              width: typeof match.width === "number" ? match.width : node.width,
              height:
                typeof match.height === "number" ? match.height : node.height,
              updated_at: now,
            }
          : node;
      }),
      imageNodes: current.imageNodes.map((node) => {
        const match = patch.nodes?.find((item) => item.id === node.id);
        return match
          ? {
              ...node,
              x: match.x,
              y: match.y,
              width: typeof match.width === "number" ? match.width : node.width,
              height:
                typeof match.height === "number" ? match.height : node.height,
              updated_at: now,
            }
          : node;
      }),
      videoNodes: current.videoNodes.map((node) => {
        const match = patch.nodes?.find((item) => item.id === node.id);
        return match
          ? {
              ...node,
              x: match.x,
              y: match.y,
              width: typeof match.width === "number" ? match.width : node.width,
              height:
                typeof match.height === "number" ? match.height : node.height,
              updated_at: now,
            }
          : node;
      }),
      project: {
        ...current.project,
        updated_at: now,
      },
    };
  });
}

export async function uploadNode(params: {
  projectId: string;
  file: File;
  width: number;
  height: number;
}) {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const media = await saveBufferAsLocalMedia({
    buffer,
    contentType: params.file.type || "image/png",
  });
  const now = nowIso();
  const generation = buildGeneration({
    prompt: "Uploaded image",
    model: "local-upload",
    imageUrls: [media.url],
  });
  const nodeId = createId("node");

  await mutateLibrary((current) => ({
    generations: [generation, ...current.generations],
  }));

  await mutateProjectGraph(params.projectId, (current) => ({
    ...current,
    project: {
      ...current.project,
      cover_image_url: current.project.cover_image_url ?? media.url,
      last_refined_at: now,
      updated_at: now,
    },
    imageNodes: [
      (() => {
        const offset = getNextNodeOffset(
          current.textNodes.length + current.imageNodes.length + current.videoNodes.length,
        );
        const dimensions = getImageNodeDimensions(
          params.width,
          params.height,
        );

        return {
          id: nodeId,
          project_id: params.projectId,
          image_url: media.url,
          origin_type: "upload",
          source_generation_id: generation.id,
          source_generation_image_index: 0,
          x: offset.x,
          y: offset.y,
          width: dimensions.width,
          height: dimensions.height,
          ...getDefaultImageNodeMeta(media.url),
          created_at: now,
          updated_at: now,
        } satisfies CanvasImageNode;
      })(),
      ...current.imageNodes,
    ],
  }));
}

export async function replaceNodeImage(params: {
  projectId: string;
  nodeId: string;
  file: File;
  width: number;
  height: number;
}) {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const media = await saveBufferAsLocalMedia({
    buffer,
    contentType: params.file.type || "image/png",
  });
  const now = nowIso();
  let updatedNode: CanvasImageNode | null = null;
  let previousFileToCleanup: string | null = null;

  await mutateProjectGraph(params.projectId, (current) => ({
    ...current,
    project: {
      ...current.project,
      cover_image_url:
        current.project.cover_image_url === null
          ? media.url
          : current.project.cover_image_url,
      last_refined_at: now,
      updated_at: now,
    },
    imageNodes: current.imageNodes.map((node) => {
      if (node.id !== params.nodeId) {
        return node;
      }

      const previousFile = getFileNameFromMediaUrl(node.image_url);
      if (previousFile && previousFile !== media.fileName) {
        previousFileToCleanup = previousFile;
      }

      const dimensions = getImageNodeDimensions(
        params.width,
        params.height,
      );

      updatedNode = {
        ...node,
        image_url: media.url,
        width: dimensions.width,
        height: dimensions.height,
        updated_at: now,
      };

      return updatedNode;
    }),
  }));

  if (!updatedNode) {
    throw new Error("canvas_node_not_found");
  }

  await removeMediaFileIfUnreferenced(previousFileToCleanup);

  return updatedNode;
}

export async function replaceNodeVideo(params: {
  projectId: string;
  nodeId: string;
  file: File;
}) {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const media = await saveBufferAsLocalMedia({
    buffer,
    contentType: params.file.type || "video/mp4",
  });
  const now = nowIso();
  let updatedNode: CanvasVideoNode | null = null;

  await mutateProjectGraph(params.projectId, (current) => ({
    ...current,
    project: {
      ...current.project,
      updated_at: now,
    },
    videoNodes: current.videoNodes.map((node) => {
      if (node.id !== params.nodeId) {
        return node;
      }

      updatedNode = {
        ...node,
        videoUrl: media.url,
        posterUrl: null,
        status: "idle",
        updated_at: now,
      };

      return updatedNode;
    }),
  }));

  if (!updatedNode) {
    throw new Error("video_node_not_found");
  }

  return updatedNode;
}

export async function importAssets(params: {
  projectId: string;
  assets: Array<{
    kind?: "image" | "video";
    url: string;
    posterUrl?: string | null;
    generationId?: string | null;
    imageIndex?: number | null;
    prompt?: string | null;
    width?: number | null;
    height?: number | null;
  }>;
  anchorPosition?: {
    x: number;
    y: number;
  } | null;
}) {
  const now = nowIso();
  const nodeDimensions = params.assets.map((asset) =>
    asset.kind === "video"
      ? getVideoNodeDimensions(
          asset.width ?? DEFAULT_VIDEO_NODE_WIDTH,
          asset.height ?? DEFAULT_VIDEO_NODE_HEIGHT,
        )
      : getImageNodeDimensions(
          asset.width ?? DEFAULT_IMAGE_NODE_WIDTH,
          asset.height ?? DEFAULT_IMAGE_NODE_HEIGHT,
        ),
  );
  const positions = getImportedAssetPositions({
    dimensions: nodeDimensions,
    anchorPosition: params.anchorPosition,
  });

  await mutateProjectGraph(params.projectId, (current) => {
    const importedNodes = params.assets.map((asset, index) => {
      const offset =
        positions[index] ??
        getNextNodeOffset(
          current.textNodes.length +
            current.imageNodes.length +
            current.videoNodes.length +
            index,
        );
      const dimensions =
        nodeDimensions[index] ??
        (asset.kind === "video"
          ? {
              width: DEFAULT_VIDEO_NODE_WIDTH,
              height: DEFAULT_VIDEO_NODE_HEIGHT,
            }
          : {
              width: DEFAULT_IMAGE_NODE_WIDTH,
              height: DEFAULT_IMAGE_NODE_HEIGHT,
            });

      if (asset.kind === "video") {
        return {
          kind: "video" as const,
          node: {
            id: createId("node"),
            project_id: params.projectId,
            x: offset.x,
            y: offset.y,
            width: dimensions.width,
            height: dimensions.height,
            title: "Video Node",
            prompt: asset.prompt?.trim() ?? "",
            model: "video-node",
            size: inferImportedVideoSize(
              asset.width ?? dimensions.width,
              asset.height ?? dimensions.height,
            ),
            trimStartSeconds: 0,
            durationSeconds: 4,
            motionStrength: 50,
            status: asset.url ? ("completed" as const) : ("idle" as const),
            posterUrl: asset.posterUrl ?? null,
            videoUrl: asset.url,
            created_at: now,
            updated_at: now,
          } satisfies CanvasVideoNode,
        };
      }

      return {
        kind: "image" as const,
        node: {
          id: createId("node"),
          project_id: params.projectId,
          image_url: asset.url,
          origin_type: "asset" as const,
          source_generation_id: asset.generationId ?? null,
          source_generation_image_index:
            typeof asset.imageIndex === "number" ? asset.imageIndex : null,
          x: offset.x,
          y: offset.y,
          width: dimensions.width,
          height: dimensions.height,
          ...getDefaultImageNodeMeta(asset.url),
          created_at: now,
          updated_at: now,
        } satisfies CanvasImageNode,
      };
    });

    return {
      ...current,
      project: {
        ...current.project,
        last_refined_at: now,
        updated_at: now,
      },
      imageNodes: [
        ...importedNodes.flatMap((entry) =>
          entry.kind === "image" ? [entry.node] : [],
        ),
        ...current.imageNodes,
      ],
      videoNodes: [
        ...importedNodes.flatMap((entry) =>
          entry.kind === "video" ? [entry.node] : [],
        ),
        ...current.videoNodes,
      ],
    };
  });
}

export async function deleteGraphNodes(params: {
  projectId: string;
  nodeIds: string[];
}) {
  const nodeIdSet = new Set(params.nodeIds);

  await mutateProjectGraph(params.projectId, (current) => ({
    ...current,
    textNodes: current.textNodes.filter((node) => !nodeIdSet.has(node.id)),
    imageNodes: current.imageNodes.filter((node) => !nodeIdSet.has(node.id)),
    videoNodes: current.videoNodes.filter((node) => !nodeIdSet.has(node.id)),
    links: current.links.filter(
      (link) =>
        !(
          nodeIdSet.has(link.source_id) || nodeIdSet.has(link.target_id)
        ),
    ),
  }));
}

export async function deleteGenerationImage(params: {
  generationId: string;
  imageIndex: number;
}) {
  await mutateLibrary((current) => ({
    generations: current.generations.flatMap((generation) => {
      if (generation.id !== params.generationId) {
        return [generation];
      }

      const nextUrls = (generation.result_urls ?? []).filter(
        (_item, index) => index !== params.imageIndex,
      );

      if (nextUrls.length === 0) {
        return [];
      }

      return [
        {
          ...generation,
          result_urls: nextUrls,
          output_count: nextUrls.length,
          updated_at: nowIso(),
        },
      ];
    }),
  }));
}

export async function listGenerations(limit = 80) {
  const library = await loadLibrary();

  return library.generations
    .slice()
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, limit);
}

export async function getLocalProfile() {
  return {
    id: "local-workspace-user",
    email: "",
    name: "Local Workspace",
    plan: "ultimate" as const,
    credits: 0,
    monthly_quota: 0,
    credits_reset_at: new Date(0).toISOString(),
    creem_customer_id: null,
    creem_customer_email: null,
    creem_subscription_id: null,
    created_at: new Date(0).toISOString(),
    updated_at: nowIso(),
  };
}

export async function runOperation(params: {
  projectId: string;
  actionType: CanvasActionType;
  prompt: string;
  inputNodeIds: string[];
  requestedEngine?: CanvasEngine | null;
  outputCount?: number | null;
  size?: string | null;
  operationId?: string | null;
  params?: CanvasOperationParams | null;
}) {
  const graph = await loadProjectGraph(params.projectId);
  const inputNodes = graph.imageNodes.filter((node) =>
    params.inputNodeIds.includes(node.id),
  );
  const editRequest = resolveCanvasEditRequest({
    actionType: params.actionType,
    prompt: params.prompt,
    imageUrls: inputNodes.map((node) => node.image_url),
    requestedEngine: params.requestedEngine,
    outputCount: params.outputCount,
    size: params.size,
    params: params.params,
  });
  const now = nowIso();
  const operation: CanvasOperation = {
    id: createId("operation"),
    project_id: params.projectId,
    action_type: editRequest.actionType,
    engine: editRequest.engine,
    model_id: editRequest.modelId,
    prompt: editRequest.prompt,
    params_json: {
      ...(editRequest.params as Record<string, Json | undefined>),
      outputCount: editRequest.outputCount,
      ...(editRequest.size ? { size: editRequest.size } : {}),
    },
    status: "processing",
    generation_id: null,
    task_id: createId("task"),
    revision_of_operation_id: params.operationId ?? null,
    created_at: now,
    updated_at: now,
  };

  const links: CanvasLink[] = params.inputNodeIds.map((nodeId, index) => ({
    id: createId("link"),
    project_id: params.projectId,
    source_kind: "image",
    source_id: nodeId,
    target_kind: "operation",
    target_id: operation.id,
    relation_type: "input",
    sort_order: index,
    created_at: now,
  }));

  await mutateProjectGraph(params.projectId, (current) => ({
    ...current,
    operations: [...current.operations, operation],
    links: [...current.links, ...links],
  }));

  try {
    const outputUrls = await executeCanvasOperation({
      outputCount: editRequest.outputCount,
      inputImages: editRequest.imageUrls,
    });
    const persistedUrls = await persistOutputImages(outputUrls);
    const generation = buildGeneration({
      prompt: editRequest.prompt,
      model: editRequest.modelId,
      imageUrls: persistedUrls,
      referenceImages: editRequest.imageUrls,
    });
    const revisionLevel = getRevisionLevel(operation, [
      ...graph.operations,
      operation,
    ]);
    const positions = getGeneratedNodePositions({
      count: persistedUrls.length,
      inputNodes,
      revisionLevel,
    });

    await mutateLibrary((current) => ({
      generations: [generation, ...current.generations],
    }));

    await mutateProjectGraph(params.projectId, (current) => {
      const completedOperation: CanvasOperation = {
        ...operation,
        status: "completed",
        generation_id: generation.id,
        updated_at: nowIso(),
      };
      const nextNodes = persistedUrls.map((imageUrl, index) => ({
        id: createId("node"),
        project_id: params.projectId,
        image_url: imageUrl,
        origin_type: "generated" as const,
        source_generation_id: generation.id,
        source_generation_image_index: index,
        x: positions[index]?.x ?? 0,
        y: positions[index]?.y ?? 0,
        width: inputNodes[0]?.width ?? DEFAULT_NODE_WIDTH,
        height: inputNodes[0]?.height ?? DEFAULT_NODE_HEIGHT,
        prompt: editRequest.prompt,
        model: editRequest.modelId,
        size: editRequest.size ?? "auto",
        created_at: nowIso(),
        updated_at: nowIso(),
      }));
      const outputLinks: CanvasLink[] = nextNodes.map((node, index) => ({
        id: createId("link"),
        project_id: params.projectId,
        source_kind: "operation",
        source_id: operation.id,
        target_kind: "image",
        target_id: node.id,
        relation_type: "output",
        sort_order: index,
        created_at: nowIso(),
      }));

      return {
        ...current,
        project: {
          ...current.project,
          cover_image_url:
            current.project.cover_image_url ?? nextNodes[0]?.image_url ?? null,
          last_refined_at: nowIso(),
          updated_at: nowIso(),
        },
        imageNodes: [...current.imageNodes, ...nextNodes],
        operations: current.operations.map((item) =>
          item.id === operation.id ? completedOperation : item,
        ),
        links: [...current.links, ...outputLinks],
      };
    });
  } catch (error) {
    await mutateProjectGraph(params.projectId, (current) => ({
      ...current,
      operations: current.operations.map((item) =>
        item.id === operation.id
          ? {
              ...item,
              status: "failed",
              updated_at: nowIso(),
            }
          : item,
      ),
    }));
    throw error;
  }

  const nextGraph = await loadProjectGraph(params.projectId);
  return nextGraph.operations.find((item) => item.id === operation.id) ?? operation;
}

export async function rerunOperation(params: {
  projectId: string;
  operationId: string;
  prompt: string;
  requestedEngine?: CanvasEngine | null;
  outputCount?: number | null;
}) {
  const graph = await loadProjectGraph(params.projectId);
  const currentOperation = graph.operations.find(
    (item) => item.id === params.operationId,
  );
  if (!currentOperation) {
    throw new Error("canvas_operation_not_found");
  }

  const inputNodeIds = graph.links
    .filter(
      (link) =>
        link.target_kind === "operation" &&
        link.target_id === params.operationId &&
        link.source_kind === "image",
    )
    .map((link) => link.source_id);
  const currentParams =
    currentOperation.params_json &&
    typeof currentOperation.params_json === "object" &&
    !Array.isArray(currentOperation.params_json)
      ? (currentOperation.params_json as Record<string, unknown>)
      : {};

  return runOperation({
    projectId: params.projectId,
    actionType: currentOperation.action_type as CanvasActionType,
    prompt: params.prompt,
    inputNodeIds,
    requestedEngine:
      params.requestedEngine ?? (currentOperation.engine as CanvasEngine | null),
    outputCount:
      params.outputCount ??
      (typeof currentParams.outputCount === "number"
        ? currentParams.outputCount
        : null),
    size: typeof currentParams.size === "string" ? currentParams.size : null,
    operationId: currentOperation.id,
  });
}

export async function getMediaResponse(fileName: string) {
  const buffer = await readMediaFile(fileName);
  const extension = path.extname(fileName).replace(".", "");
  return {
    buffer,
    contentType: getContentTypeFromExtension(extension),
  };
}
