import { promises as fs } from "node:fs";
import path from "node:path";
import { encodeProviderModel } from "@/lib/provider-settings";
import type {
  CanvasImageNode,
  CanvasLink,
  CanvasOperation,
  CanvasProject,
  CanvasProjectSummary,
  CanvasTextNode,
  CanvasVideoNode,
  Generation,
} from "@/lib/supabase/types";

const DATA_ROOT = path.join(process.cwd(), "data");
const PROJECTS_ROOT = path.join(DATA_ROOT, "projects");
const MEDIA_ROOT = path.join(DATA_ROOT, "media");
const LIBRARY_FILE = path.join(DATA_ROOT, "library.json");
const PROVIDER_SETTINGS_FILE = path.join(DATA_ROOT, "provider-settings.json");
const LOCAL_MEDIA_PREFIX = "/api/media/";
const DEFAULT_TEXT_NODE_WIDTH = 200;
const DEFAULT_TEXT_NODE_HEIGHT = 200;
const DEFAULT_TEXT_NODE_MODEL = encodeProviderModel("openai", "gpt-5-mini");
const DEFAULT_IMAGE_NODE_WIDTH = DEFAULT_TEXT_NODE_WIDTH;
const DEFAULT_IMAGE_NODE_HEIGHT = Math.round((DEFAULT_IMAGE_NODE_WIDTH * 16) / 9);
const DEFAULT_VIDEO_NODE_WIDTH = 384;
const DEFAULT_VIDEO_NODE_HEIGHT = 216;
const DEFAULT_IMAGE_NODE_MODEL = encodeProviderModel(
  "google",
  "gemini-2.5-flash-image",
);
const DEFAULT_VIDEO_NODE_MODEL = encodeProviderModel(
  "veo",
  "veo-3.0-fast-generate-001",
);
const DEFAULT_TEXT_NODE_STYLE = {
  color: "#111111",
  fontFamily: "Inter",
  fontWeight: 500,
  fontSize: 14,
  align: "left" as const,
};

type ProjectGraphState = {
  project: CanvasProject;
  textNodes: CanvasTextNode[];
  imageNodes: CanvasImageNode[];
  videoNodes: CanvasVideoNode[];
  operations: CanvasOperation[];
  links: CanvasLink[];
};

type LibraryState = {
  generations: Generation[];
};

function getLocalMediaFileNameFromUrl(value: unknown) {
  if (typeof value !== "string" || !value.startsWith(LOCAL_MEDIA_PREFIX)) {
    return null;
  }

  return value.slice(LOCAL_MEDIA_PREFIX.length);
}

function sanitizeProjectId(projectId: string) {
  return projectId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function getProjectFile(projectId: string) {
  return path.join(PROJECTS_ROOT, `${sanitizeProjectId(projectId)}.json`);
}

async function projectFileExists(projectId: string) {
  try {
    await fs.access(getProjectFile(projectId));
    return true;
  } catch {
    return false;
  }
}

async function ensureDataRoots() {
  await fs.mkdir(PROJECTS_ROOT, { recursive: true });
  await fs.mkdir(MEDIA_ROOT, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDataRoots();
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function createDefaultProject(projectId: string): CanvasProject {
  const now = new Date().toISOString();

  return {
    id: projectId,
    user_id: "local-workspace-user",
    title: "Untitled",
    cover_image_url: null,
    viewport_json: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    last_refined_at: now,
    created_at: now,
    updated_at: now,
  };
}

function normalizeTextNode(node: CanvasTextNode): CanvasTextNode {
  return {
    ...node,
    width:
      Number.isFinite(node.width) && node.width > 0
        ? node.width
        : DEFAULT_TEXT_NODE_WIDTH,
    height:
      Number.isFinite(node.height) && node.height > 0
        ? node.height
        : DEFAULT_TEXT_NODE_HEIGHT,
    title: node.title ?? "",
    content: node.content ?? "",
    model: node.model ?? DEFAULT_TEXT_NODE_MODEL,
    color: node.color ?? DEFAULT_TEXT_NODE_STYLE.color,
    fontFamily: node.fontFamily ?? DEFAULT_TEXT_NODE_STYLE.fontFamily,
    fontWeight: node.fontWeight ?? DEFAULT_TEXT_NODE_STYLE.fontWeight,
    fontSize: node.fontSize ?? DEFAULT_TEXT_NODE_STYLE.fontSize,
    align: node.align ?? DEFAULT_TEXT_NODE_STYLE.align,
  };
}

function normalizeImageNode(node: CanvasImageNode): CanvasImageNode {
  return {
    ...node,
    width:
      Number.isFinite(node.width) && node.width > 0
        ? node.width
        : DEFAULT_IMAGE_NODE_WIDTH,
    height:
      Number.isFinite(node.height) && node.height > 0
        ? node.height
        : DEFAULT_IMAGE_NODE_HEIGHT,
    prompt: node.prompt ?? "",
    model: node.model ?? DEFAULT_IMAGE_NODE_MODEL,
    size: node.size ?? "auto",
  };
}

function normalizeVideoNode(node: CanvasVideoNode): CanvasVideoNode {
  return {
    ...node,
    width: node.width > 0 ? node.width : DEFAULT_VIDEO_NODE_WIDTH,
    height: node.height > 0 ? node.height : DEFAULT_VIDEO_NODE_HEIGHT,
    title: node.title ?? "",
    prompt: node.prompt ?? "",
    model: node.model ?? DEFAULT_VIDEO_NODE_MODEL,
    size:
      typeof node.size === "string" && node.size.trim().length > 0
        ? node.size
        : "16:9",
    trimStartSeconds:
      Number.isFinite(node.trimStartSeconds) && node.trimStartSeconds >= 0
        ? node.trimStartSeconds
        : 0,
    durationSeconds:
      Number.isFinite(node.durationSeconds) && node.durationSeconds > 0
        ? node.durationSeconds
        : 4,
    motionStrength:
      Number.isFinite(node.motionStrength) && node.motionStrength >= 0
        ? node.motionStrength
        : 50,
    status: node.status ?? "idle",
    posterUrl: node.posterUrl ?? null,
    videoUrl: node.videoUrl ?? null,
  };
}

function normalizeProjectGraph(
  projectId: string,
  data: Partial<ProjectGraphState> | ProjectGraphState,
): ProjectGraphState {
  const fallbackProject = createDefaultProject(projectId);
  const project = data.project?.id ? data.project : fallbackProject;

  return {
    project,
    textNodes: Array.isArray(data.textNodes)
      ? data.textNodes.map(normalizeTextNode)
      : [],
    imageNodes: Array.isArray(data.imageNodes)
      ? data.imageNodes.map(normalizeImageNode)
      : [],
    videoNodes: Array.isArray(data.videoNodes)
      ? data.videoNodes.map(normalizeVideoNode)
      : [],
    operations: Array.isArray(data.operations) ? data.operations : [],
    links: Array.isArray(data.links) ? data.links : [],
  };
}

export async function loadProjectGraph(projectId: string): Promise<ProjectGraphState> {
  await ensureDataRoots();
  const filePath = getProjectFile(projectId);
  const fallback: ProjectGraphState = {
    project: createDefaultProject(projectId),
    textNodes: [],
    imageNodes: [],
    videoNodes: [],
    operations: [],
    links: [],
  };
  const data = await readJsonFile<Partial<ProjectGraphState>>(filePath, fallback);

  return normalizeProjectGraph(projectId, data);
}

export async function listProjects(): Promise<CanvasProjectSummary[]> {
  await ensureDataRoots();

  const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true });
  const projectFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".json"),
  );

  const summaries = await Promise.all(
    projectFiles.map(async (entry) => {
      const projectId = entry.name.replace(/\.json$/i, "");
      const fallback: ProjectGraphState = {
        project: createDefaultProject(projectId),
        textNodes: [],
        imageNodes: [],
        videoNodes: [],
        operations: [],
        links: [],
      };
      const graph = normalizeProjectGraph(
        projectId,
        await readJsonFile<Partial<ProjectGraphState>>(
          path.join(PROJECTS_ROOT, entry.name),
          fallback,
        ),
      );
      const project = graph.project?.id ? graph.project : fallback.project;

      return {
        id: project.id,
        title: project.title,
        cover_image_url: project.cover_image_url,
        last_refined_at: project.last_refined_at,
        created_at: project.created_at,
        updated_at: project.updated_at,
        operation_count: graph.operations.length,
        image_count: graph.imageNodes.length,
      } satisfies CanvasProjectSummary;
    }),
  );

  return summaries.sort((left, right) => {
    const updatedDiff =
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();

    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return left.title.localeCompare(right.title);
  });
}

export async function createProject(
  title?: string,
): Promise<ProjectGraphState> {
  await ensureDataRoots();

  const normalizedTitle = title?.trim() || "Untitled";
  const baseId = `project-${Date.now().toString(36)}`;
  let projectId = baseId;
  let suffix = 1;

  while (await projectFileExists(projectId)) {
    projectId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const graph: ProjectGraphState = {
    project: {
      ...createDefaultProject(projectId),
      title: normalizedTitle,
    },
    textNodes: [],
    imageNodes: [],
    videoNodes: [],
    operations: [],
    links: [],
  };

  await saveProjectGraph(projectId, graph);

  return graph;
}

export async function deleteProject(projectId: string) {
  await ensureDataRoots();

  try {
    await fs.unlink(getProjectFile(projectId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function saveProjectGraph(
  projectId: string,
  value: ProjectGraphState,
) {
  await writeJsonFile(
    getProjectFile(projectId),
    normalizeProjectGraph(projectId, value),
  );
}

export async function mutateProjectGraph(
  projectId: string,
  updater: (current: ProjectGraphState) => ProjectGraphState | Promise<ProjectGraphState>,
) {
  const current = await loadProjectGraph(projectId);
  const next = await updater(current);
  await saveProjectGraph(projectId, next);
  return next;
}

export async function loadLibrary(): Promise<LibraryState> {
  await ensureDataRoots();
  return readJsonFile(LIBRARY_FILE, {
    generations: [],
  });
}

export async function saveLibrary(value: LibraryState) {
  await writeJsonFile(LIBRARY_FILE, value);
}

export async function mutateLibrary(
  updater: (current: LibraryState) => LibraryState | Promise<LibraryState>,
) {
  const current = await loadLibrary();
  const next = await updater(current);
  await saveLibrary(next);
  return next;
}

export async function loadProviderSettings() {
  await ensureDataRoots();
  return readJsonFile<Record<string, unknown>>(PROVIDER_SETTINGS_FILE, {});
}

export async function loadProviderSettingsRecord() {
  await ensureDataRoots();

  try {
    const raw = await fs.readFile(PROVIDER_SETTINGS_FILE, "utf8");

    return {
      value: JSON.parse(raw) as Record<string, unknown>,
      hasStoredValue: true,
    };
  } catch {
    return {
      value: {} as Record<string, unknown>,
      hasStoredValue: false,
    };
  }
}

export async function saveProviderSettings(value: unknown) {
  await writeJsonFile(PROVIDER_SETTINGS_FILE, value ?? {});
}

export function getMediaFilePath(fileName: string) {
  return path.join(MEDIA_ROOT, fileName);
}

export async function writeMediaFile(params: {
  fileName: string;
  buffer: Buffer;
}) {
  await ensureDataRoots();
  await fs.writeFile(getMediaFilePath(params.fileName), params.buffer);
}

export async function readMediaFile(fileName: string) {
  return fs.readFile(getMediaFilePath(fileName));
}

export async function removeMediaFile(fileName: string) {
  try {
    await fs.unlink(getMediaFilePath(fileName));
  } catch {
    // Ignore missing files.
  }
}

export async function isMediaFileReferenced(fileName: string) {
  const normalizedFileName = fileName.trim();
  if (!normalizedFileName) {
    return false;
  }

  const library = await loadLibrary();
  for (const generation of library.generations) {
    const resultUrls = Array.isArray(generation.result_urls)
      ? generation.result_urls
      : [];
    const referenceImages = Array.isArray(generation.reference_images)
      ? generation.reference_images
      : [];

    if (
      [...resultUrls, ...referenceImages].some(
        (value) => getLocalMediaFileNameFromUrl(value) === normalizedFileName,
      )
    ) {
      return true;
    }
  }

  await ensureDataRoots();
  const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const projectId = entry.name.replace(/\.json$/i, "");
    const fallback: ProjectGraphState = {
      project: createDefaultProject(projectId),
      textNodes: [],
      imageNodes: [],
      videoNodes: [],
      operations: [],
      links: [],
    };
    const graph = normalizeProjectGraph(
      projectId,
      await readJsonFile<Partial<ProjectGraphState>>(
        path.join(PROJECTS_ROOT, entry.name),
        fallback,
      ),
    );

    if (
      getLocalMediaFileNameFromUrl(graph.project.cover_image_url) === normalizedFileName
    ) {
      return true;
    }

    if (
      graph.imageNodes.some(
        (node) => getLocalMediaFileNameFromUrl(node.image_url) === normalizedFileName,
      )
    ) {
      return true;
    }

    if (
      graph.videoNodes.some(
        (node) =>
          getLocalMediaFileNameFromUrl(node.posterUrl) === normalizedFileName ||
          getLocalMediaFileNameFromUrl(node.videoUrl) === normalizedFileName,
      )
    ) {
      return true;
    }
  }

  return false;
}
