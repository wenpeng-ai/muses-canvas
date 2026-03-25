"use client";

import "@xyflow/react/dist/style.css";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale, useMessages } from "next-intl";
import { useTheme } from "next-themes";
import {
  type Connection,
  type HandleType,
  type OnNodeDrag,
  Position,
  type Viewport,
} from "@xyflow/react";
import {
  ArrowUp,
  ImageIcon,
  Loader2,
  Link2,
  Type,
  Upload,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SessionImage } from "@/components/ui/session-image";
import { useAuthStore } from "@/store/auth-store";
import { useCanvasStore } from "@/store/canvas-store";
import { CanvasAuthGate } from "@/components/canvas/CanvasAuthGate";
import { CanvasAssetImportDialog } from "@/components/canvas/CanvasAssetImportDialog";
import { ProviderSettingsPanel } from "@/components/layout/ProviderSettingsPanel";
import {
  ComposerReferenceCard,
  type ComposerReferenceEntry,
} from "@/components/canvas/workspace/ComposerReferenceCard";
import {
  CanvasWorkspaceAccountMenu,
  CanvasWorkspaceProjectHeader,
  CanvasWorkspaceSideToolbar,
  CanvasWorkspaceZoomControls,
} from "@/components/canvas/workspace/CanvasWorkspaceChrome";
import {
  CanvasFlowSurface,
  type CanvasFlowSurfaceHandle,
} from "@/components/canvas/workspace/CanvasFlowSurface";
import {
  CanvasComposerImageControls,
  CanvasComposerTextControls,
  CanvasComposerVideoControls,
} from "@/components/canvas/workspace/CanvasComposerMediaControls";
import {
  CANVAS_NODE_DRAG_MIME,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  clamp,
  createId,
  formatCanvasNodeLabel,
  getCanvasLinkRelationForKinds,
  getConnectionTargetHighlightShellClassName,
  getFlowNodeId,
  getTextNodeSummary,
  normalizeNodeIdList,
  parseFlowNodeId,
  type CanvasConnectionTargetHighlight,
  type CanvasConnectionTargetSide,
  type CanvasFlowNode,
  type GraphPayload,
} from "@/components/canvas/workspace/shared";
import {
  createCanvasProject,
  deleteCanvasGraphNodes,
  deleteCanvasProject,
  deleteGenerationAsset,
  fetchCanvasGraph,
  listCanvasProjects,
  patchCanvasGraph,
  replaceCanvasNodeImage,
  replaceCanvasNodeVideo,
  updateCanvasProject,
} from "@/lib/canvas/api";
import { formatCopy, getCanvasPageCopy } from "@/lib/canvas/copy";
import {
  getImageDimensionsFromFile,
  getImageDimensionsFromUrl,
} from "@/lib/canvas/client-image-dimensions";
import type { AppMessages } from "@/i18n/messages";
import {
  patchGenerateHistoryCache,
  patchGenerationListCache,
} from "@/lib/generation-cache";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type AppLocale,
} from "@/lib/locale-config";
import { isDirectHttpUrl } from "@/lib/media/media-url";
import {
  DEFAULT_PROVIDER_SETTINGS,
  EMPTY_PROVIDER_SETTINGS,
  getConfiguredProviderModelOptions,
  getEffectiveDefaultProviderModelValue,
  getProviderDefinition,
  getProviderPlatformDisplayName,
  isProviderPlatformConfigured,
  normalizeEditableProviderSettings,
  normalizeProviderModelValue,
  providerSupportsInlineVideoImageInput,
  resolveProviderModelSelection,
  type ProviderModelKind,
  type ProviderSettings,
} from "@/lib/provider-settings";
import { VIDEO_IMAGE_INPUT_URL_REQUIRED_ERROR } from "@/lib/provider-runtime-errors";
import {
  DEFAULT_IMAGE_NODE_HEIGHT,
  DEFAULT_IMAGE_NODE_WIDTH,
  DEFAULT_TEXT_NODE_HEIGHT,
  DEFAULT_TEXT_NODE_TITLE,
  DEFAULT_TEXT_NODE_WIDTH,
  DEFAULT_VIDEO_NODE_HEIGHT,
  DEFAULT_VIDEO_NODE_WIDTH,
  buildDefaultImageNode,
  buildDefaultTextNode,
  buildDefaultVideoNode,
  deriveTextNodeTitle,
  getCompactCanvasImageDimensions,
  getNodePlacementForConnection,
  shouldAutoUpdateTextNodeTitle,
} from "@/lib/canvas/workspace/nodes";
import {
  EMPTY_PROJECT_HISTORY_ITEMS,
  formatRelativeTimestamp,
  getProjectSummaryForGraph,
  sortProjectSummaries,
  type ProjectSwitcherItem,
} from "@/lib/canvas/workspace/projects";
import {
  runImageProviderRequest,
  runTextProviderRequest,
  runVideoProviderRequest,
} from "@/lib/provider/api";
import {
  loadLocalProviderSettings,
  saveLocalProviderSettings,
} from "@/lib/provider/local-settings";
import type {
  CanvasImageNode,
  CanvasLink,
  CanvasNodeKind,
  CanvasProjectSummary,
  CanvasTextNode,
  CanvasVideoNode,
} from "@/lib/supabase/types";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ComposerFocusTarget = {
  nodeId: string;
  field: "text-title" | "text-content" | "image-prompt" | "video-prompt";
} | null;

const CANVAS_ZOOM_RELAY_SELECTOR = "[data-canvas-zoom-relay]";

type SafariGestureEvent = Event & {
  clientX?: number;
  clientY?: number;
  scale?: number;
};

function getNextFallbackImageProgress(progress: number) {
  if (progress < 12) {
    return progress + 6;
  }

  if (progress < 24) {
    return progress + 5;
  }

  if (progress < 40) {
    return progress + 4;
  }

  if (progress < 58) {
    return progress + 3;
  }

  if (progress < 74) {
    return progress + 2;
  }

  if (progress < 86) {
    return progress + 1;
  }

  return progress;
}

function normalizeWheelDelta(event: WheelEvent) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * window.innerHeight;
  }

  return event.deltaY;
}

function getNextCanvasZoom(currentZoom: number, wheelDelta: number) {
  return clamp(
    currentZoom * Math.pow(1.2, -wheelDelta / 100),
    MIN_CANVAS_ZOOM,
    MAX_CANVAS_ZOOM,
  );
}

function getCanvasZoomRelayTarget(
  event: Event,
  workspaceRoot: HTMLElement | null,
) {
  if (event.target instanceof Element) {
    const relayTarget = event.target.closest(CANVAS_ZOOM_RELAY_SELECTOR);
    if (
      relayTarget &&
      (!workspaceRoot || workspaceRoot.contains(relayTarget))
    ) {
      return relayTarget;
    }
  }

  const gestureEvent = event as SafariGestureEvent;
  const pointTarget =
    typeof document !== "undefined" &&
    typeof gestureEvent.clientX === "number" &&
    typeof gestureEvent.clientY === "number"
      ? document.elementFromPoint(gestureEvent.clientX, gestureEvent.clientY)
      : null;

  const relayTarget = pointTarget?.closest(CANVAS_ZOOM_RELAY_SELECTOR) ?? null;
  if (
    relayTarget &&
    (!workspaceRoot || workspaceRoot.contains(relayTarget))
  ) {
    return relayTarget;
  }

  return null;
}

type ActiveCanvasNode =
  | { kind: "text"; node: CanvasTextNode }
  | { kind: "image"; node: CanvasImageNode }
  | { kind: "video"; node: CanvasVideoNode }
  | null;

type NodeUploadTarget = {
  kind: "image" | "video";
  nodeId: string;
} | null;

type PendingNodeMenuState = {
  flowPosition: { x: number; y: number };
  sourceFlowId: string | null;
  sourceFlowPosition: { x: number; y: number } | null;
  sourceHandlePosition: Position | null;
  sourceHandleType: HandleType | null;
  compatibleKinds: CanvasNodeKind[];
};

const VIEWPORT_EPSILON = 0.0005;

function areViewportsEqual(left: Viewport, right: Viewport) {
  return (
    Math.abs(left.x - right.x) < VIEWPORT_EPSILON &&
    Math.abs(left.y - right.y) < VIEWPORT_EPSILON &&
    Math.abs(left.zoom - right.zoom) < VIEWPORT_EPSILON
  );
}

const EMPTY_DATABASE_TARGETS: Array<{
  generationId: string;
  imageIndex: number;
}> = [];
const EMPTY_SELECTION: string[] = [];
const COMPOSER_MAX_WIDTH = 520;
const COMPOSER_TEXTAREA_CLASS =
  "min-h-[82px] resize-none border-0 bg-transparent px-1 py-0.5 text-[14px] leading-6 shadow-none outline-none focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none dark:text-white/92 dark:placeholder:text-white/38";

function getNodeCreationOptions(copy: ReturnType<typeof getCanvasPageCopy>) {
  return [
    {
      kind: "text" as const,
      label: copy.nodeTextLabel,
      description: copy.nodeTextDescription,
      icon: Type,
    },
    {
      kind: "image" as const,
      label: copy.nodeImageLabel,
      description: copy.nodeImageDescription,
      icon: ImageIcon,
    },
    {
      kind: "video" as const,
      label: copy.nodeVideoLabel,
      description: copy.nodeVideoDescription,
      icon: Video,
    },
  ] satisfies Array<{
    kind: CanvasNodeKind;
    label: string;
    description: string;
    icon: LucideIcon;
  }>;
}

export function CanvasWorkspacePage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const locale = useLocale();
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const nodeCreationOptions = getNodeCreationOptions(copy);
  const { addToast } = useToast();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { resolvedTheme, setTheme } = useTheme();
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const importDialogOpen = useCanvasStore((state) => state.importDialogOpen);
  const croppingImageNodeId = useCanvasStore(
    (state) => state.croppingImageNodeId,
  );
  const setImportDialogOpen = useCanvasStore(
    (state) => state.setImportDialogOpen,
  );
  const setSelectedImageNodeIds = useCanvasStore(
    (state) => state.setSelectedImageNodeIds,
  );

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const workspaceRootRef = useRef<HTMLDivElement>(null);
  const imageNodeUploadInputRef = useRef<HTMLInputElement>(null);
  const videoNodeUploadInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const flowSurfaceRef = useRef<CanvasFlowSurfaceHandle | null>(null);
  const createNodeMenuRef = useRef<HTMLDivElement>(null);
  const viewportSaveTimeoutRef = useRef<number | null>(null);
  const graphSaveTimeoutRef = useRef<number | null>(null);
  const gestureZoomRef = useRef<{
    clientPoint: { x: number; y: number };
    startZoom: number;
  } | null>(null);
  const skipProjectTitleCommitRef = useRef(false);
  const skipNextGraphPersistRef = useRef(true);
  const skipNextSelectionEnsureVisibleRef = useRef(false);

  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [projectSummaries, setProjectSummaries] = useState<
    CanvasProjectSummary[]
  >([]);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [savingProjectTitle, setSavingProjectTitle] = useState(false);
  const [loadingProjectSummaries, setLoadingProjectSummaries] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [graphError, setGraphError] = useState(false);
  const [uploadingNodeMedia, setUploadingNodeMedia] = useState(false);
  const [primaryToolMode, setPrimaryToolMode] = useState<"select" | "hand">(
    "select",
  );
  const [primaryMenuOpen, setPrimaryMenuOpen] = useState(false);
  const [viewportState, setViewportState] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const [floatingViewportSize, setFloatingViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [selectedFlowNodeIds, setSelectedFlowNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [activeConnectionTargetHighlight, setActiveConnectionTargetHighlight] =
    useState<CanvasConnectionTargetHighlight | null>(null);
  const [pendingNodeMenu, setPendingNodeMenu] =
    useState<PendingNodeMenuState | null>(null);
  const [composerFocusTarget, setComposerFocusTarget] =
    useState<ComposerFocusTarget>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    nodeIds: string[];
    databaseTargets: Array<{
      generationId: string;
      imageIndex: number;
    }>;
  }>({
    open: false,
    nodeIds: [],
    databaseTargets: EMPTY_DATABASE_TARGETS,
  });
  const [deleteFromDatabase, setDeleteFromDatabase] = useState(true);
  const [deletingCanvasNodes, setDeletingCanvasNodes] = useState(false);
  const [nodeUploadDialogOpen, setNodeUploadDialogOpen] = useState(false);
  const [nodeUploadTarget, setNodeUploadTarget] =
    useState<NodeUploadTarget>(null);
  const [nodeUploadUrlDraft, setNodeUploadUrlDraft] = useState("");
  const [submittingNodeUploadUrl, setSubmittingNodeUploadUrl] = useState(false);
  const [videoInputRequirementDialog, setVideoInputRequirementDialog] =
    useState<{
      open: boolean;
      providerLabel: string;
    }>({
      open: false,
      providerLabel: "",
    });
  const [textComposerDrafts, setTextComposerDrafts] = useState<
    Record<string, string>
  >({});
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(
    EMPTY_PROVIDER_SETTINGS,
  );
  const [providerSettingsLoading, setProviderSettingsLoading] = useState(true);
  const [providerSettingsResetToken, setProviderSettingsResetToken] = useState(0);
  const [providerSettingsOpenAddDialogToken, setProviderSettingsOpenAddDialogToken] =
    useState(0);
  const [providerSettingsOpenAddDialogKind, setProviderSettingsOpenAddDialogKind] =
    useState<ProviderModelKind>("text");
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
  const [runningImageProgress, setRunningImageProgress] = useState<number | null>(
    null,
  );
  const [runningVideoProgress, setRunningVideoProgress] = useState<number | null>(
    null,
  );
  const [composerPanelElement, setComposerPanelElement] =
    useState<HTMLDivElement | null>(null);
  const providerSettingsHydratedRef = useRef(false);
  const persistedProviderSettingsKeyRef = useRef("");
  const providerSettingsSavingRef = useRef(false);
  const pendingProviderSettingsRef = useRef<ProviderSettings | null>(null);

  const startFallbackProgress = useCallback(
    (setProgress: typeof setRunningImageProgress) => {
      let fallbackProgressIntervalId: number | null = null;
      let fallbackProgressDelayId: number | null = window.setTimeout(() => {
        setProgress((current) => current ?? 6);
        fallbackProgressIntervalId = window.setInterval(() => {
          setProgress((current) => {
            const baseProgress = current ?? 6;
            const nextProgress = getNextFallbackImageProgress(baseProgress);
            return nextProgress === baseProgress ? baseProgress : nextProgress;
          });
        }, 420);
      }, 900);

      return () => {
        if (fallbackProgressDelayId !== null) {
          window.clearTimeout(fallbackProgressDelayId);
          fallbackProgressDelayId = null;
        }

        if (fallbackProgressIntervalId !== null) {
          window.clearInterval(fallbackProgressIntervalId);
          fallbackProgressIntervalId = null;
        }
      };
    },
    [],
  );

  const openAddModelDialogFromComposer = useCallback((kind: ProviderModelKind) => {
    setProviderSettingsOpenAddDialogKind(kind);
    setProviderSettingsResetToken((current) => current + 1);
    setProviderSettingsOpenAddDialogToken((current) => current + 1);
  }, []);

  const defaultTextNodeModel = useMemo(
    () =>
      getEffectiveDefaultProviderModelValue("text", providerSettings, {
        configuredOnly: true,
      }),
    [providerSettings],
  );

  const defaultImageNodeModel = useMemo(
    () =>
      getEffectiveDefaultProviderModelValue("image", providerSettings, {
        configuredOnly: true,
      }),
    [providerSettings],
  );

  const defaultVideoNodeModel = useMemo(
    () =>
      getEffectiveDefaultProviderModelValue("video", providerSettings, {
        configuredOnly: true,
      }),
    [providerSettings],
  );

  const textTitleInputRef = useRef<HTMLInputElement>(null);
  const textContentInputRef = useRef<HTMLTextAreaElement>(null);
  const imagePromptInputRef = useRef<HTMLTextAreaElement>(null);
  const videoPromptInputRef = useRef<HTMLTextAreaElement>(null);

  const graphPersistKey = useMemo(
    () =>
      graph
        ? JSON.stringify({
            textNodes: graph.textNodes,
            imageNodes: graph.imageNodes,
            videoNodes: graph.videoNodes,
            links: graph.links,
          })
        : "",
    [graph],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const storedSettings = await loadLocalProviderSettings();
      if (cancelled) {
        return;
      }

      persistedProviderSettingsKeyRef.current = JSON.stringify(
        normalizeEditableProviderSettings(storedSettings),
      );
      setProviderSettings(storedSettings);
      providerSettingsHydratedRef.current = true;
      setProviderSettingsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!providerSettingsHydratedRef.current) {
      return;
    }

    const normalized = normalizeEditableProviderSettings(providerSettings);
    const serializedSettings = JSON.stringify(normalized);

    if (serializedSettings === persistedProviderSettingsKeyRef.current) {
      return;
    }

    pendingProviderSettingsRef.current = normalized;

    const flushPendingProviderSettings = async () => {
      if (providerSettingsSavingRef.current) {
        return;
      }

      providerSettingsSavingRef.current = true;

      try {
        while (pendingProviderSettingsRef.current) {
          const nextSettings = pendingProviderSettingsRef.current;
          pendingProviderSettingsRef.current = null;
          const saved = await saveLocalProviderSettings(nextSettings);

          if (saved) {
            persistedProviderSettingsKeyRef.current = JSON.stringify(nextSettings);
          }
        }
      } finally {
        providerSettingsSavingRef.current = false;
      }
    };

    void flushPendingProviderSettings();
  }, [providerSettings]);

  useEffect(() => {
    if (!graph) {
      setTextComposerDrafts((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
      return;
    }

    const validTextNodeIds = new Set(graph.textNodes.map((node) => node.id));
    setTextComposerDrafts((current) => {
      const nextEntries = Object.entries(current).filter(([id]) =>
        validTextNodeIds.has(id),
      );

      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [graph]);

  const imageLabelMap = useMemo(() => {
    if (!graph) {
      return new Map<string, string>();
    }

    return new Map(
      [...graph.imageNodes]
        .sort((left, right) => {
          const createdAtDiff =
            new Date(left.created_at).getTime() -
            new Date(right.created_at).getTime();

          if (createdAtDiff !== 0) {
            return createdAtDiff;
          }

          return left.id.localeCompare(right.id);
        })
        .map((node, index) => [
          node.id,
          formatCanvasNodeLabel(index + 1, copy.imageNodeIndexLabel),
        ]),
    );
  }, [copy.imageNodeIndexLabel, graph]);

  const scheduleComposerFocus = useCallback((target: ComposerFocusTarget) => {
    setComposerFocusTarget(target);
  }, []);

  const syncCanvasSelection = useCallback(
    ({
      nodeIds = EMPTY_SELECTION,
      edgeIds = EMPTY_SELECTION,
    }: {
      nodeIds?: string[];
      edgeIds?: string[];
    }) => {
      const nextNodeIds = normalizeNodeIdList(nodeIds);
      const nextEdgeIds = normalizeNodeIdList(edgeIds);
      const nextImageIds = normalizeNodeIdList(
        nextNodeIds
          .map((id) => parseFlowNodeId(id))
          .filter(
            (value): value is { kind: CanvasNodeKind; id: string } =>
              !!value && value.kind === "image",
          )
          .map((value) => value.id),
      );

      setSelectedFlowNodeIds((current) =>
        areListsEqual(current, nextNodeIds) ? current : nextNodeIds,
      );
      setSelectedEdgeIds((current) =>
        areListsEqual(current, nextEdgeIds) ? current : nextEdgeIds,
      );
      setSelectedImageNodeIds(nextImageIds);
    },
    [setSelectedImageNodeIds],
  );

  const applyCanvasSelection = useCallback(
    ({
      nodeIds = EMPTY_SELECTION,
      edgeIds = EMPTY_SELECTION,
    }: {
      nodeIds?: string[];
      edgeIds?: string[];
    }) => {
      syncCanvasSelection({ nodeIds, edgeIds });
    },
    [syncCanvasSelection],
  );

  const getViewportCenterPosition = useCallback(
    () =>
      flowSurfaceRef.current?.getViewportCenterPosition() ?? { x: 120, y: 120 },
    [],
  );

  const ensureNodeVisible = useCallback((flowNodeId: string) => {
    flowSurfaceRef.current?.ensureNodeVisible(flowNodeId);
  }, []);

  const handleViewportChange = useCallback((nextViewport: Viewport) => {
    setViewportState((current) =>
      areViewportsEqual(current, nextViewport) ? current : nextViewport,
    );
  }, []);

  const focusNodeComposer = useCallback(
    (kind: CanvasNodeKind, nodeId: string) => {
      scheduleComposerFocus({
        nodeId,
        field:
          kind === "text"
            ? "text-content"
            : kind === "image"
              ? "image-prompt"
              : "video-prompt",
      });
    },
    [scheduleComposerFocus],
  );

  const getCompatibleNodeKinds = useCallback(
    (sourceFlowId: string | null, sourceHandleType: HandleType | null) => {
      if (!sourceFlowId || !sourceHandleType) {
        return nodeCreationOptions.map((option) => option.kind);
      }

      const parsed = parseFlowNodeId(sourceFlowId);
      if (!parsed) {
        return nodeCreationOptions.map((option) => option.kind);
      }

      return nodeCreationOptions.filter((option) => {
        const relationType =
          sourceHandleType === "target"
            ? getCanvasLinkRelationForKinds(option.kind, parsed.kind)
            : getCanvasLinkRelationForKinds(parsed.kind, option.kind);
        return relationType !== null;
      }).map((option) => option.kind);
    },
    [nodeCreationOptions],
  );

  const openNodeCreationMenu = useCallback(
    ({
      position,
      sourceFlowId = null,
      sourceFlowPosition = null,
      sourceHandlePosition = null,
      sourceHandleType = null,
    }: {
      position: { x: number; y: number };
      sourceFlowId?: string | null;
      sourceFlowPosition?: { x: number; y: number } | null;
      sourceHandlePosition?: Position | null;
      sourceHandleType?: HandleType | null;
    }) => {
      const compatibleKinds = getCompatibleNodeKinds(
        sourceFlowId,
        sourceHandleType,
      );

      if (compatibleKinds.length === 0) {
        setPendingNodeMenu(null);
        return;
      }

      setPendingNodeMenu({
        flowPosition: position,
        sourceFlowId,
        sourceFlowPosition,
        sourceHandlePosition,
        sourceHandleType,
        compatibleKinds,
      });
    },
    [getCompatibleNodeKinds],
  );

  const pendingNodeMenuOptions = useMemo(() => {
    if (!pendingNodeMenu) {
      return [];
    }

    return nodeCreationOptions.filter((option) =>
      pendingNodeMenu.compatibleKinds.includes(option.kind),
    );
  }, [nodeCreationOptions, pendingNodeMenu]);

  const pendingNodeMenuPosition = useMemo(() => {
    if (!pendingNodeMenu) {
      return null;
    }

    const rawLeft =
      viewportState.x + pendingNodeMenu.flowPosition.x * viewportState.zoom;
    const rawTop =
      viewportState.y + pendingNodeMenu.flowPosition.y * viewportState.zoom;
    const menuWidth = 248;
    const menuHeight = pendingNodeMenuOptions.length * 64 + 20;
    const viewportWidth =
      floatingViewportSize.width ||
      (typeof window === "undefined" ? 1280 : window.innerWidth);
    const viewportHeight =
      floatingViewportSize.height ||
      (typeof window === "undefined" ? 720 : window.innerHeight);

    return {
      left: clamp(
        rawLeft + 12,
        16,
        Math.max(16, viewportWidth - menuWidth - 16),
      ),
      top: clamp(
        rawTop + 12,
        16,
        Math.max(16, viewportHeight - menuHeight - 16),
      ),
    };
  }, [
    floatingViewportSize,
    pendingNodeMenu,
    pendingNodeMenuOptions.length,
    viewportState,
  ]);

  const pendingConnectionPreview = useMemo(() => {
    if (
      !pendingNodeMenu?.sourceFlowId ||
      !pendingNodeMenu.sourceFlowPosition ||
      !pendingNodeMenu.sourceHandlePosition
    ) {
      return null;
    }

    return {
      sourceFlowPosition: pendingNodeMenu.sourceFlowPosition,
      sourceHandlePosition: pendingNodeMenu.sourceHandlePosition,
      targetFlowPosition: pendingNodeMenu.flowPosition,
    };
  }, [pendingNodeMenu]);

  const loadGraph = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      if (!user) {
        setGraph(null);
        setLoadingGraph(false);
        return;
      }

      if (!background) {
        setLoadingGraph(true);
      }

      setGraphError(false);

      try {
        const payload = await fetchCanvasGraph(projectId);

        skipNextGraphPersistRef.current = true;
        setGraph(payload);
        setViewportState(
          (payload.project.viewport_json as Viewport | undefined) ?? {
            x: 0,
            y: 0,
            zoom: 1,
          },
        );
      } catch (error) {
        console.error("Failed to load canvas graph:", error);
        setGraphError(true);
      } finally {
        setLoadingGraph(false);
      }
    },
    [projectId, user],
  );

  const loadProjects = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!user) {
        setProjectSummaries([]);
        setLoadingProjectSummaries(false);
        return;
      }

      if (!silent) {
        setLoadingProjectSummaries(true);
      }

      try {
        const projects = await listCanvasProjects();
        setProjectSummaries(sortProjectSummaries(projects));
      } catch (error) {
        console.error("Failed to load canvas projects:", error);
        addToast(copy.loadProjectsFailed, "error");
      } finally {
        setLoadingProjectSummaries(false);
      }
    },
    [addToast, copy.loadProjectsFailed, user],
  );

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!graph || isEditingProjectTitle) {
      return;
    }

    setProjectTitleDraft(graph.project.title?.trim() || copy.untitled);
  }, [copy.untitled, graph, isEditingProjectTitle]);

  useEffect(() => {
    if (!graph) {
      return;
    }

    const nextSummary = getProjectSummaryForGraph(
      graph.project,
      graph.imageNodes.length,
    );
    setProjectSummaries((current) => {
      const existingIndex = current.findIndex(
        (item) => item.id === nextSummary.id,
      );
      if (existingIndex === -1) {
        return sortProjectSummaries([...current, nextSummary]);
      }

      const next = [...current];
      next[existingIndex] = nextSummary;
      return sortProjectSummaries(next);
    });
  }, [graph]);

  useEffect(() => {
    if (!isEditingProjectTitle) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const input = titleInputRef.current;
      if (!input) {
        return;
      }

      input.focus();
      const cursor = input.value.length;
      input.setSelectionRange(cursor, cursor);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isEditingProjectTitle]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-account-menu-keep-open]")) {
        return;
      }

      if (!accountMenuRef.current?.contains(target as Node | null)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!pendingNodeMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!createNodeMenuRef.current?.contains(event.target as Node)) {
        setPendingNodeMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingNodeMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingNodeMenu]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }

      const normalizedKey = event.key.toLowerCase();
      if (normalizedKey === "v") {
        event.preventDefault();
        setPrimaryToolMode("select");
        setPrimaryMenuOpen(false);
        return;
      }

      if (normalizedKey === "h") {
        event.preventDefault();
        setPrimaryToolMode("hand");
        setPrimaryMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!graph || !graphPersistKey) {
      return;
    }

    if (skipNextGraphPersistRef.current) {
      skipNextGraphPersistRef.current = false;
      return;
    }

    if (graphSaveTimeoutRef.current !== null) {
      window.clearTimeout(graphSaveTimeoutRef.current);
    }

    graphSaveTimeoutRef.current = window.setTimeout(() => {
      void patchCanvasGraph(projectId, {
        textNodes: graph.textNodes,
        imageNodes: graph.imageNodes,
        videoNodes: graph.videoNodes,
        links: graph.links,
      }).catch((error) => {
        console.error("Failed to persist canvas graph:", error);
      });
    }, 280);

    return () => {
      if (graphSaveTimeoutRef.current !== null) {
        window.clearTimeout(graphSaveTimeoutRef.current);
        graphSaveTimeoutRef.current = null;
      }
    };
  }, [graph, graphPersistKey, projectId]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (
        event.defaultPrevented ||
        !getCanvasZoomRelayTarget(event, workspaceRootRef.current)
      ) {
        return;
      }

      const normalizedDelta = normalizeWheelDelta(event);
      if (!Number.isFinite(normalizedDelta) || normalizedDelta === 0) {
        return;
      }

      event.preventDefault();
      flowSurfaceRef.current?.zoomAtClientPoint(
        {
          x: event.clientX,
          y: event.clientY,
        },
        getNextCanvasZoom(viewportState.zoom, normalizedDelta),
      );
    };

    const handleGestureStart = (event: Event) => {
      if (
        event.defaultPrevented ||
        !getCanvasZoomRelayTarget(event, workspaceRootRef.current)
      ) {
        gestureZoomRef.current = null;
        return;
      }

      const gestureEvent = event as SafariGestureEvent;
      const clientPoint = {
        x:
          typeof gestureEvent.clientX === "number"
            ? gestureEvent.clientX
            : window.innerWidth / 2,
        y:
          typeof gestureEvent.clientY === "number"
            ? gestureEvent.clientY
            : window.innerHeight / 2,
      };

      gestureZoomRef.current = {
        clientPoint,
        startZoom: viewportState.zoom,
      };
      event.preventDefault();
    };

    const handleGestureChange = (event: Event) => {
      const gestureState = gestureZoomRef.current;
      if (!gestureState) {
        return;
      }

      const gestureEvent = event as SafariGestureEvent;
      const scale =
        typeof gestureEvent.scale === "number" && Number.isFinite(gestureEvent.scale)
          ? gestureEvent.scale
          : 1;

      event.preventDefault();
      flowSurfaceRef.current?.zoomAtClientPoint(
        gestureState.clientPoint,
        clamp(
          gestureState.startZoom * scale,
          MIN_CANVAS_ZOOM,
          MAX_CANVAS_ZOOM,
        ),
      );
    };

    const handleGestureEnd = () => {
      gestureZoomRef.current = null;
    };

    document.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });
    document.addEventListener("gesturestart", handleGestureStart, {
      capture: true,
      passive: false,
    });
    document.addEventListener("gesturechange", handleGestureChange, {
      capture: true,
      passive: false,
    });
    document.addEventListener("gestureend", handleGestureEnd, {
      capture: true,
    });

    return () => {
      document.removeEventListener("wheel", handleWheel, true);
      document.removeEventListener("gesturestart", handleGestureStart, true);
      document.removeEventListener("gesturechange", handleGestureChange, true);
      document.removeEventListener("gestureend", handleGestureEnd, true);
      gestureZoomRef.current = null;
    };
  }, [viewportState.zoom]);

  useEffect(() => {
    return () => {
      if (viewportSaveTimeoutRef.current !== null) {
        window.clearTimeout(viewportSaveTimeoutRef.current);
      }
      if (graphSaveTimeoutRef.current !== null) {
        window.clearTimeout(graphSaveTimeoutRef.current);
      }
    };
  }, []);

  const updateGraph = useCallback(
    (updater: (current: GraphPayload) => GraphPayload) => {
      setGraph((current) => {
        if (!current) {
          return current;
        }

        return updater(current);
      });
    },
    [],
  );

  const updateTextNode = useCallback(
    (nodeId: string, patch: Partial<CanvasTextNode>) => {
      updateGraph((current) => ({
        ...current,
        textNodes: current.textNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                ...patch,
                updated_at: new Date().toISOString(),
              }
            : node,
        ),
      }));
    },
    [updateGraph],
  );

  const updateImageNode = useCallback(
    (nodeId: string, patch: Partial<CanvasImageNode>) => {
      updateGraph((current) => ({
        ...current,
        imageNodes: current.imageNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                ...patch,
                updated_at: new Date().toISOString(),
              }
            : node,
        ),
      }));
    },
    [updateGraph],
  );

  const updateVideoNode = useCallback(
    (nodeId: string, patch: Partial<CanvasVideoNode>) => {
      updateGraph((current) => ({
        ...current,
        videoNodes: current.videoNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                ...patch,
                updated_at: new Date().toISOString(),
              }
            : node,
        ),
      }));
    },
    [updateGraph],
  );

  const handleFlowSelectionChange = useCallback(
    ({
      nodeIds = EMPTY_SELECTION,
      edgeIds = EMPTY_SELECTION,
    }: {
      nodeIds?: string[];
      edgeIds?: string[];
    }) => {
      syncCanvasSelection({ nodeIds, edgeIds });
    },
    [syncCanvasSelection],
  );

  const handleTextNodeResize = useCallback(
    (nodeId: string, width: number, height: number) => {
      updateTextNode(nodeId, { width, height });
    },
    [updateTextNode],
  );

  const handleImageNodeResize = useCallback(
    (nodeId: string, width: number, height: number) => {
      updateImageNode(nodeId, { width, height });
    },
    [updateImageNode],
  );

  const handleVideoNodeResize = useCallback(
    (nodeId: string, width: number, height: number) => {
      updateVideoNode(nodeId, { width, height });
    },
    [updateVideoNode],
  );

  const duplicateTextNode = useCallback(
    (nodeId: string) => {
      if (!graph) {
        return;
      }

      let nextNodeId = "";
      updateGraph((current) => {
        const sourceNode = current.textNodes.find((node) => node.id === nodeId);
        if (!sourceNode) {
          return current;
        }

        nextNodeId = createId("text");
        const now = new Date().toISOString();
        return {
          ...current,
          textNodes: [
            ...current.textNodes,
            {
              ...sourceNode,
              id: nextNodeId,
              x: sourceNode.x + 132,
              y: sourceNode.y + 24,
              width: DEFAULT_TEXT_NODE_WIDTH,
              height: DEFAULT_TEXT_NODE_HEIGHT,
              created_at: now,
              updated_at: now,
            },
          ],
        };
      });

      if (!nextNodeId) {
        return;
      }

      const flowNodeId = getFlowNodeId("text", nextNodeId);
      applyCanvasSelection({ nodeIds: [flowNodeId] });
      window.requestAnimationFrame(() => ensureNodeVisible(flowNodeId));
    },
    [applyCanvasSelection, ensureNodeVisible, graph, updateGraph],
  );

  const focusTextComposer = useCallback(
    (nodeId: string) => {
      scheduleComposerFocus({
        nodeId,
        field: "text-content",
      });
    },
    [scheduleComposerFocus],
  );

  const addNodeToGraph = useCallback(
    (
      kind: CanvasNodeKind,
      options?: {
        position?: { x: number; y: number };
        afterCreate?: (nodeId: string) => void;
      },
    ) => {
      if (!graph) {
        return null;
      }

      const position = options?.position ?? getViewportCenterPosition();
      let nextNodeId = "";
      updateGraph((current) => {
        if (kind === "text") {
          const nextNode = buildDefaultTextNode(
            current.project.id,
            position,
            defaultTextNodeModel,
          );
          nextNodeId = nextNode.id;
          return {
            ...current,
            textNodes: [...current.textNodes, nextNode],
          };
        }

        if (kind === "image") {
          const nextNode = buildDefaultImageNode(
            current.project.id,
            position,
            defaultImageNodeModel,
          );
          nextNodeId = nextNode.id;
          return {
            ...current,
            imageNodes: [...current.imageNodes, nextNode],
          };
        }

        const nextNode = buildDefaultVideoNode(
          current.project.id,
          position,
          defaultVideoNodeModel,
        );
        nextNodeId = nextNode.id;
        return {
          ...current,
          videoNodes: [...current.videoNodes, nextNode],
        };
      });

      if (!nextNodeId) {
        return null;
      }

      const flowId = getFlowNodeId(kind, nextNodeId);
      applyCanvasSelection({ nodeIds: [flowId] });
      window.requestAnimationFrame(() => ensureNodeVisible(flowId));
      options?.afterCreate?.(nextNodeId);

      return nextNodeId;
    },
    [
      applyCanvasSelection,
      ensureNodeVisible,
      getViewportCenterPosition,
      graph,
      defaultImageNodeModel,
      defaultTextNodeModel,
      defaultVideoNodeModel,
      updateGraph,
    ],
  );

  const insertNodeFromSource = useCallback(
    (
      sourceKind: CanvasNodeKind,
      sourceId: string,
      option: {
        kind: CanvasNodeKind;
        relationType: Extract<
          CanvasLink["relation_type"],
          "prompt" | "reference" | "primary"
        >;
      },
    ) => {
      if (!graph) {
        return;
      }

      const sourceNode =
        sourceKind === "text"
          ? graph.textNodes.find((node) => node.id === sourceId)
          : sourceKind === "image"
            ? graph.imageNodes.find((node) => node.id === sourceId)
            : graph.videoNodes.find((node) => node.id === sourceId);

      if (!sourceNode) {
        return;
      }

      const nextWidth =
        option.kind === "text"
          ? DEFAULT_TEXT_NODE_WIDTH
          : option.kind === "image"
            ? DEFAULT_IMAGE_NODE_WIDTH
            : DEFAULT_VIDEO_NODE_WIDTH;
      const nextHeight =
        option.kind === "text"
          ? DEFAULT_TEXT_NODE_HEIGHT
          : option.kind === "image"
            ? DEFAULT_IMAGE_NODE_HEIGHT
            : DEFAULT_VIDEO_NODE_HEIGHT;
      const position = {
        x: sourceNode.x + sourceNode.width + 120,
        y: sourceNode.y + sourceNode.height / 2 - nextHeight / 2,
      };

      const nextNodeId = addNodeToGraph(option.kind, { position });
      if (!nextNodeId) {
        return;
      }

      updateGraph((current) => {
        const nextLink: CanvasLink = {
          id: createId("link"),
          project_id: current.project.id,
          source_kind: sourceKind,
          source_id: sourceId,
          target_kind: option.kind,
          target_id: nextNodeId,
          relation_type: option.relationType,
          sort_order: current.links.filter(
            (link) =>
              link.target_kind === option.kind &&
              link.target_id === nextNodeId &&
              link.relation_type === option.relationType,
          ).length,
          created_at: new Date().toISOString(),
        };

        return {
          ...current,
          links: [...current.links, nextLink],
        };
      });

      if (option.relationType === "prompt") {
        scheduleComposerFocus({
          nodeId: nextNodeId,
          field: option.kind === "image" ? "image-prompt" : "video-prompt",
        });
      } else if (option.kind === "video") {
        scheduleComposerFocus({
          nodeId: nextNodeId,
          field: "video-prompt",
        });
      }
    },
    [addNodeToGraph, graph, scheduleComposerFocus, updateGraph],
  );

  const connectNodes = useCallback(
    ({
      sourceFlowId,
      targetFlowId,
      focusPromptIfNeeded = true,
      selectedFlowId,
      updateSelectionAfterConnect = true,
    }: {
      sourceFlowId: string;
      targetFlowId: string;
      focusPromptIfNeeded?: boolean;
      selectedFlowId?: string;
      updateSelectionAfterConnect?: boolean;
    }) => {
      if (!graph) {
        return;
      }

      const currentGraph = graph;
      const source = resolveCanvasNodeReference(currentGraph, sourceFlowId);
      const target = resolveCanvasNodeReference(currentGraph, targetFlowId);

      if (!source || !target || source.id === target.id) {
        return;
      }

      const relationType = getCanvasLinkRelationForKinds(
        source.kind,
        target.kind,
      );
      if (!relationType) {
        return;
      }

      const hasDuplicate = currentGraph.links.some(
        (link) =>
          link.source_kind === source.kind &&
          link.source_id === source.id &&
          link.target_kind === target.kind &&
          link.target_id === target.id &&
          link.relation_type === relationType,
      );

      if (hasDuplicate) {
        return;
      }

      const targetNode =
        target.kind === "text"
          ? currentGraph.textNodes.find((node) => node.id === target.id)
          : target.kind === "image"
            ? currentGraph.imageNodes.find((node) => node.id === target.id)
            : currentGraph.videoNodes.find((node) => node.id === target.id);

      const shouldFocusPrompt =
        relationType === "prompt"
          ? !!targetNode &&
            "prompt" in targetNode &&
            typeof targetNode.prompt === "string" &&
            targetNode.prompt.trim().length === 0
          : relationType === "primary"
            ? currentGraph.links.filter(
                (link) =>
                  link.target_kind === target.kind &&
                  link.target_id === target.id &&
                  link.relation_type === "primary",
              ).length === 0
            : false;

      updateGraph((current) => ({
        ...current,
        links: [
          ...current.links,
          {
            id: createId("link"),
            project_id: current.project.id,
            source_kind: source.kind,
            source_id: source.id,
            target_kind: target.kind,
            target_id: target.id,
            relation_type: relationType,
            sort_order: current.links.filter(
              (link) =>
                link.target_kind === target.kind &&
                link.target_id === target.id &&
                link.relation_type === relationType,
            ).length,
            created_at: new Date().toISOString(),
          },
        ],
      }));

      if (updateSelectionAfterConnect) {
        const nextSelectedNodeId =
          selectedFlowId ?? getFlowNodeId(target.kind, target.id);
        applyCanvasSelection({ nodeIds: [nextSelectedNodeId] });
        window.requestAnimationFrame(() =>
          ensureNodeVisible(nextSelectedNodeId),
        );
      }

      if (focusPromptIfNeeded && shouldFocusPrompt) {
        scheduleComposerFocus({
          nodeId: target.id,
          field: target.kind === "image" ? "image-prompt" : "video-prompt",
        });
      }
    },
    [
      applyCanvasSelection,
      ensureNodeVisible,
      graph,
      scheduleComposerFocus,
      updateGraph,
    ],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      setPendingNodeMenu(null);
      if (!connection.source || !connection.target) {
        return;
      }

      connectNodes({
        sourceFlowId: connection.source,
        targetFlowId: connection.target,
        focusPromptIfNeeded: false,
        updateSelectionAfterConnect: false,
      });
    },
    [connectNodes],
  );

  const createNodeAtPosition = useCallback(
    (
      kind: CanvasNodeKind,
      options?: {
        position?: { x: number; y: number };
        sourceFlowId?: string | null;
        sourceHandleType?: HandleType | null;
      },
    ) => {
      setPendingNodeMenu(null);

      const sourceNodeRef =
        options?.sourceFlowId && options.sourceHandleType
          ? parseFlowNodeId(options.sourceFlowId)
          : null;
      const relationType =
        sourceNodeRef && options?.sourceHandleType
          ? options.sourceHandleType === "target"
            ? getCanvasLinkRelationForKinds(kind, sourceNodeRef.kind)
            : getCanvasLinkRelationForKinds(sourceNodeRef.kind, kind)
          : null;
      const sourceHandleType = options?.sourceHandleType ?? null;

      if (sourceNodeRef && relationType && sourceHandleType) {
        const position = options?.position ?? getViewportCenterPosition();
        const placedPosition = getNodePlacementForConnection(
          kind,
          position,
          sourceHandleType,
        );
        const nextNode =
          kind === "text"
            ? buildDefaultTextNode(
                graph!.project.id,
                placedPosition,
                defaultTextNodeModel,
              )
            : kind === "image"
              ? buildDefaultImageNode(
                  graph!.project.id,
                  placedPosition,
                  defaultImageNodeModel,
                )
              : buildDefaultVideoNode(
                  graph!.project.id,
                  placedPosition,
                  defaultVideoNodeModel,
                );
        const nextNodeId = nextNode.id;

        updateGraph((current) => {
          const now = new Date().toISOString();
          const nextLink: CanvasLink = {
            id: createId("link"),
            project_id: current.project.id,
            source_kind:
              sourceHandleType === "target" ? kind : sourceNodeRef.kind,
            source_id:
              sourceHandleType === "target" ? nextNode.id : sourceNodeRef.id,
            target_kind:
              sourceHandleType === "target" ? sourceNodeRef.kind : kind,
            target_id:
              sourceHandleType === "target" ? sourceNodeRef.id : nextNode.id,
            relation_type: relationType,
            sort_order: current.links.filter(
              (link) =>
                link.target_kind ===
                  (sourceHandleType === "target" ? sourceNodeRef.kind : kind) &&
                link.target_id ===
                  (sourceHandleType === "target"
                    ? sourceNodeRef.id
                    : nextNode.id) &&
                link.relation_type === relationType,
            ).length,
            created_at: now,
          };

          return {
            ...current,
            textNodes:
              kind === "text"
                ? [...current.textNodes, nextNode as CanvasTextNode]
                : current.textNodes,
            imageNodes:
              kind === "image"
                ? [...current.imageNodes, nextNode as CanvasImageNode]
                : current.imageNodes,
            videoNodes:
              kind === "video"
                ? [...current.videoNodes, nextNode as CanvasVideoNode]
                : current.videoNodes,
            links: [...current.links, nextLink],
          };
        });

        const nextFlowId = getFlowNodeId(kind, nextNodeId);
        skipNextSelectionEnsureVisibleRef.current = true;
        applyCanvasSelection({ nodeIds: [nextFlowId] });
        focusNodeComposer(kind, nextNodeId);
        return nextNodeId;
      }

      return addNodeToGraph(kind, {
        position: options?.position,
        afterCreate: (nodeId) => {
          focusNodeComposer(kind, nodeId);
        },
      });
    },
    [
      addNodeToGraph,
      applyCanvasSelection,
      focusNodeComposer,
      graph,
      getViewportCenterPosition,
      defaultImageNodeModel,
      defaultTextNodeModel,
      defaultVideoNodeModel,
      updateGraph,
    ],
  );

  const handleSelectPendingNodeKind = useCallback(
    (kind: CanvasNodeKind) => {
      if (!pendingNodeMenu) {
        return;
      }

      const currentMenu = pendingNodeMenu;
      setPendingNodeMenu(null);
      createNodeAtPosition(kind, {
        position: currentMenu.flowPosition,
        sourceFlowId: currentMenu.sourceFlowId,
        sourceHandleType: currentMenu.sourceHandleType,
      });
    },
    [createNodeAtPosition, pendingNodeMenu],
  );

  const removeCanvasLink = useCallback(
    (edgeId: string, options?: { preserveSelection?: boolean }) => {
      updateGraph((current) => ({
        ...current,
        links: current.links.filter((link) => link.id !== edgeId),
      }));

      if (!options?.preserveSelection) {
        applyCanvasSelection({});
      }
    },
    [applyCanvasSelection, updateGraph],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      removeCanvasLink(edgeId);
    },
    [removeCanvasLink],
  );

  const handleInsertNodeFromEdge = useCallback(
    (edgeId: string, kind: CanvasNodeKind) => {
      if (!graph) {
        return;
      }

      const link = graph.links.find((item) => item.id === edgeId);
      if (
        !link ||
        link.source_kind === "operation" ||
        link.target_kind === "operation"
      ) {
        return;
      }

      const sourceNode =
        link.source_kind === "text"
          ? graph.textNodes.find((node) => node.id === link.source_id)
          : link.source_kind === "image"
            ? graph.imageNodes.find((node) => node.id === link.source_id)
            : graph.videoNodes.find((node) => node.id === link.source_id);
      const targetNode =
        link.target_kind === "text"
          ? graph.textNodes.find((node) => node.id === link.target_id)
          : link.target_kind === "image"
            ? graph.imageNodes.find((node) => node.id === link.target_id)
            : graph.videoNodes.find((node) => node.id === link.target_id);

      if (!sourceNode || !targetNode) {
        return;
      }

      const sourceRelation = getCanvasLinkRelationForKinds(
        link.source_kind,
        kind,
      );
      const targetRelation = getCanvasLinkRelationForKinds(
        kind,
        link.target_kind,
      );

      if (!sourceRelation || !targetRelation) {
        return;
      }

      const midpoint = {
        x:
          sourceNode.x +
          sourceNode.width / 2 +
          (targetNode.x +
            targetNode.width / 2 -
            (sourceNode.x + sourceNode.width / 2)) /
            2 -
          (kind === "image"
            ? DEFAULT_IMAGE_NODE_WIDTH
            : kind === "text"
              ? DEFAULT_TEXT_NODE_WIDTH
              : DEFAULT_VIDEO_NODE_WIDTH) /
            2,
        y:
          sourceNode.y +
          sourceNode.height / 2 +
          (targetNode.y +
            targetNode.height / 2 -
            (sourceNode.y + sourceNode.height / 2)) /
            2 -
          (kind === "image"
            ? DEFAULT_IMAGE_NODE_HEIGHT
            : kind === "text"
              ? DEFAULT_TEXT_NODE_HEIGHT
              : DEFAULT_VIDEO_NODE_HEIGHT) /
            2,
      };
      const nextNodeId = addNodeToGraph(kind, { position: midpoint });
      if (!nextNodeId) {
        return;
      }

      updateGraph((current) => ({
        ...current,
        links: [
          ...current.links.filter((item) => item.id !== edgeId),
          {
            id: createId("link"),
            project_id: current.project.id,
            source_kind: link.source_kind,
            source_id: link.source_id,
            target_kind: kind,
            target_id: nextNodeId,
            relation_type: sourceRelation,
            sort_order: 0,
            created_at: new Date().toISOString(),
          },
          {
            id: createId("link"),
            project_id: current.project.id,
            source_kind: kind,
            source_id: nextNodeId,
            target_kind: link.target_kind,
            target_id: link.target_id,
            relation_type: targetRelation,
            sort_order: 0,
            created_at: new Date().toISOString(),
          },
        ],
      }));

      applyCanvasSelection({ nodeIds: [getFlowNodeId(kind, nextNodeId)] });
      scheduleComposerFocus(
        kind === "text"
          ? { nodeId: nextNodeId, field: "text-content" }
          : kind === "image"
            ? { nodeId: nextNodeId, field: "image-prompt" }
            : { nodeId: nextNodeId, field: "video-prompt" },
      );
    },
    [
      addNodeToGraph,
      applyCanvasSelection,
      graph,
      scheduleComposerFocus,
      updateGraph,
    ],
  );

  const handleNodeDragStop: OnNodeDrag<CanvasFlowNode> = useCallback(
    (_event, node) => {
      const parsed = parseFlowNodeId(node.id);
      if (!parsed) {
        return;
      }

      const width =
        node.width ??
        (typeof node.style?.width === "number" ? node.style.width : undefined);
      const height =
        node.height ??
        (typeof node.style?.height === "number"
          ? node.style.height
          : undefined);

      if (parsed.kind === "text") {
        updateTextNode(parsed.id, {
          x: node.position.x,
          y: node.position.y,
        });
        return;
      }

      if (parsed.kind === "image") {
        updateImageNode(parsed.id, {
          x: node.position.x,
          y: node.position.y,
          ...(typeof width === "number" ? { width } : {}),
          ...(typeof height === "number" ? { height } : {}),
        });
        return;
      }

      updateVideoNode(parsed.id, {
        x: node.position.x,
        y: node.position.y,
        ...(typeof width === "number" ? { width } : {}),
        ...(typeof height === "number" ? { height } : {}),
      });
    },
    [updateImageNode, updateTextNode, updateVideoNode],
  );

  const handleViewportPersist = useCallback(
    (viewport: Viewport) => {
      handleViewportChange(viewport);

      if (viewportSaveTimeoutRef.current !== null) {
        window.clearTimeout(viewportSaveTimeoutRef.current);
      }

      viewportSaveTimeoutRef.current = window.setTimeout(() => {
        void updateCanvasProject(projectId, {
          viewport,
        }).catch((error) => {
          console.error("Failed to persist viewport:", error);
        });
      }, 480);
    },
    [handleViewportChange, projectId],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFloatingViewportSize = () => {
      setFloatingViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    syncFloatingViewportSize();
    window.addEventListener("resize", syncFloatingViewportSize);

    return () => {
      window.removeEventListener("resize", syncFloatingViewportSize);
    };
  }, []);

  useEffect(() => {
    if (selectedFlowNodeIds.length !== 1) {
      return;
    }

    if (skipNextSelectionEnsureVisibleRef.current) {
      skipNextSelectionEnsureVisibleRef.current = false;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      ensureNodeVisible(selectedFlowNodeIds[0]);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [ensureNodeVisible, selectedFlowNodeIds]);

  const handleReplaceImage = useCallback(
    async (nodeId: string, file: File | null) => {
      if (!file) {
        return;
      }

      setUploadingNodeMedia(true);
      try {
        const dimensions = await getImageDimensionsFromFile(file).catch(
          () => null,
        );
        const node = await replaceCanvasNodeImage({
          projectId,
          nodeId,
          file,
          width: dimensions?.width,
          height: dimensions?.height,
        });

        updateImageNode(nodeId, node);
      } catch (error) {
        console.error("Failed to replace canvas image:", error);
        addToast(copy.replaceImageFailed, "error");
      } finally {
        setUploadingNodeMedia(false);
      }
    },
    [addToast, copy.replaceImageFailed, projectId, updateImageNode],
  );

  const handleReplaceVideo = useCallback(
    async (nodeId: string, file: File | null) => {
      if (!file) {
        return;
      }

      setUploadingNodeMedia(true);
      try {
        const node = await replaceCanvasNodeVideo({
          projectId,
          nodeId,
          file,
        });

        updateVideoNode(nodeId, node);
      } catch (error) {
        console.error("Failed to replace canvas video:", error);
        addToast(copy.replaceVideoFailed, "error");
      } finally {
        setUploadingNodeMedia(false);
      }
    },
    [addToast, copy.replaceVideoFailed, projectId, updateVideoNode],
  );

  const openNodeUploadDialog = useCallback(
    (kind: "image" | "video", nodeId: string) => {
      setNodeUploadTarget({ kind, nodeId });
      setNodeUploadUrlDraft("");
      setNodeUploadDialogOpen(true);
    },
    [],
  );

  const handleImageNodeUploadRequest = useCallback(
    (nodeId: string) => {
      openNodeUploadDialog("image", nodeId);
    },
    [openNodeUploadDialog],
  );

  const handleVideoNodeUploadRequest = useCallback(
    (nodeId: string) => {
      openNodeUploadDialog("video", nodeId);
    },
    [openNodeUploadDialog],
  );

  const handleChooseLocalNodeUpload = useCallback(() => {
    if (!nodeUploadTarget) {
      return;
    }

    setNodeUploadDialogOpen(false);

    window.requestAnimationFrame(() => {
      if (nodeUploadTarget.kind === "image") {
        imageNodeUploadInputRef.current?.click();
        return;
      }

      videoNodeUploadInputRef.current?.click();
    });
  }, [nodeUploadTarget]);

  const handleInsertNodeUrl = useCallback(async () => {
    if (!nodeUploadTarget) {
      return;
    }

    const trimmedUrl = nodeUploadUrlDraft.trim();
    if (!trimmedUrl) {
      addToast(copy.pasteUrlFirst, "info");
      return;
    }

    let normalizedUrl = "";
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("unsupported_protocol");
      }
      normalizedUrl = parsed.toString();
    } catch {
      addToast(copy.invalidHttpUrl, "error");
      return;
    }

    setSubmittingNodeUploadUrl(true);
    try {
      if (nodeUploadTarget.kind === "image") {
        const dimensions = await getImageDimensionsFromUrl(normalizedUrl).catch(
          () => null,
        );
        const compactDimensions = dimensions
          ? getCompactCanvasImageDimensions(dimensions.width, dimensions.height)
          : {
              width: DEFAULT_IMAGE_NODE_WIDTH,
              height: DEFAULT_IMAGE_NODE_HEIGHT,
            };

        updateImageNode(nodeUploadTarget.nodeId, {
          image_url: normalizedUrl,
          origin_type: "asset",
          source_generation_id: null,
          source_generation_image_index: null,
          width: compactDimensions.width,
          height: compactDimensions.height,
        });
      } else {
        updateVideoNode(nodeUploadTarget.nodeId, {
          videoUrl: normalizedUrl,
          posterUrl: null,
          status: "idle",
        });
      }

      setNodeUploadDialogOpen(false);
      setNodeUploadUrlDraft("");
    } finally {
      setSubmittingNodeUploadUrl(false);
    }
  }, [
    addToast,
    copy.invalidHttpUrl,
    copy.pasteUrlFirst,
    nodeUploadTarget,
    nodeUploadUrlDraft,
    updateImageNode,
    updateVideoNode,
  ]);

  const handleTextNodeContentChange = useCallback(
    (nodeId: string, nextContent: string) => {
      updateGraph((current) => ({
        ...current,
        textNodes: current.textNodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          const patch: Partial<CanvasTextNode> = {
            content: nextContent,
          };

          if (shouldAutoUpdateTextNodeTitle(node.title, node.content)) {
            patch.title = deriveTextNodeTitle(nextContent);
          }

          return {
            ...node,
            ...patch,
            updated_at: new Date().toISOString(),
          };
        }),
      }));
    },
    [updateGraph],
  );

  const handleTextComposerDraftChange = useCallback(
    (nodeId: string, nextDraft: string) => {
      setTextComposerDrafts((current) =>
        current[nodeId] === nextDraft
          ? current
          : {
              ...current,
              [nodeId]: nextDraft,
            },
      );
    },
    [],
  );

  const textNodeModelOptions = useMemo(
    () => getConfiguredProviderModelOptions("text", providerSettings),
    [providerSettings],
  );

  const imageNodeModelOptions = useMemo(
    () => getConfiguredProviderModelOptions("image", providerSettings),
    [providerSettings],
  );

  const videoNodeModelOptions = useMemo(
    () => getConfiguredProviderModelOptions("video", providerSettings),
    [providerSettings],
  );

  const getConfiguredNodeModelValue = useCallback(
    (kind: "text" | "image" | "video", value: string | null | undefined) => {
      const defaultValue =
        kind === "text"
          ? defaultTextNodeModel
          : kind === "image"
            ? defaultImageNodeModel
            : defaultVideoNodeModel;
      const options =
        kind === "text"
          ? textNodeModelOptions
          : kind === "image"
            ? imageNodeModelOptions
            : videoNodeModelOptions;
      const normalized = normalizeProviderModelValue(
        value || defaultValue,
        kind,
        providerSettings,
      );

      if (options.some((option) => option.value === normalized)) {
        return normalized;
      }

      return options[0]?.value ?? "";
    },
    [
      defaultImageNodeModel,
      defaultTextNodeModel,
      defaultVideoNodeModel,
      imageNodeModelOptions,
      providerSettings,
      textNodeModelOptions,
      videoNodeModelOptions,
    ],
  );

  const resolveNodeProviderState = useCallback(
    (kind: "text" | "image" | "video", value: string | null | undefined) => {
      const configuredModelValue = getConfiguredNodeModelValue(kind, value);
      const normalized =
        configuredModelValue ||
        normalizeProviderModelValue(
          value ||
            (kind === "text"
              ? defaultTextNodeModel
              : kind === "image"
                ? defaultImageNodeModel
                : defaultVideoNodeModel),
          kind,
          providerSettings,
        );
      const resolved = resolveProviderModelSelection(
        normalized,
        kind,
        providerSettings,
      );
      const provider = getProviderDefinition(resolved.providerId);

      return {
        normalized,
        resolved,
        provider: {
          ...provider,
          label: getProviderPlatformDisplayName(
            resolved.platformId,
            providerSettings,
            resolved.providerId,
          ),
        },
        configured:
          configuredModelValue.length > 0 &&
          isProviderPlatformConfigured(providerSettings, resolved.platformId),
      };
    },
    [
      defaultImageNodeModel,
      defaultTextNodeModel,
      defaultVideoNodeModel,
      getConfiguredNodeModelValue,
      providerSettings,
    ],
  );

  const openVideoInputRequirementDialog = useCallback((providerLabel: string) => {
    setVideoInputRequirementDialog({
      open: true,
      providerLabel,
    });
  }, []);

  const handleRunText = useCallback(
    async (
      node: CanvasTextNode,
      promptDraft: string,
      promptSources: CanvasTextNode[],
    ) => {
      const sourceTexts = [
        ...promptSources
          .map((promptSource) => promptSource.content.trim())
          .filter((content) => content.length > 0),
        node.content.trim(),
      ].filter(
        (content, index, values) =>
          content.length > 0 && values.indexOf(content) === index,
      );

      if (promptDraft.trim().length === 0 && sourceTexts.length === 0) {
        scheduleComposerFocus({
          nodeId: node.id,
          field: "text-content",
        });
        addToast(copy.addTextInstructionFirst, "info");
        return;
      }

      const modelState = resolveNodeProviderState("text", node.model);
      if (!modelState.configured) {
        setAccountMenuOpen(true);
        addToast(
          formatCopy(copy.missingProviderApiKey, {
            provider: modelState.provider.label,
          }),
          "info",
        );
        return;
      }

      setRunningNodeId(node.id);

      try {
        const payload = await runTextProviderRequest({
          settings: providerSettings,
          kind: "text",
          model: modelState.normalized,
          instruction: promptDraft,
          sourceText: sourceTexts.join("\n\n"),
        }, {
          failedMessage: copy.textGenerationFailed,
        });

        updateTextNode(node.id, {
          content: payload.text,
          title: deriveTextNodeTitle(payload.text),
          model: modelState.normalized,
        });
      } catch (error) {
        addToast(
          error instanceof Error ? error.message : copy.textGenerationFailed,
          "error",
        );
      } finally {
        setRunningNodeId((current) => (current === node.id ? null : current));
      }
    },
    [
      addToast,
      copy.addTextInstructionFirst,
      copy.missingProviderApiKey,
      copy.textGenerationFailed,
      providerSettings,
      resolveNodeProviderState,
      scheduleComposerFocus,
      updateTextNode,
    ],
  );

  const handleRunImage = useCallback(
    async (
      node: CanvasImageNode,
      promptSources: CanvasTextNode[],
      references: CanvasImageNode[],
    ) => {
      const hasPromptSources = promptSources.some(
        (promptSource) => promptSource.content.trim().length > 0,
      );

      if (node.prompt.trim().length === 0 && !hasPromptSources) {
        scheduleComposerFocus({
          nodeId: node.id,
          field: "image-prompt",
        });
        addToast(copy.addPromptOrTextNodeFirst, "info");
        return;
      }

      const modelState = resolveNodeProviderState("image", node.model);
      if (!modelState.configured) {
        setAccountMenuOpen(true);
        addToast(
          formatCopy(copy.missingProviderApiKey, {
            provider: modelState.provider.label,
          }),
          "info",
        );
        return;
      }

      const imageUrls = Array.from(
        new Set(
          [
            node.image_url,
            ...references.map((reference) => reference.image_url),
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      );
      const promptTexts = promptSources
        .map((promptSource) => promptSource.content.trim())
        .filter((text) => text.length > 0);

      setRunningNodeId(node.id);
      setRunningImageProgress(null);
      const stopFallbackProgress = startFallbackProgress(setRunningImageProgress);

      try {
        const payload = await runImageProviderRequest({
          settings: providerSettings,
          kind: "image",
          model: modelState.normalized,
          prompt: node.prompt,
          promptTexts,
          imageUrls,
          aspectRatio: node.size || providerSettings.defaults.imageAspectRatio,
        }, {
          failedMessage: copy.imageGenerationFailed,
        });
        stopFallbackProgress();

        updateGraph((current) => {
          const now = new Date().toISOString();
          const nextImageUrl = payload.imageUrls![0];

          return {
            ...current,
            project: {
              ...current.project,
              cover_image_url:
                current.project.cover_image_url ??
                nextImageUrl ??
                null,
              last_refined_at: now,
              updated_at: now,
            },
            imageNodes: current.imageNodes.map((imageNode) =>
              imageNode.id === node.id
                ? {
                    ...imageNode,
                    image_url: nextImageUrl,
                    origin_type: "generated",
                    source_generation_id: payload.generationId,
                    source_generation_image_index: payload.generationId ? 0 : null,
                    prompt: node.prompt,
                    model: modelState.normalized,
                    size:
                      node.size || providerSettings.defaults.imageAspectRatio,
                    updated_at: now,
                  }
                : imageNode,
            ),
          };
        });

      } catch (error) {
        addToast(
          error instanceof Error ? error.message : copy.imageGenerationFailed,
          "error",
        );
      } finally {
        stopFallbackProgress();
        setRunningImageProgress(null);
        setRunningNodeId((current) => (current === node.id ? null : current));
      }
    },
    [
      addToast,
      copy.addPromptOrTextNodeFirst,
      copy.imageGenerationFailed,
      copy.missingProviderApiKey,
      providerSettings,
      resolveNodeProviderState,
      scheduleComposerFocus,
      updateGraph,
      startFallbackProgress,
    ],
  );

  const handleRunVideo = useCallback(
    async (
      node: CanvasVideoNode,
      promptSources: CanvasTextNode[],
      primarySources: CanvasImageNode[],
    ) => {
      const hasPrimarySource = primarySources.some(
        (primarySource) => primarySource.image_url.trim().length > 0,
      );
      const promptTexts = promptSources
        .map((promptSource) => promptSource.content.trim())
        .filter((text) => text.length > 0);

      if (!hasPrimarySource) {
        addToast(copy.connectPrimaryImageFirst, "info");
        return;
      }

      if (node.prompt.trim().length === 0 && promptTexts.length === 0) {
        scheduleComposerFocus({
          nodeId: node.id,
          field: "video-prompt",
        });
        addToast(copy.addPromptOrTextNodeFirst, "info");
        return;
      }

      const modelState = resolveNodeProviderState("video", node.model);
      if (!modelState.configured) {
        setAccountMenuOpen(true);
        addToast(
          formatCopy(copy.missingProviderApiKey, {
            provider: modelState.provider.label,
          }),
          "info",
        );
        return;
      }

      const imageUrls = Array.from(
        new Set(
          primarySources
            .map((primarySource) => primarySource.image_url.trim())
            .filter(Boolean),
        ),
      );
      const supportsInlineVideoInput = providerSupportsInlineVideoImageInput(
        modelState.resolved.providerId,
      );
      const hasOnlyDirectImageUrls =
        supportsInlineVideoInput || imageUrls.every((imageUrl) => isDirectHttpUrl(imageUrl));

      if (!hasOnlyDirectImageUrls) {
        openVideoInputRequirementDialog(modelState.provider.label);
        return;
      }

      const fallbackPosterUrl = primarySources[0]?.image_url ?? node.posterUrl ?? null;
      const previousVideoState = {
        status: node.status,
        posterUrl: node.posterUrl,
        videoUrl: node.videoUrl,
      } satisfies Pick<CanvasVideoNode, "status" | "posterUrl" | "videoUrl">;

      setRunningNodeId(node.id);
      setRunningVideoProgress(null);
      const stopFallbackProgress = startFallbackProgress(setRunningVideoProgress);
      updateVideoNode(node.id, {
        status: "running",
        posterUrl: fallbackPosterUrl,
      });

      try {
        const payload = await runVideoProviderRequest({
          settings: providerSettings,
          kind: "video",
          model: modelState.normalized,
          prompt: node.prompt,
          promptTexts,
          imageUrls,
          aspectRatio: node.size || "16:9",
          durationSeconds: node.durationSeconds,
        }, {
          failedMessage: copy.videoGenerationFailed,
        });
        stopFallbackProgress();

        updateGraph((current) => {
          const now = new Date().toISOString();
          const nextVideoUrl = payload.videoUrls![0];

          return {
            ...current,
            project: {
              ...current.project,
              cover_image_url:
                current.project.cover_image_url ?? fallbackPosterUrl ?? null,
              last_refined_at: now,
              updated_at: now,
            },
            videoNodes: current.videoNodes.map((videoNode) =>
              videoNode.id === node.id
                ? {
                    ...videoNode,
                    prompt: node.prompt,
                    model: modelState.normalized,
                    size: node.size || "16:9",
                    durationSeconds: node.durationSeconds,
                    status: "completed",
                    posterUrl: fallbackPosterUrl,
                    videoUrl: nextVideoUrl,
                    updated_at: now,
                  }
                : videoNode,
            ),
          };
        });

        if ((payload.omittedImageCount ?? 0) > 0) {
          addToast(
            formatCopy(copy.videoGeneratedWithOmittedReferences, {
              count: payload.omittedImageCount ?? 0,
            }),
            "info",
          );
        }
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: unknown }).code === VIDEO_IMAGE_INPUT_URL_REQUIRED_ERROR
        ) {
          updateVideoNode(node.id, previousVideoState);
          openVideoInputRequirementDialog(modelState.provider.label);
          return;
        }

        updateVideoNode(node.id, previousVideoState);
        addToast(
          error instanceof Error ? error.message : copy.videoGenerationFailed,
          "error",
        );
      } finally {
        stopFallbackProgress();
        setRunningVideoProgress(null);
        setRunningNodeId((current) => (current === node.id ? null : current));
      }
    },
    [
      addToast,
      copy.addPromptOrTextNodeFirst,
      copy.connectPrimaryImageFirst,
      copy.missingProviderApiKey,
      copy.videoGeneratedWithOmittedReferences,
      copy.videoGenerationFailed,
      openVideoInputRequirementDialog,
      providerSettings,
      resolveNodeProviderState,
      scheduleComposerFocus,
      startFallbackProgress,
      updateGraph,
      updateVideoNode,
    ],
  );

  const executeCanvasNodeDeletion = useCallback(
    async (params: {
      nodeIds: string[];
      databaseTargets: Array<{
        generationId: string;
        imageIndex: number;
      }>;
      deleteFromDatabase: boolean;
    }) => {
      if (params.nodeIds.length === 0) {
        return;
      }

      setDeletingCanvasNodes(true);
      try {
        await deleteCanvasGraphNodes(projectId, params.nodeIds);

        if (params.deleteFromDatabase) {
          for (const target of params.databaseTargets) {
            await deleteGenerationAsset(target.generationId, target.imageIndex);
          }

          if (user?.id) {
            patchGenerationListCache(user.id, (items) =>
              removeGenerationImagesFromList(items, params.databaseTargets),
            );
            patchGenerateHistoryCache(`${user.id}:image`, (items) =>
              removeGenerationImagesFromList(items, params.databaseTargets),
            );
          }
        }

        updateGraph((current) => ({
          ...current,
          textNodes: current.textNodes.filter(
            (node) => !params.nodeIds.includes(node.id),
          ),
          imageNodes: current.imageNodes.filter(
            (node) => !params.nodeIds.includes(node.id),
          ),
          videoNodes: current.videoNodes.filter(
            (node) => !params.nodeIds.includes(node.id),
          ),
          links: current.links.filter(
            (link) =>
              !params.nodeIds.includes(link.source_id) &&
              !params.nodeIds.includes(link.target_id),
          ),
        }));

        setDeleteDialog({
          open: false,
          nodeIds: [],
          databaseTargets: EMPTY_DATABASE_TARGETS,
        });
        applyCanvasSelection({});
      } catch (error) {
        console.error("Failed to delete canvas node(s):", error);
        addToast(copy.deleteFromCanvasFailed, "error");
      } finally {
        setDeletingCanvasNodes(false);
      }
    },
    [
      addToast,
      applyCanvasSelection,
      copy.deleteFromCanvasFailed,
      projectId,
      updateGraph,
      user?.id,
    ],
  );

  useEffect(() => {
    const activeNode = selectedFlowNodeIds
      .map((id) => parseFlowNodeId(id))
      .find((item): item is { kind: CanvasNodeKind; id: string } => !!item);

    if (
      !composerFocusTarget ||
      !activeNode ||
      activeNode.id !== composerFocusTarget.nodeId
    ) {
      return;
    }

    const target =
      composerFocusTarget.field === "text-title"
        ? textTitleInputRef.current
        : composerFocusTarget.field === "text-content"
          ? textContentInputRef.current
          : composerFocusTarget.field === "image-prompt"
            ? imagePromptInputRef.current
            : videoPromptInputRef.current;

    if (!target) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      target.focus();
    });

    setComposerFocusTarget(null);

    return () => window.cancelAnimationFrame(frame);
  }, [composerFocusTarget, selectedFlowNodeIds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }

      if (selectedEdgeIds.length > 0) {
        event.preventDefault();
        updateGraph((current) => ({
          ...current,
          links: current.links.filter(
            (link) => !selectedEdgeIds.includes(link.id),
          ),
        }));
        applyCanvasSelection({ nodeIds: selectedFlowNodeIds });
        return;
      }

      if (!graph) {
        return;
      }

      const selectedContentNodes = selectedFlowNodeIds
        .map((id) => parseFlowNodeId(id))
        .filter((item): item is { kind: CanvasNodeKind; id: string } => !!item);

      if (selectedContentNodes.length === 0) {
        return;
      }

      event.preventDefault();

      const imageTargets = graph.imageNodes.filter((node) =>
        selectedContentNodes.some(
          (item) => item.kind === "image" && item.id === node.id,
        ),
      );
      const databaseTargets = imageTargets.flatMap((node) =>
        node.origin_type === "generated" &&
        node.source_generation_id !== null &&
        typeof node.source_generation_image_index === "number"
          ? [
              {
                generationId: node.source_generation_id,
                imageIndex: node.source_generation_image_index,
              },
            ]
          : [],
      );

      if (databaseTargets.length > 0) {
        setDeleteDialog({
          open: true,
          nodeIds: selectedContentNodes.map((item) => item.id),
          databaseTargets,
        });
        setDeleteFromDatabase(true);
        return;
      }

      void executeCanvasNodeDeletion({
        nodeIds: selectedContentNodes.map((item) => item.id),
        databaseTargets: EMPTY_DATABASE_TARGETS,
        deleteFromDatabase: false,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    applyCanvasSelection,
    executeCanvasNodeDeletion,
    graph,
    selectedEdgeIds,
    selectedFlowNodeIds,
    updateGraph,
  ]);

  const projectTitle = graph?.project.title?.trim() || copy.untitled;
  const themeMode = resolvedTheme === "dark" ? "dark" : "light";
  const projectSwitcherItems = useMemo<ProjectSwitcherItem[]>(
    () =>
      projectSummaries.map((project) => ({
        id: project.id,
        title: project.title?.trim() || copy.untitled,
        meta: formatRelativeTimestamp(locale, project.updated_at) || copy.justNow,
        isCurrent: project.id === projectId,
      })),
    [copy.justNow, copy.untitled, locale, projectId, projectSummaries],
  );

  const normalizedNodeUploadPreviewUrl = useMemo(() => {
    const trimmed = nodeUploadUrlDraft.trim();
    if (!trimmed) {
      return "";
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "";
      }

      return parsed.toString();
    } catch {
      return "";
    }
  }, [nodeUploadUrlDraft]);

  const activeCanvasNode = useMemo<ActiveCanvasNode>(() => {
    if (!graph || selectedFlowNodeIds.length !== 1) {
      return null;
    }

    const parsed = parseFlowNodeId(selectedFlowNodeIds[0]);
    if (!parsed) {
      return null;
    }

    if (parsed.kind === "text") {
      const node = graph.textNodes.find((item) => item.id === parsed.id);
      return node ? { kind: "text", node } : null;
    }

    if (parsed.kind === "image") {
      const node = graph.imageNodes.find((item) => item.id === parsed.id);
      return node ? { kind: "image", node } : null;
    }

    const node = graph.videoNodes.find((item) => item.id === parsed.id);
    return node ? { kind: "video", node } : null;
  }, [graph, selectedFlowNodeIds]);

  const activeTextComposerDraft =
    activeCanvasNode?.kind === "text"
      ? (textComposerDrafts[activeCanvasNode.node.id] ?? "")
      : "";

  const promptSourceTextEntries = useMemo<
    Array<{ link: CanvasLink; node: CanvasTextNode }>
  >(() => {
    if (!graph || !activeCanvasNode) {
      return [];
    }

    return graph.links
      .filter(
        (link) =>
          link.target_kind === activeCanvasNode.kind &&
          link.target_id === activeCanvasNode.node.id &&
          link.relation_type === "prompt" &&
          link.source_kind === "text",
      )
      .map((link) => {
        const node = graph.textNodes.find(
          (candidate) => candidate.id === link.source_id,
        );
        return node ? { link, node } : null;
      })
      .filter(
        (
          entry,
        ): entry is {
          link: CanvasLink;
          node: CanvasTextNode;
        } => !!entry,
      );
  }, [activeCanvasNode, graph]);

  const promptSourceTexts = useMemo(
    () => promptSourceTextEntries.map((entry) => entry.node),
    [promptSourceTextEntries],
  );

  const composerReferenceEntries = useMemo<ComposerReferenceEntry[]>(() => {
    if (!graph || !activeCanvasNode) {
      return [];
    }

    return graph.links
      .filter(
        (link) =>
          link.target_kind === activeCanvasNode.kind &&
          link.target_id === activeCanvasNode.node.id,
      )
      .flatMap<ComposerReferenceEntry>((link) => {
        if (link.source_kind === "text") {
          const sourceNode = graph.textNodes.find(
            (node) => node.id === link.source_id,
          );
          if (!sourceNode) {
            return [];
          }

          return [
            {
              id: link.id,
              sourceKind: "text" as const,
              title: copy.textReference,
              textHasContent: sourceNode.content.trim().length > 0,
              content:
                sourceNode.content.trim() ||
                sourceNode.title.trim() ||
                DEFAULT_TEXT_NODE_TITLE,
            } satisfies ComposerReferenceEntry,
          ];
        }

        if (link.source_kind === "image") {
          const sourceNode = graph.imageNodes.find(
            (node) => node.id === link.source_id,
          );
          if (!sourceNode) {
            return [];
          }

          return [
            {
              id: link.id,
              sourceKind: "image" as const,
              title: imageLabelMap.get(sourceNode.id) || copy.imageReference,
              content:
                sourceNode.prompt.trim() ||
                imageLabelMap.get(sourceNode.id) ||
                copy.nodeImageLabel,
              imageUrl: sourceNode.image_url || null,
            } satisfies ComposerReferenceEntry,
          ];
        }

        if (link.source_kind === "video") {
          const sourceNode = graph.videoNodes.find(
            (node) => node.id === link.source_id,
          );
          if (!sourceNode) {
            return [];
          }

          return [
            {
              id: link.id,
              sourceKind: "video" as const,
              title: sourceNode.title.trim() || copy.videoReference,
              content:
                sourceNode.prompt.trim() ||
                sourceNode.title.trim() ||
                copy.nodeVideoLabel,
              videoUrl: sourceNode.videoUrl ?? null,
              posterUrl: sourceNode.posterUrl ?? null,
            } satisfies ComposerReferenceEntry,
          ];
        }

        return [];
      });
  }, [
    activeCanvasNode,
    copy.imageReference,
    copy.nodeImageLabel,
    copy.nodeVideoLabel,
    copy.textReference,
    copy.videoReference,
    graph,
    imageLabelMap,
  ]);

  const composerReferenceCards =
    composerReferenceEntries.length > 0 ? (
      <div className="flex gap-2 overflow-x-auto px-1.5 pb-1 pt-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {composerReferenceEntries.map((entry) => (
          <ComposerReferenceCard
            key={entry.id}
            entry={entry}
            onRemove={() =>
              removeCanvasLink(entry.id, {
                preserveSelection: true,
              })
            }
          />
        ))}
      </div>
    ) : null;

  const activeCanvasNodeComposerLayout =
    !activeCanvasNode ||
    selectedFlowNodeIds.length !== 1 ||
    typeof window === "undefined"
      ? null
      : (() => {
          const targetRect = flowSurfaceRef.current?.getNodeScreenRect(
            selectedFlowNodeIds[0],
          );
          if (!targetRect) {
            return null;
          }

          const surfaceRect = flowSurfaceRef.current?.getContainerScreenRect();
          const viewportWidth =
            surfaceRect?.width ||
            floatingViewportSize.width ||
            window.innerWidth;
          const viewportHeight =
            surfaceRect?.height ||
            floatingViewportSize.height ||
            window.innerHeight;
          const viewportLeft = surfaceRect?.left ?? 0;
          const viewportTop = surfaceRect?.top ?? 0;
          const margin = clamp(Math.round(viewportWidth * 0.03), 16, 28);
          const width = Math.min(
            viewportWidth - margin * 2,
            COMPOSER_MAX_WIDTH,
          );
          const anchorX = targetRect.left + targetRect.width / 2;
          const left = clamp(
            anchorX - width / 2,
            viewportLeft + margin,
            viewportLeft + viewportWidth - width - margin,
          );
          const belowTop = targetRect.top + targetRect.height + 16;
          const minTop = viewportTop + margin;
          const top = Math.max(belowTop, minTop);

          return { left, top, width };
        })();

  const activeCanvasNodeConnectionTargetHighlightSide =
    activeCanvasNode &&
    activeConnectionTargetHighlight?.flowNodeId ===
      getFlowNodeId(activeCanvasNode.kind, activeCanvasNode.node.id)
      ? activeConnectionTargetHighlight.side
      : null;
  const composerHiddenByCrop =
    activeCanvasNode?.kind === "image" &&
    croppingImageNodeId === activeCanvasNode.node.id;

  const referenceImages = useMemo(() => {
    if (!graph || !activeCanvasNode || activeCanvasNode.kind !== "image") {
      return [];
    }

    return graph.links
      .filter(
        (link) =>
          link.target_kind === "image" &&
          link.target_id === activeCanvasNode.node.id &&
          link.relation_type === "reference" &&
          link.source_kind === "image",
      )
      .map((link) =>
        graph.imageNodes.find((node) => node.id === link.source_id),
      )
      .filter((node): node is CanvasImageNode => !!node);
  }, [activeCanvasNode, graph]);

  const primaryVideoInputs = useMemo(() => {
    if (!graph || !activeCanvasNode || activeCanvasNode.kind !== "video") {
      return [];
    }

    return graph.links
      .filter(
        (link) =>
          link.target_kind === "video" &&
          link.target_id === activeCanvasNode.node.id &&
          link.relation_type === "primary" &&
          link.source_kind === "image",
      )
      .map((link) =>
        graph.imageNodes.find((node) => node.id === link.source_id),
      )
      .filter((node): node is CanvasImageNode => !!node);
  }, [activeCanvasNode, graph]);

  const startProjectTitleEditing = useCallback(() => {
    if (!graph) {
      return;
    }

    setProjectTitleDraft(graph.project.title?.trim() || copy.untitled);
    setIsEditingProjectTitle(true);
  }, [copy.untitled, graph]);

  const cancelProjectTitleEditing = useCallback(() => {
    skipProjectTitleCommitRef.current = true;
    setProjectTitleDraft(graph?.project.title?.trim() || copy.untitled);
    setIsEditingProjectTitle(false);
  }, [copy.untitled, graph?.project.title]);

  const commitProjectTitle = useCallback(async () => {
    if (skipProjectTitleCommitRef.current) {
      skipProjectTitleCommitRef.current = false;
      return;
    }

    if (!graph?.project.id || savingProjectTitle) {
      setIsEditingProjectTitle(false);
      return;
    }

    const currentTitle = graph.project.title?.trim() || copy.untitled;
    const nextTitle = projectTitleDraft.trim() || copy.untitled;

    setProjectTitleDraft(nextTitle);
    setIsEditingProjectTitle(false);

    if (nextTitle === currentTitle) {
      return;
    }

    setSavingProjectTitle(true);

    try {
      const project = await updateCanvasProject(projectId, { title: nextTitle });

      skipNextGraphPersistRef.current = true;
      setGraph((current) =>
        current
          ? {
              ...current,
              project,
            }
          : current,
      );
    } catch (error) {
      console.error("Failed to rename canvas project:", error);
      setProjectTitleDraft(currentTitle);
      addToast(copy.renameProjectFailed, "error");
    } finally {
      setSavingProjectTitle(false);
    }
  }, [
    addToast,
    copy.renameProjectFailed,
    copy.untitled,
    graph,
    projectId,
    projectTitleDraft,
    savingProjectTitle,
  ]);

  const handleSelectProject = useCallback(
    (nextProjectId: string) => {
      if (!nextProjectId || nextProjectId === projectId) {
        return;
      }

      startTransition(() => {
        router.push(`/canvas/${nextProjectId}`, { scroll: false });
      });
    },
    [projectId, router],
  );

  const handleCreateProject = useCallback(async () => {
    if (creatingProject) {
      return;
    }

    setCreatingProject(true);

    try {
      const project = await createCanvasProject(copy.untitled);

      startTransition(() => {
        router.push(`/canvas/${project.id}`, {
          scroll: false,
        });
      });
    } catch (error) {
      console.error("Failed to create canvas project:", error);
      addToast(copy.createProjectFailed, "error");
    } finally {
      setCreatingProject(false);
    }
  }, [
    addToast,
    copy.createProjectFailed,
    copy.untitled,
    creatingProject,
    router,
  ]);

  const handleDeleteProject = useCallback(
    async (targetProjectId: string) => {
      if (deletingProjectId) {
        return;
      }

      const targetProject = projectSummaries.find(
        (project) => project.id === targetProjectId,
      );
      const targetTitle = targetProject?.title?.trim() || copy.untitled;

      const confirmed = await confirm({
        title: copy.deleteProjectTitle,
        description: formatCopy(copy.deleteProjectDescription, {
          title: targetTitle,
        }),
        confirmLabel: copy.deleteProjectConfirm,
        cancelLabel: copy.deleteProjectCancel,
        tone: "destructive",
      });

      if (!confirmed) {
        return;
      }

      setDeletingProjectId(targetProjectId);

      try {
        await deleteCanvasProject(targetProjectId);

        const remainingProjects = sortProjectSummaries(
          projectSummaries.filter((project) => project.id !== targetProjectId),
        );
        setProjectSummaries(remainingProjects);

        if (targetProjectId !== projectId) {
          return;
        }

        const nextProject = remainingProjects[0];

        if (nextProject) {
          startTransition(() => {
            router.push(`/canvas/${nextProject.id}`, {
              scroll: false,
            });
          });
          return;
        }

        const project = await createCanvasProject(copy.untitled);

        startTransition(() => {
          router.push(`/canvas/${project.id}`, {
            scroll: false,
          });
        });
      } catch (error) {
        console.error("Failed to delete canvas project:", error);
        addToast(copy.deleteProjectFailed, "error");
      } finally {
        setDeletingProjectId(null);
      }
    },
    [
      addToast,
      confirm,
      copy.deleteProjectCancel,
      copy.deleteProjectConfirm,
      copy.deleteProjectDescription,
      copy.deleteProjectFailed,
      copy.deleteProjectTitle,
      copy.untitled,
      deletingProjectId,
      projectId,
      projectSummaries,
      router,
    ],
  );

  const handleSelectLanguage = useCallback(
    (nextLocale: AppLocale) => {
      if (nextLocale === locale) {
        return;
      }

      document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; samesite=lax`;
      startTransition(() => {
        router.refresh();
      });
    },
    [locale, router],
  );

  const handleToggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const handleSidebarNodeDragStart = useCallback(
    (kind: CanvasNodeKind, event: ReactDragEvent<HTMLButtonElement>) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(CANVAS_NODE_DRAG_MIME, kind);
      setPendingNodeMenu(null);
    },
    [],
  );

  const workspacePanelContent = (
    <ProviderSettingsPanel
      settings={providerSettings}
      loading={providerSettingsLoading}
      resetDialogsToken={providerSettingsResetToken}
      openAddModelDialogToken={providerSettingsOpenAddDialogToken}
      openAddModelDialogKind={providerSettingsOpenAddDialogKind}
      onChange={setProviderSettings}
    />
  );

  if (!isLoading && !user) {
    return <CanvasAuthGate />;
  }

  if (isLoading || (loadingGraph && !graph)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {copy.workspaceLoading}
        </div>
      </div>
    );
  }

  if (graphError || !graph) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-6">
        <div className="rounded-[24px] border border-border/70 bg-card/80 px-8 py-10 text-center shadow-[0_24px_80px_-64px_rgba(15,23,42,0.2)]">
          <p className="text-lg font-semibold text-foreground">
            {copy.workspaceError}
          </p>
          <Button className="mt-5" onClick={() => void loadGraph()}>
            {copy.retry}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={workspaceRootRef}
      className="relative h-screen overflow-hidden bg-[#f5f5f5]"
    >
      <input
        ref={imageNodeUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (nodeUploadTarget?.kind === "image") {
            void handleReplaceImage(nodeUploadTarget.nodeId, file);
          }
          event.target.value = "";
        }}
      />
      <input
        ref={videoNodeUploadInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (nodeUploadTarget?.kind === "video") {
            void handleReplaceVideo(nodeUploadTarget.nodeId, file);
          }
          event.target.value = "";
        }}
      />

      <CanvasWorkspaceProjectHeader
        titleInputRef={titleInputRef}
        isEditingProjectTitle={isEditingProjectTitle}
        projectTitleDraft={projectTitleDraft}
        projectTitle={projectTitle}
        savingProjectTitle={savingProjectTitle}
        projectListLabel={copy.projectList}
        projectListEmptyLabel={copy.projectListEmpty}
        projectListLoadingLabel={copy.projectListLoading}
        newProjectLabel={copy.newProject}
        creatingProjectLabel={copy.creatingProject}
        historyLabel={copy.historyLabel}
        historyEmptyLabel={copy.historyEmpty}
        projectSwitcherItems={projectSwitcherItems}
        projectHistoryItems={EMPTY_PROJECT_HISTORY_ITEMS}
        projectListLoading={loadingProjectSummaries}
        creatingProject={creatingProject}
        deletingProjectId={deletingProjectId}
        onProjectTitleDraftChange={setProjectTitleDraft}
        onCommitProjectTitle={() => {
          void commitProjectTitle();
        }}
        onCancelProjectTitleEditing={cancelProjectTitleEditing}
        onStartProjectTitleEditing={startProjectTitleEditing}
        onSelectProject={handleSelectProject}
        onCreateProject={() => {
          void handleCreateProject();
        }}
        onDeleteProject={(targetProjectId) => {
          void handleDeleteProject(targetProjectId);
        }}
        onSelectHistoryItem={() => {}}
      />

      <CanvasWorkspaceAccountMenu
        accountMenuRef={accountMenuRef}
        accountMenuOpen={accountMenuOpen}
        activeLanguage={(locale as AppLocale) || DEFAULT_LOCALE}
        themeMode={themeMode}
        panelContent={workspacePanelContent}
        onAccountMenuOpenChange={setAccountMenuOpen}
        onSelectLanguage={handleSelectLanguage}
        onToggleTheme={handleToggleTheme}
      />

      <CanvasWorkspaceSideToolbar
        primaryToolMode={primaryToolMode}
        primaryMenuOpen={primaryMenuOpen}
        importAssetsLabel={copy.importAssets}
        onSetPrimaryToolMode={(mode) => {
          setPrimaryToolMode(mode);
          setPrimaryMenuOpen(false);
        }}
        onPrimaryMenuOpenChange={setPrimaryMenuOpen}
        onCreateTextNode={() => void createNodeAtPosition("text")}
        onCreateImageNode={() => void createNodeAtPosition("image")}
        onCreateVideoNode={() => void createNodeAtPosition("video")}
        onStartDragNode={handleSidebarNodeDragStart}
        onOpenImportAssets={() => setImportDialogOpen(true)}
      />

      <CanvasFlowSurface
        ref={flowSurfaceRef}
        graph={graph}
        imageLabelMap={imageLabelMap}
        primaryToolMode={primaryToolMode}
        runningTextNodeId={runningNodeId}
        runningImageNodeId={runningNodeId}
        runningImageProgress={runningImageProgress}
        runningVideoNodeId={runningNodeId}
        runningVideoProgress={runningVideoProgress}
        onConnectionTargetHighlightChange={setActiveConnectionTargetHighlight}
        selectedFlowNodeIds={selectedFlowNodeIds}
        selectedEdgeIds={selectedEdgeIds}
        showMiniMap={showMiniMap}
        themeMode={themeMode}
        onConnect={handleConnect}
        onDeleteEdge={handleDeleteEdge}
        onDuplicateTextNode={duplicateTextNode}
        onFocusTextComposer={focusTextComposer}
        onImageNodeResize={handleImageNodeResize}
        onImageNodeReplace={async (nodeId, file) => {
          await handleReplaceImage(nodeId, file);
        }}
        onImageNodeRequestUpload={handleImageNodeUploadRequest}
        onInsertNodeFromEdge={handleInsertNodeFromEdge}
        onLooseConnectionRequest={(params) =>
          openNodeCreationMenu({
            position: params.position,
            sourceFlowId: params.sourceFlowId,
            sourceFlowPosition: params.sourceFlowPosition,
            sourceHandlePosition: params.sourceHandlePosition,
            sourceHandleType: params.sourceHandleType,
          })
        }
        onNodeDragStop={handleNodeDragStop}
        onNodeDrop={(kind, position) => {
          void createNodeAtPosition(kind, { position });
        }}
        onPaneCreateNodeRequest={(position) =>
          openNodeCreationMenu({
            position,
          })
        }
        onQuickCreateFromNode={insertNodeFromSource}
        onSelectionChange={handleFlowSelectionChange}
        onTextNodeContentChange={handleTextNodeContentChange}
        onTextNodeResize={handleTextNodeResize}
        onTextNodeUpdate={updateTextNode}
        onVideoNodeResize={handleVideoNodeResize}
        onVideoNodeRequestUpload={handleVideoNodeUploadRequest}
        onVideoNodeUpdate={updateVideoNode}
        onViewportChange={handleViewportChange}
        onViewportPersist={handleViewportPersist}
        pendingConnectionPreview={pendingConnectionPreview}
        viewport={viewportState}
      />

      {graph.textNodes.length === 0 &&
      graph.imageNodes.length === 0 &&
      graph.videoNodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="pointer-events-auto max-w-lg rounded-[28px] border border-dashed border-border/70 bg-white px-8 py-10 text-center shadow-[0_24px_70px_-54px_rgba(15,23,42,0.24)]">
            <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              {copy.emptyCanvasTitle}
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {copy.toolbarHint}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void createNodeAtPosition("text");
                }}
              >
                <Type className="mr-2 h-4 w-4" />
                {copy.nodeTextLabel}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void createNodeAtPosition("image");
                }}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                {copy.nodeImageLabel}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void createNodeAtPosition("video");
                }}
              >
                <Video className="mr-2 h-4 w-4" />
                {copy.nodeVideoLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingNodeMenu && pendingNodeMenuPosition ? (
        <CanvasNodeCreationMenu
          menuRef={createNodeMenuRef}
          position={pendingNodeMenuPosition}
          options={pendingNodeMenuOptions}
          onSelect={handleSelectPendingNodeKind}
        />
      ) : null}

      {activeCanvasNode && !composerHiddenByCrop ? (
        <div
          className={
            activeCanvasNodeComposerLayout
              ? "pointer-events-none fixed z-30"
              : "absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5"
          }
          style={
            activeCanvasNodeComposerLayout
              ? {
                  left: activeCanvasNodeComposerLayout.left,
                  top: activeCanvasNodeComposerLayout.top,
                  width: activeCanvasNodeComposerLayout.width,
                }
              : undefined
          }
        >
          <div
            ref={setComposerPanelElement}
            data-canvas-zoom-relay=""
            className={cn(
              "pointer-events-auto relative w-full rounded-[16px] bg-white/96 p-2.5 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:bg-[#242424]/96 dark:text-white",
              activeCanvasNodeConnectionTargetHighlightSide &&
                "canvas-node-connection-target-shell",
              getConnectionTargetHighlightShellClassName(
                activeCanvasNodeConnectionTargetHighlightSide,
              ),
              !activeCanvasNodeComposerLayout && "max-w-[520px]",
            )}
          >
            {activeCanvasNode.kind === "text" ? (
              <div className="grid gap-2">
                {composerReferenceCards}
                {composerReferenceCards ? (
                  <div className="h-px bg-black/8 dark:bg-white/10" />
                ) : null}
                <textarea
                  ref={textContentInputRef}
                  value={activeTextComposerDraft}
                  onChange={(event) =>
                    handleTextComposerDraftChange(
                      activeCanvasNode.node.id,
                      event.target.value,
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      void handleRunText(
                        activeCanvasNode.node,
                        activeTextComposerDraft,
                        promptSourceTexts,
                      );
                    }
                  }}
                  placeholder={copy.textComposerPlaceholder}
                  className={COMPOSER_TEXTAREA_CLASS}
                />
                <div className="flex w-full items-end gap-2.5">
                  <div className="min-w-0 flex-1">
                    <CanvasComposerTextControls
                      modelValue={getConfiguredNodeModelValue(
                        "text",
                        activeCanvasNode.node.model,
                      )}
                      modelOptions={textNodeModelOptions}
                      onChange={(patch) =>
                        updateTextNode(activeCanvasNode.node.id, patch)
                      }
                      onRequestAddModel={() =>
                        openAddModelDialogFromComposer("text")
                      }
                      dropdownContainer={composerPanelElement}
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-9 w-9 shrink-0 rounded-full bg-[#111111] p-0 text-white hover:bg-[#000000] dark:bg-[#f1f1f1] dark:text-[#1f1f1f] dark:hover:bg-white"
                    onClick={() =>
                      void handleRunText(
                        activeCanvasNode.node,
                        activeTextComposerDraft,
                        promptSourceTexts,
                      )
                    }
                    disabled={runningNodeId === activeCanvasNode.node.id}
                    title={copy.optimizeTextWithModel}
                  >
                    {runningNodeId === activeCanvasNode.node.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ) : null}

            {activeCanvasNode.kind === "image" ? (
              <div className="grid gap-2">
                {composerReferenceCards}
                {composerReferenceCards ? (
                  <div className="h-px bg-black/8 dark:bg-white/10" />
                ) : null}
                <textarea
                  ref={imagePromptInputRef}
                  value={activeCanvasNode.node.prompt}
                  onChange={(event) =>
                    updateImageNode(activeCanvasNode.node.id, {
                      prompt: event.target.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      void handleRunImage(
                        activeCanvasNode.node,
                        promptSourceTexts,
                        referenceImages,
                      );
                    }
                  }}
                  placeholder={copy.imageComposerPlaceholder}
                  className={COMPOSER_TEXTAREA_CLASS}
                />
                <div className="flex w-full items-end gap-2.5">
                  <div className="min-w-0 flex-1">
                    <CanvasComposerImageControls
                      modelValue={getConfiguredNodeModelValue(
                        "image",
                        activeCanvasNode.node.model,
                      )}
                      modelOptions={imageNodeModelOptions}
                      aspectRatio={activeCanvasNode.node.size}
                      onChange={(patch) =>
                        updateImageNode(activeCanvasNode.node.id, patch)
                      }
                      onRequestAddModel={() =>
                        openAddModelDialogFromComposer("image")
                      }
                      dropdownContainer={composerPanelElement}
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-9 w-9 shrink-0 rounded-full bg-[#111111] p-0 text-white hover:bg-[#000000] dark:bg-[#f1f1f1] dark:text-[#1f1f1f] dark:hover:bg-white"
                    onClick={() =>
                      void handleRunImage(
                        activeCanvasNode.node,
                        promptSourceTexts,
                        referenceImages,
                      )
                    }
                    disabled={runningNodeId === activeCanvasNode.node.id}
                    title={copy.runImagePromptTitle}
                  >
                    {runningNodeId === activeCanvasNode.node.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ) : null}

            {activeCanvasNode.kind === "video" ? (
              <div className="grid gap-2">
                {composerReferenceCards}
                {composerReferenceCards ? (
                  <div className="h-px bg-black/8 dark:bg-white/10" />
                ) : null}
                <textarea
                  ref={videoPromptInputRef}
                  value={activeCanvasNode.node.prompt}
                  onChange={(event) =>
                    updateVideoNode(activeCanvasNode.node.id, {
                      prompt: event.target.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      void handleRunVideo(
                        activeCanvasNode.node,
                        promptSourceTexts,
                        primaryVideoInputs,
                      );
                    }
                  }}
                  placeholder={copy.videoComposerPlaceholder}
                  className={COMPOSER_TEXTAREA_CLASS}
                />
                <div className="flex w-full items-end gap-2.5">
                  <div className="min-w-0 flex-1">
                    <CanvasComposerVideoControls
                      modelValue={getConfiguredNodeModelValue(
                        "video",
                        activeCanvasNode.node.model,
                      )}
                      modelOptions={videoNodeModelOptions}
                      durationSeconds={activeCanvasNode.node.durationSeconds}
                      size={activeCanvasNode.node.size}
                      onChange={(patch) =>
                        updateVideoNode(activeCanvasNode.node.id, patch)
                      }
                      onRequestAddModel={() =>
                        openAddModelDialogFromComposer("video")
                      }
                      dropdownContainer={composerPanelElement}
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-9 w-9 shrink-0 rounded-full bg-[#111111] p-0 text-white hover:bg-[#000000] dark:bg-[#f1f1f1] dark:text-[#1f1f1f] dark:hover:bg-white"
                    onClick={() =>
                      void handleRunVideo(
                        activeCanvasNode.node,
                        promptSourceTexts,
                        primaryVideoInputs,
                      )
                    }
                    disabled={runningNodeId === activeCanvasNode.node.id}
                    title={copy.runVideoPromptTitle}
                  >
                    {runningNodeId === activeCanvasNode.node.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <CanvasWorkspaceZoomControls
        zoom={viewportState.zoom}
        mapOpen={showMiniMap}
        onFitView={() => {
          flowSurfaceRef.current?.fitView({ duration: 180, padding: 0.16 });
        }}
        onToggleMap={() => setShowMiniMap((current) => !current)}
        onZoomOut={() => {
          flowSurfaceRef.current?.zoomTo(
            clamp(viewportState.zoom / 1.2, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM),
            { duration: 120 },
          );
        }}
        onZoomIn={() => {
          flowSurfaceRef.current?.zoomTo(
            clamp(viewportState.zoom * 1.2, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM),
            { duration: 120 },
          );
        }}
      />

      <Dialog
        open={nodeUploadDialogOpen}
        onOpenChange={(open) => {
          if (uploadingNodeMedia || submittingNodeUploadUrl) {
            return;
          }

          setNodeUploadDialogOpen(open);
          if (!open) {
            setNodeUploadUrlDraft("");
          }
        }}
      >
        <DialogContent className="[&>button]:hidden max-w-[456px] gap-0 rounded-[16px] border-0 bg-white/98 p-0 shadow-[0_28px_70px_-34px_rgba(15,23,42,0.34)]">
          <DialogHeader className="border-b border-black/5 px-5 py-4 dark:border-white/8">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>
                {nodeUploadTarget?.kind === "video"
                  ? copy.addVideoTitle
                  : copy.addImageTitle}
              </DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label={copy.close}
                  disabled={uploadingNodeMedia || submittingNodeUploadUrl}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5f6774] transition-colors hover:bg-black/[0.04] disabled:pointer-events-none disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/6"
                >
                  <X className="h-5 w-5" />
                </button>
              </DialogClose>
            </div>
            <DialogDescription className="pr-1">
              {copy.nodeUploadDialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 px-5 py-4">
            <button
              type="button"
              className="flex items-center gap-3 rounded-[12px] bg-[#f3f4f6] px-4 py-3.5 text-left transition-colors hover:bg-[#eceff3] dark:bg-[#171d25] dark:hover:bg-[#1d2530]"
              onClick={handleChooseLocalNodeUpload}
              disabled={
                uploadingNodeMedia ||
                submittingNodeUploadUrl ||
                !nodeUploadTarget
              }
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/90 text-[#1f2937] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.24)] dark:bg-[#222b37] dark:text-white">
                <Upload className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {copy.uploadFromDevice}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {nodeUploadTarget?.kind === "video"
                    ? copy.selectLocalVideoFile
                    : copy.selectLocalImageFile}
                </span>
              </span>
            </button>

            <div className="rounded-[12px] bg-[#f3f4f6] p-4 dark:bg-[#171d25]">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/90 text-[#1f2937] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.24)] dark:bg-[#222b37] dark:text-white">
                  <Link2 className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {copy.insertViaUrl}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {nodeUploadTarget?.kind === "video"
                      ? copy.pasteDirectVideoUrl
                      : copy.pasteDirectImageUrl}
                  </div>
                </div>
              </div>
              <Input
                value={nodeUploadUrlDraft}
                onChange={(event) => setNodeUploadUrlDraft(event.target.value)}
                placeholder={
                  nodeUploadTarget?.kind === "video"
                    ? "https://example.com/video.mp4"
                    : "https://example.com/image.png"
                }
                className="h-11 rounded-[10px] border-0 bg-white/92 shadow-none ring-0 dark:bg-[#222b37]"
              />
              {normalizedNodeUploadPreviewUrl ? (
                <div className="mt-3 overflow-hidden rounded-[12px] bg-white/92 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-[#11161d] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>{copy.preview}</span>
                    <span className="truncate pl-3 normal-case tracking-normal">
                      {nodeUploadTarget?.kind === "video"
                        ? copy.videoUrlLabel
                        : copy.imageUrlLabel}
                    </span>
                  </div>
                  {nodeUploadTarget?.kind === "video" ? (
                    <video
                      key={normalizedNodeUploadPreviewUrl}
                      src={normalizedNodeUploadPreviewUrl}
                      className="max-h-[220px] w-full bg-black object-contain"
                      controls
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={normalizedNodeUploadPreviewUrl}
                      src={normalizedNodeUploadPreviewUrl}
                      alt={copy.urlPreviewAlt}
                      className="max-h-[220px] w-full object-contain"
                    />
                  )}
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  className="h-9 rounded-[10px] bg-[#111111] px-4 text-white hover:bg-black dark:bg-white dark:text-[#111111] dark:hover:bg-white"
                  onClick={() => {
                    void handleInsertNodeUrl();
                  }}
                  disabled={
                    uploadingNodeMedia ||
                    submittingNodeUploadUrl ||
                    !nodeUploadTarget ||
                    nodeUploadUrlDraft.trim().length === 0
                  }
                >
                  {submittingNodeUploadUrl ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {copy.insertUrl}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={videoInputRequirementDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setVideoInputRequirementDialog({
              open: false,
              providerLabel: "",
            });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.accessibleImageUrlTitle}</DialogTitle>
            <DialogDescription>
              {videoInputRequirementDialog.providerLabel
                ? formatCopy(copy.providerAccessibleImageUrlDescription, {
                    provider: videoInputRequirementDialog.providerLabel,
                  })
                : copy.genericAccessibleImageUrlDescription}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-6 text-muted-foreground">
            {copy.accessibleImageUrlBody}
          </p>
          <DialogFooter className="gap-2">
            <Button
              onClick={() =>
                setVideoInputRequirementDialog({
                  open: false,
                  providerLabel: "",
                })
              }
            >
              {copy.understood}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (deletingCanvasNodes) {
            return;
          }

          if (!open) {
            setDeleteDialog({
              open: false,
              nodeIds: [],
              databaseTargets: EMPTY_DATABASE_TARGETS,
            });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.deleteGeneratedImageTitle}</DialogTitle>
            <DialogDescription>
              {deleteDialog.nodeIds.length > 1
                ? copy.deleteGeneratedImagesDescription
                : copy.deleteGeneratedImageDescription}
            </DialogDescription>
          </DialogHeader>

          {deleteDialog.databaseTargets.length > 0 ? (
            <label className="flex items-start gap-3 rounded-[16px] border border-border/70 bg-muted/30 px-4 py-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={deleteFromDatabase}
                onChange={(event) =>
                  setDeleteFromDatabase(event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-border/70"
              />
              <span>{copy.alsoDeleteFromDatabase}</span>
            </label>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setDeleteDialog({
                  open: false,
                  nodeIds: [],
                  databaseTargets: EMPTY_DATABASE_TARGETS,
                })
              }
              disabled={deletingCanvasNodes}
            >
              {copy.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                void executeCanvasNodeDeletion({
                  nodeIds: deleteDialog.nodeIds,
                  databaseTargets: deleteDialog.databaseTargets,
                  deleteFromDatabase,
                })
              }
              disabled={deletingCanvasNodes}
            >
              {deletingCanvasNodes ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {copy.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CanvasAssetImportDialog
        open={importDialogOpen}
        projectId={projectId}
        getImportAnchorPosition={getViewportCenterPosition}
        onOpenChange={setImportDialogOpen}
        onImported={() => {
          void loadGraph({ background: true }).catch((error) => {
            console.error("Failed to refresh canvas after import:", error);
            addToast(copy.importFailed, "error");
          });
        }}
      />
      {confirmDialog}
    </div>
  );
}

function CanvasNodeCreationMenu({
  menuRef,
  position,
  options,
  onSelect,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  position: {
    left: number;
    top: number;
  };
  options: Array<{
    kind: CanvasNodeKind;
    label: string;
    description: string;
    icon: LucideIcon;
  }>;
  onSelect: (kind: CanvasNodeKind) => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);

  return (
    <div
      ref={menuRef}
      data-canvas-zoom-relay=""
      className="absolute z-50 w-[248px] rounded-[18px] border border-black/8 bg-white/96 p-2 shadow-[0_28px_64px_-36px_rgba(15,23,42,0.3)] backdrop-blur dark:border-white/10 dark:bg-[#10161d]/96"
      style={position}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {copy.createNodeTitle}
      </div>
      <div className="flex flex-col gap-1">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.kind}
              type="button"
              className="flex items-center gap-3 rounded-[12px] px-3 py-3 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              onClick={() => onSelect(option.kind)}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#f3f5f8] text-[#4565f4] dark:bg-[#182130] dark:text-[#8da7ff]">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground dark:text-slate-100">
                  {option.label}
                </div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function areListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function resolveCanvasNodeReference(graph: GraphPayload, value: string) {
  const parsed = parseFlowNodeId(value);
  if (parsed) {
    return parsed;
  }

  if (graph.textNodes.some((node) => node.id === value)) {
    return { kind: "text" as const, id: value };
  }

  if (graph.imageNodes.some((node) => node.id === value)) {
    return { kind: "image" as const, id: value };
  }

  if (graph.videoNodes.some((node) => node.id === value)) {
    return { kind: "video" as const, id: value };
  }

  return null;
}

function removeGenerationImagesFromList<
  T extends {
    id: string;
    result_urls: string[] | null;
  },
>(
  items: T[],
  targets: Array<{
    generationId: string;
    imageIndex: number;
  }>,
) {
  const targetMap = new Map<string, Set<number>>();
  for (const target of targets) {
    if (!targetMap.has(target.generationId)) {
      targetMap.set(target.generationId, new Set());
    }
    targetMap.get(target.generationId)?.add(target.imageIndex);
  }

  return items.flatMap((item) => {
    const indexes = targetMap.get(item.id);
    if (!indexes) {
      return [item];
    }

    const nextUrls = (item.result_urls ?? []).filter(
      (_url, index) => !indexes.has(index),
    );
    if (nextUrls.length === 0) {
      return [];
    }

    return [
      {
        ...item,
        result_urls: nextUrls,
      },
    ];
  });
}
