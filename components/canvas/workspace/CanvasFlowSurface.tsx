"use client";

import { useMessages } from "next-intl";
import {
  type ForwardedRef,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  Position,
  ReactFlow,
  getBezierPath,
  useEdgesState,
  useNodesState,
  type Connection,
  type HandleType,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import {
  canvasWorkspaceEdgeTypes,
  canvasWorkspaceNodeTypes,
} from "@/components/canvas/workspace/graph-elements";
import {
  CANVAS_NODE_DRAG_MIME,
  CANVAS_SOURCE_HANDLE_ID,
  CANVAS_TARGET_HANDLE_ID,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  getCanvasLinkRelationForKinds,
  getFlowNodeId,
  getInsertKindsForEdge,
  getQuickCreateOptionsForNode,
  getTextNodeSummary,
  normalizeNodeIdList,
  parseFlowNodeId,
  type CanvasConnectionTargetHighlight,
  type CanvasConnectionTargetSide,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasQuickCreateOption,
  type GraphPayload,
} from "@/components/canvas/workspace/shared";
import { getCanvasPageCopy } from "@/lib/canvas/copy";
import type { AppMessages } from "@/i18n/messages";
import type { CanvasLink, CanvasNodeKind } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type CanvasPendingConnectionPreview = {
  sourceFlowPosition: { x: number; y: number };
  sourceHandlePosition: Position;
  targetFlowPosition: { x: number; y: number };
};

function getClientPoint(
  event:
    | MouseEvent
    | TouchEvent
    | ReactDragEvent<HTMLDivElement>
    | ReactMouseEvent<Element>,
) {
  if ("clientX" in event && typeof event.clientX === "number") {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  if (!("changedTouches" in event)) {
    return null;
  }

  const touch = event.changedTouches?.[0] ?? event.touches?.[0];

  if (!touch) {
    return null;
  }

  return {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function getOppositePosition(position: Position) {
  switch (position) {
    case Position.Left:
      return Position.Right;
    case Position.Right:
      return Position.Left;
    case Position.Top:
      return Position.Bottom;
    case Position.Bottom:
      return Position.Top;
    default:
      return Position.Right;
  }
}

function isCanvasNodeKind(value: string): value is CanvasNodeKind {
  return value === "text" || value === "image" || value === "video";
}

export type CanvasFlowSurfaceHandle = {
  ensureNodeVisible: (flowNodeId: string) => void;
  fitView: (options?: { duration?: number; padding?: number }) => void;
  getContainerScreenRect: () => DOMRect | null;
  getNodeScreenRect: (
    flowNodeId: string,
  ) => { height: number; left: number; top: number; width: number } | null;
  getViewportCenterPosition: () => { x: number; y: number };
  zoomAtClientPoint: (
    clientPoint: { x: number; y: number },
    zoom: number,
    options?: { duration?: number },
  ) => void;
  zoomTo: (zoom: number, options?: { duration?: number }) => void;
};

type CanvasFlowSurfaceProps = {
  graph: GraphPayload;
  imageLabelMap: Map<string, string>;
  primaryToolMode: "select" | "hand";
  runningTextNodeId: string | null;
  runningImageNodeId: string | null;
  runningImageProgress: number | null;
  runningVideoNodeId: string | null;
  runningVideoProgress: number | null;
  onConnectionTargetHighlightChange: (
    highlight: CanvasConnectionTargetHighlight | null,
  ) => void;
  selectedEdgeIds: string[];
  selectedFlowNodeIds: string[];
  showMiniMap: boolean;
  themeMode: "light" | "dark";
  onConnect: (connection: Connection) => void;
  onDeleteEdge: (edgeId: string) => void;
  onImageNodeResize: (nodeId: string, width: number, height: number) => void;
  onImageNodeReplace: (nodeId: string, file: File) => Promise<void>;
  onImageNodeRequestUpload: (nodeId: string) => void;
  onInsertNodeFromEdge: (edgeId: string, kind: CanvasNodeKind) => void;
  onLooseConnectionRequest: (params: {
    position: { x: number; y: number };
    sourceFlowId: string;
    sourceFlowPosition: { x: number; y: number };
    sourceHandlePosition: Position;
    sourceHandleType: HandleType;
  }) => void;
  onNodeDragStop: OnNodeDrag<CanvasFlowNode>;
  onNodeDrop: (kind: CanvasNodeKind, position: { x: number; y: number }) => void;
  onPaneCreateNodeRequest: (position: { x: number; y: number }) => void;
  onQuickCreateFromNode: (
    sourceKind: CanvasNodeKind,
    sourceId: string,
    option: CanvasQuickCreateOption,
  ) => void;
  onDuplicateTextNode: (nodeId: string) => void;
  onFocusTextComposer: (nodeId: string) => void;
  onSelectionChange: (params: { edgeIds: string[]; nodeIds: string[] }) => void;
  onTextNodeContentChange: (nodeId: string, nextContent: string) => void;
  onTextNodeResize: (nodeId: string, width: number, height: number) => void;
  onTextNodeUpdate: (
    nodeId: string,
    patch: Partial<GraphPayload["textNodes"][number]>,
  ) => void;
  onVideoNodeResize: (nodeId: string, width: number, height: number) => void;
  onVideoNodeRequestUpload: (nodeId: string) => void;
  onVideoNodeUpdate: (
    nodeId: string,
    patch: Partial<GraphPayload["videoNodes"][number]>,
  ) => void;
  onViewportChange: (viewport: Viewport) => void;
  onViewportPersist: (viewport: Viewport) => void;
  pendingConnectionPreview: CanvasPendingConnectionPreview | null;
  viewport: Viewport;
};

function getFlowNodeRect(node: CanvasFlowNode) {
  const width =
    node.width ?? (typeof node.style?.width === "number" ? node.style.width : 256);
  const height =
    node.height ?? (typeof node.style?.height === "number" ? node.style.height : 176);

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
}

function mergeFlowNodesWithSelection(
  next: CanvasFlowNode[],
  selectedIds: string[],
) {
  const selectedIdSet = new Set(selectedIds);

  return next.map((node) => ({
    ...node,
    selected: selectedIdSet.has(node.id),
  }));
}

function mergeFlowEdgesWithSelection(
  next: CanvasFlowEdge[],
  selectedIds: string[],
) {
  const selectedIdSet = new Set(selectedIds);

  return next.map((edge) => ({
    ...edge,
    selected: selectedIdSet.has(edge.id),
  }));
}

function CanvasFlowSurfaceComponent(
  {
    graph,
    imageLabelMap,
    primaryToolMode,
    runningTextNodeId,
    runningImageNodeId,
    runningImageProgress,
    runningVideoNodeId,
    runningVideoProgress,
    onConnectionTargetHighlightChange,
    selectedEdgeIds,
    selectedFlowNodeIds,
    showMiniMap,
    themeMode,
    onConnect,
    onDeleteEdge,
    onImageNodeResize,
    onImageNodeReplace,
    onImageNodeRequestUpload,
    onInsertNodeFromEdge,
    onLooseConnectionRequest,
    onNodeDragStop,
    onNodeDrop,
    onPaneCreateNodeRequest,
    onQuickCreateFromNode,
    onDuplicateTextNode,
    onFocusTextComposer,
    onSelectionChange,
    onTextNodeContentChange,
    onTextNodeResize,
    onTextNodeUpdate,
    onVideoNodeResize,
    onVideoNodeRequestUpload,
    onVideoNodeUpdate,
    onViewportChange,
    onViewportPersist,
    pendingConnectionPreview,
    viewport,
  }: CanvasFlowSurfaceProps,
  ref: ForwardedRef<CanvasFlowSurfaceHandle>,
  ) {
    const messages = useMessages() as AppMessages;
    const copy = getCanvasPageCopy(messages);
    const quickCreateLabels = useMemo(
      () => ({
        nodeTextLabel: copy.nodeTextLabel,
        nodeImageLabel: copy.nodeImageLabel,
        nodeVideoLabel: copy.nodeVideoLabel,
        referenceImageNodeLabel: copy.referenceImageNodeLabel,
      }),
      [
        copy.nodeImageLabel,
        copy.nodeTextLabel,
        copy.nodeVideoLabel,
        copy.referenceImageNodeLabel,
      ],
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const reactFlowRef = useRef<ReactFlowInstance<CanvasFlowNode, CanvasFlowEdge> | null>(
      null,
    );
    const nodesRef = useRef<CanvasFlowNode[]>([]);
    const edgesRef = useRef<CanvasFlowEdge[]>([]);
    const autoViewportProjectIdRef = useRef<string | null>(null);
    const initialViewportFrameRef = useRef<number | null>(null);
  const [nodes, setNodes] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges] = useEdgesState<CanvasFlowEdge>([]);
  const [activeConnectionSourceFlowId, setActiveConnectionSourceFlowId] =
    useState<string | null>(null);
  const [activeConnectionSourceHandleType, setActiveConnectionSourceHandleType] =
    useState<HandleType | null>(null);
  const [activeConnectionTargetHighlight, setActiveConnectionTargetHighlight] =
    useState<CanvasConnectionTargetHighlight | null>(null);
  const [isMiddleMousePanning, setIsMiddleMousePanning] = useState(false);
  const pendingConnectionPath = useMemo(() => {
    if (!pendingConnectionPreview) {
      return null;
    }

    const { x, y, zoom } = viewport;
    const sourceX = x + pendingConnectionPreview.sourceFlowPosition.x * zoom;
    const sourceY = y + pendingConnectionPreview.sourceFlowPosition.y * zoom;
    const targetX = x + pendingConnectionPreview.targetFlowPosition.x * zoom;
    const targetY = y + pendingConnectionPreview.targetFlowPosition.y * zoom;
    const [path] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition: pendingConnectionPreview.sourceHandlePosition,
      targetX,
      targetY,
      targetPosition: getOppositePosition(
        pendingConnectionPreview.sourceHandlePosition,
      ),
      curvature: 0.24,
    });

    return path;
  }, [pendingConnectionPreview, viewport]);

  const syncSelectionFromElements = useCallback(
    (nextNodes: CanvasFlowNode[], nextEdges: CanvasFlowEdge[]) => {
      onSelectionChange({
        nodeIds: normalizeNodeIdList(
          nextNodes.filter((node) => node.selected).map((node) => node.id),
        ),
        edgeIds: normalizeNodeIdList(
          nextEdges.filter((edge) => edge.selected).map((edge) => edge.id),
        ),
      });
    },
    [onSelectionChange],
  );

  const getViewportCenterPosition = useCallback(() => {
    const flow = reactFlowRef.current;
    const container = containerRef.current;

    if (!flow || !container) {
      return { x: 120, y: 120 };
    }

    const rect = container.getBoundingClientRect();
    return flow.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, []);

  const getNodeScreenRect = useCallback((flowNodeId: string) => {
    const flow = reactFlowRef.current;
    const container = containerRef.current;
    const targetNode = nodesRef.current.find((node) => node.id === flowNodeId);

    if (!flow || !container || !targetNode) {
      return null;
    }

    const viewport = flow.getViewport();
    const containerRect = container.getBoundingClientRect();
    const rect = getFlowNodeRect(targetNode);

    return {
      left: containerRect.left + viewport.x + rect.x * viewport.zoom,
      top: containerRect.top + viewport.y + rect.y * viewport.zoom,
      width: rect.width * viewport.zoom,
      height: rect.height * viewport.zoom,
    };
  }, []);

  const getContainerScreenRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const zoomAtClientPoint = useCallback(
    (
      clientPoint: { x: number; y: number },
      zoom: number,
      options?: { duration?: number },
    ) => {
      const flow = reactFlowRef.current;
      const container = containerRef.current;

      if (!flow || !container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const focusPosition = flow.screenToFlowPosition(clientPoint);
      const clampedZoom = Math.min(
        Math.max(zoom, MIN_CANVAS_ZOOM),
        MAX_CANVAS_ZOOM,
      );
      const localX = clientPoint.x - containerRect.left;
      const localY = clientPoint.y - containerRect.top;
      const nextViewport = {
        x: localX - focusPosition.x * clampedZoom,
        y: localY - focusPosition.y * clampedZoom,
        zoom: clampedZoom,
      };

      void flow.setViewport(nextViewport, options);
      onViewportChange(nextViewport);
    },
    [onViewportChange],
  );

  const ensureNodeVisible = useCallback((flowNodeId: string) => {
    const flow = reactFlowRef.current;
    const container = containerRef.current;
    const targetNode = nodesRef.current.find((node) => node.id === flowNodeId);

    if (!flow || !container || !targetNode) {
      return;
    }

    const viewport = flow.getViewport();
    const rect = getFlowNodeRect(targetNode);
    const margin = 92;
    const screenLeft = viewport.x + rect.x * viewport.zoom;
    const screenTop = viewport.y + rect.y * viewport.zoom;
    const screenRight = screenLeft + rect.width * viewport.zoom;
    const screenBottom = screenTop + rect.height * viewport.zoom;
    let nextViewport = viewport;

    if (screenLeft < margin) {
      nextViewport = {
        ...nextViewport,
        x: nextViewport.x + (margin - screenLeft),
      };
    } else if (screenRight > container.clientWidth - margin) {
      nextViewport = {
        ...nextViewport,
        x: nextViewport.x - (screenRight - (container.clientWidth - margin)),
      };
    }

    if (screenTop < 96) {
      nextViewport = {
        ...nextViewport,
        y: nextViewport.y + (96 - screenTop),
      };
    } else if (screenBottom > container.clientHeight - 240) {
      nextViewport = {
        ...nextViewport,
        y: nextViewport.y - (screenBottom - (container.clientHeight - 240)),
      };
    }

    if (
      nextViewport.x === viewport.x &&
      nextViewport.y === viewport.y &&
      nextViewport.zoom === viewport.zoom
    ) {
      return;
    }

    void flow.setViewport(nextViewport, { duration: 180 });
    onViewportChange(nextViewport);
  }, [onViewportChange]);

  const scheduleInitialViewport = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (autoViewportProjectIdRef.current === graph.project.id) {
      return;
    }

    if (initialViewportFrameRef.current !== null) {
      window.cancelAnimationFrame(initialViewportFrameRef.current);
      initialViewportFrameRef.current = null;
    }

    initialViewportFrameRef.current = window.requestAnimationFrame(() => {
      initialViewportFrameRef.current = window.requestAnimationFrame(() => {
        initialViewportFrameRef.current = null;

        const flow = reactFlowRef.current;
        if (!flow) {
          return;
        }

        if (nodesRef.current.length === 0) {
          autoViewportProjectIdRef.current = graph.project.id;
          return;
        }

        autoViewportProjectIdRef.current = graph.project.id;
        void flow.fitView({
          duration: 220,
          padding: 0.18,
        });
      });
    });
  }, [graph.project.id]);

  useImperativeHandle(
    ref,
    () => ({
      ensureNodeVisible,
      fitView: (options) => {
        void reactFlowRef.current?.fitView({
          duration: options?.duration ?? 180,
          padding: options?.padding ?? 0.16,
        });
      },
      getContainerScreenRect,
      getNodeScreenRect,
      getViewportCenterPosition,
      zoomAtClientPoint,
      zoomTo: (zoom, options) => {
        void reactFlowRef.current?.zoomTo(
          Math.min(Math.max(zoom, MIN_CANVAS_ZOOM), MAX_CANVAS_ZOOM),
          options,
        );
      },
    }),
    [
      ensureNodeVisible,
      getContainerScreenRect,
      getNodeScreenRect,
      getViewportCenterPosition,
      zoomAtClientPoint,
    ],
  );

  const handleNodesChange = useCallback<OnNodesChange<CanvasFlowNode>>(
    (changes) => {
      const nextNodes = applyNodeChanges(changes, nodesRef.current);
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
      syncSelectionFromElements(nextNodes, edgesRef.current);
    },
    [setNodes, syncSelectionFromElements],
  );

  const handleEdgesChange = useCallback<OnEdgesChange<CanvasFlowEdge>>(
    (changes) => {
      const nextEdges = applyEdgeChanges(changes, edgesRef.current);
      edgesRef.current = nextEdges;
      setEdges(nextEdges);
      syncSelectionFromElements(nodesRef.current, nextEdges);
    },
    [setEdges, syncSelectionFromElements],
  );

  const handlePaneClick = useCallback(
    (event: ReactMouseEvent<Element>) => {
      if (primaryToolMode !== "select" || event.detail !== 2) {
        return;
      }

      const flow = reactFlowRef.current;
      const clientPoint = getClientPoint(event);
      if (!flow || !clientPoint) {
        return;
      }

      onPaneCreateNodeRequest(flow.screenToFlowPosition(clientPoint));
    },
    [onPaneCreateNodeRequest, primaryToolMode],
  );

  const handleConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: {
        from: { x: number; y: number } | null;
        fromHandle: {
          type: HandleType;
        } | null;
        fromNode: {
          id: string;
        } | null;
        fromPosition: Position | null;
        toNode: unknown;
      },
    ) => {
      if (primaryToolMode !== "select") {
        return;
      }

      if (
        !connectionState.fromNode ||
        !connectionState.fromHandle ||
        !connectionState.fromPosition ||
        !connectionState.from ||
        connectionState.toNode
      ) {
        return;
      }

      const flow = reactFlowRef.current;
      const clientPoint = getClientPoint(event);
      const containerRect = containerRef.current?.getBoundingClientRect();
      const eventTarget = event.target;
      if (!flow || !clientPoint || !containerRect) {
        return;
      }

      if (
        eventTarget instanceof Element &&
        !eventTarget.closest(".react-flow__pane")
      ) {
        return;
      }

      if (
        clientPoint.x < containerRect.left ||
        clientPoint.x > containerRect.right ||
        clientPoint.y < containerRect.top ||
        clientPoint.y > containerRect.bottom
      ) {
        return;
      }

      onLooseConnectionRequest({
        position: flow.screenToFlowPosition(clientPoint),
        sourceFlowId: connectionState.fromNode.id,
        sourceFlowPosition: connectionState.from,
        sourceHandlePosition: connectionState.fromPosition,
        sourceHandleType: connectionState.fromHandle.type,
      });
    },
    [onLooseConnectionRequest, primaryToolMode],
  );

  const getHighlightedConnectionTarget = useCallback(
    (clientPoint: { x: number; y: number }) => {
      const flow = reactFlowRef.current;
      const containerRect = containerRef.current?.getBoundingClientRect();
      const sourceRef = activeConnectionSourceFlowId
        ? parseFlowNodeId(activeConnectionSourceFlowId)
        : null;

      if (
        !flow ||
        !containerRect ||
        !sourceRef ||
        !activeConnectionSourceHandleType
      ) {
        return null;
      }

      if (
        clientPoint.x < containerRect.left ||
        clientPoint.x > containerRect.right ||
        clientPoint.y < containerRect.top ||
        clientPoint.y > containerRect.bottom
      ) {
        return null;
      }

      const targetHandleSize = 28;
      const targetHandleHalfSize = targetHandleSize / 2;

      for (let index = nodesRef.current.length - 1; index >= 0; index -= 1) {
        const node = nodesRef.current[index];
        if (node.id === activeConnectionSourceFlowId) {
          continue;
        }

        const targetRef = parseFlowNodeId(node.id);
        if (!targetRef) {
          continue;
        }

        const relationType =
          activeConnectionSourceHandleType === "target"
            ? getCanvasLinkRelationForKinds(targetRef.kind, sourceRef.kind)
            : getCanvasLinkRelationForKinds(sourceRef.kind, targetRef.kind);
        if (!relationType) {
          continue;
        }

        const rect = getNodeScreenRect(node.id);
        if (!rect) {
          continue;
        }

        const targetSide: CanvasConnectionTargetSide =
          activeConnectionSourceHandleType === "target" ? "right" : "left";
        const targetHandleLeft =
          targetSide === "right" ? rect.left + rect.width : rect.left - targetHandleSize;
        const targetHandleTop =
          rect.top + rect.height / 2 - targetHandleHalfSize;
        const isInsideTarget =
          clientPoint.x >= targetHandleLeft &&
          clientPoint.x <= targetHandleLeft + targetHandleSize &&
          clientPoint.y >= targetHandleTop &&
          clientPoint.y <= targetHandleTop + targetHandleSize;

        if (isInsideTarget) {
          return {
            flowNodeId: node.id,
            side: targetSide,
          };
        }
      }

      return null;
    },
    [
      activeConnectionSourceFlowId,
      activeConnectionSourceHandleType,
      getNodeScreenRect,
    ],
  );

  useEffect(() => {
    onConnectionTargetHighlightChange(activeConnectionTargetHighlight);
  }, [activeConnectionTargetHighlight, onConnectionTargetHighlightChange]);

  useEffect(() => {
    autoViewportProjectIdRef.current = null;
    if (initialViewportFrameRef.current !== null) {
      window.cancelAnimationFrame(initialViewportFrameRef.current);
      initialViewportFrameRef.current = null;
    }
  }, [graph.project.id]);

  useEffect(() => {
    scheduleInitialViewport();
  }, [nodes.length, scheduleInitialViewport]);

  useEffect(() => {
    return () => {
      if (initialViewportFrameRef.current !== null) {
        window.cancelAnimationFrame(initialViewportFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const resetMiddleMousePanning = () => {
      setIsMiddleMousePanning(false);
    };

    window.addEventListener("pointerup", resetMiddleMousePanning);
    window.addEventListener("pointercancel", resetMiddleMousePanning);
    window.addEventListener("blur", resetMiddleMousePanning);

    return () => {
      window.removeEventListener("pointerup", resetMiddleMousePanning);
      window.removeEventListener("pointercancel", resetMiddleMousePanning);
      window.removeEventListener("blur", resetMiddleMousePanning);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !isMiddleMousePanning) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [isMiddleMousePanning]);

  useEffect(() => {
    if (!activeConnectionSourceFlowId) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const clientPoint = getClientPoint(event);
      if (!clientPoint) {
        return;
      }

      const nextTargetHighlight = getHighlightedConnectionTarget(clientPoint);
      setActiveConnectionTargetHighlight((current) =>
        current?.flowNodeId === nextTargetHighlight?.flowNodeId &&
        current?.side === nextTargetHighlight?.side
          ? current
          : nextTargetHighlight,
      );
    };

    const handleTouchMove = (event: TouchEvent) => {
      const clientPoint = getClientPoint(event);
      if (!clientPoint) {
        return;
      }

      const nextTargetHighlight = getHighlightedConnectionTarget(clientPoint);
      setActiveConnectionTargetHighlight((current) =>
        current?.flowNodeId === nextTargetHighlight?.flowNodeId &&
        current?.side === nextTargetHighlight?.side
          ? current
          : nextTargetHighlight,
      );
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [activeConnectionSourceFlowId, getHighlightedConnectionTarget]);

  const handleDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(CANVAS_NODE_DRAG_MIME)) {
      return;
    }

    if (
      event.target instanceof Element &&
      !event.target.closest(".react-flow__pane")
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const kind = event.dataTransfer.getData(CANVAS_NODE_DRAG_MIME);
      const flow = reactFlowRef.current;
      const clientPoint = getClientPoint(event);
      if (
        !flow ||
        !clientPoint ||
        !isCanvasNodeKind(kind) ||
        (event.target instanceof Element &&
          !event.target.closest(".react-flow__pane"))
      ) {
        return;
      }

      event.preventDefault();
      onNodeDrop(kind, flow.screenToFlowPosition(clientPoint));
    },
    [onNodeDrop],
  );

  useEffect(() => {
    const selectedFlowNodeIdSet = new Set(selectedFlowNodeIds);
    const nextNodes: CanvasFlowNode[] = [
      ...graph.textNodes.map((node) => ({
        id: getFlowNodeId("text", node.id),
        type: "canvasText",
        position: { x: node.x, y: node.y },
        initialWidth: node.width,
        initialHeight: node.height,
        style: {
          width: node.width,
          height: node.height,
        },
        data: {
          textNode: node,
          summary: getTextNodeSummary(node.content),
          isRunning: runningTextNodeId === node.id,
          connectionTargetHighlightSide:
            activeConnectionTargetHighlight?.flowNodeId ===
            getFlowNodeId("text", node.id)
              ? activeConnectionTargetHighlight.side
              : null,
          onResizeEnd: onTextNodeResize,
          onContentChange: onTextNodeContentChange,
          onUpdate: onTextNodeUpdate,
          onDuplicate: onDuplicateTextNode,
          onFocusComposer: onFocusTextComposer,
          quickCreateOptions: getQuickCreateOptionsForNode(
            "text",
            quickCreateLabels,
          ),
          onQuickCreate: (option: CanvasQuickCreateOption) =>
            onQuickCreateFromNode("text", node.id, option),
        },
        draggable: primaryToolMode === "select",
        selectable: primaryToolMode === "select",
      })),
      ...graph.imageNodes.map((node) => ({
        id: getFlowNodeId("image", node.id),
        type: "canvasImage",
        position: { x: node.x, y: node.y },
        initialWidth: node.width,
        initialHeight: node.height,
        style: {
          width: node.width,
          height: node.height,
        },
        data: {
          imageNode: node,
          nodeLabel: imageLabelMap.get(node.id) ?? copy.nodeImageLabel,
          isRunning: runningImageNodeId === node.id,
          generationProgress:
            runningImageNodeId === node.id ? runningImageProgress : null,
          connectionTargetHighlightSide:
            activeConnectionTargetHighlight?.flowNodeId ===
            getFlowNodeId("image", node.id)
              ? activeConnectionTargetHighlight.side
              : null,
          onResizeEnd: onImageNodeResize,
          onReplaceImage: onImageNodeReplace,
          onRequestUpload: onImageNodeRequestUpload,
          quickCreateOptions: getQuickCreateOptionsForNode(
            "image",
            quickCreateLabels,
          ),
          onQuickCreate: (option: CanvasQuickCreateOption) =>
            onQuickCreateFromNode("image", node.id, option),
        },
        draggable: primaryToolMode === "select",
        selectable: primaryToolMode === "select",
      })),
      ...graph.videoNodes.map((node) => ({
        id: getFlowNodeId("video", node.id),
        type: "canvasVideo",
        position: { x: node.x, y: node.y },
        initialWidth: node.width,
        initialHeight: node.height,
        style: {
          width: node.width,
          height: node.height,
        },
        data: {
          videoNode: node,
          primarySourceLabel:
            graph.links
              .filter(
                (link) =>
                  link.target_kind === "video" &&
                  link.target_id === node.id &&
                  link.relation_type === "primary" &&
                  link.source_kind === "image",
              )
              .map((link) => imageLabelMap.get(link.source_id))
              .find((label): label is string => !!label) ?? null,
          isRunning: runningVideoNodeId === node.id,
          generationProgress:
            runningVideoNodeId === node.id ? runningVideoProgress : null,
          connectionTargetHighlightSide:
            activeConnectionTargetHighlight?.flowNodeId ===
            getFlowNodeId("video", node.id)
              ? activeConnectionTargetHighlight.side
              : null,
          onResizeEnd: onVideoNodeResize,
          onRequestUpload: onVideoNodeRequestUpload,
          onUpdate: onVideoNodeUpdate,
        },
        draggable: primaryToolMode === "select",
        selectable: primaryToolMode === "select",
      })),
    ];

    const nextEdges: CanvasFlowEdge[] = graph.links
      .filter(
        (
          link,
        ): link is CanvasLink & {
          source_kind: CanvasNodeKind;
          target_kind: CanvasNodeKind;
        } => link.source_kind !== "operation" && link.target_kind !== "operation",
      )
      .map((link) => ({
        id: link.id,
        type: "canvasGraph",
        source: getFlowNodeId(link.source_kind, link.source_id),
        sourceHandle: CANVAS_SOURCE_HANDLE_ID,
        target: getFlowNodeId(link.target_kind, link.target_id),
        targetHandle: CANVAS_TARGET_HANDLE_ID,
        data: {
          isConnectedToSelectedNode:
            selectedFlowNodeIdSet.has(
              getFlowNodeId(link.source_kind, link.source_id),
            ) ||
            selectedFlowNodeIdSet.has(
              getFlowNodeId(link.target_kind, link.target_id),
            ),
          relationType: link.relation_type,
          sourceKind: link.source_kind,
          targetKind: link.target_kind,
          insertKinds: getInsertKindsForEdge(link.source_kind, link.target_kind),
          onDelete: onDeleteEdge,
          onInsertNode: onInsertNodeFromEdge,
        },
      }));

    const mergedNodes = mergeFlowNodesWithSelection(nextNodes, selectedFlowNodeIds);
    const mergedEdges = mergeFlowEdgesWithSelection(nextEdges, selectedEdgeIds);

    nodesRef.current = mergedNodes;
    edgesRef.current = mergedEdges;
    setNodes(mergedNodes);
    setEdges(mergedEdges);
  }, [
    graph,
    activeConnectionTargetHighlight,
    imageLabelMap,
    onDeleteEdge,
    onDuplicateTextNode,
    onFocusTextComposer,
    onImageNodeReplace,
    onImageNodeResize,
    onImageNodeRequestUpload,
    onInsertNodeFromEdge,
    onQuickCreateFromNode,
    onTextNodeContentChange,
    onTextNodeResize,
    onTextNodeUpdate,
    onVideoNodeResize,
    onVideoNodeRequestUpload,
    onVideoNodeUpdate,
    primaryToolMode,
    copy.nodeImageLabel,
    quickCreateLabels,
    runningImageNodeId,
    runningImageProgress,
    runningTextNodeId,
    runningVideoNodeId,
    runningVideoProgress,
    selectedEdgeIds,
    selectedFlowNodeIds,
    setEdges,
    setNodes,
  ]);

  return (
    <div
      ref={containerRef}
      data-canvas-zoom-relay=""
      className={cn(
        "absolute inset-0",
        primaryToolMode === "hand"
          ? "[&_.react-flow__pane]:cursor-grab [&_.react-flow__viewport]:cursor-grab"
          : null,
        isMiddleMousePanning
          ? "[&_*]:!cursor-grabbing [&_.react-flow__pane]:!cursor-grabbing [&_.react-flow__viewport]:!cursor-grabbing"
          : null,
      )}
      onMouseDownCapture={(event) => {
        if (event.button === 1) {
          event.preventDefault();
          setIsMiddleMousePanning(true);
        }
      }}
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault();
        }
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        key={graph.project.id}
        nodes={nodes}
        edges={edges}
        nodeTypes={canvasWorkspaceNodeTypes}
        edgeTypes={canvasWorkspaceEdgeTypes}
        defaultViewport={
          (graph.project.viewport_json as Viewport | undefined) ?? undefined
        }
        onInit={(instance) => {
          reactFlowRef.current = instance;
          onViewportChange(instance.getViewport());
          scheduleInitialViewport();
        }}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnectStart={(_, params) => {
          if (primaryToolMode !== "select") {
            return;
          }

          setActiveConnectionSourceFlowId(params.nodeId ?? null);
          setActiveConnectionSourceHandleType(params.handleType ?? null);
          setActiveConnectionTargetHighlight(null);
        }}
        onConnect={onConnect}
        onConnectEnd={(event, connectionState) => {
          setActiveConnectionSourceFlowId(null);
          setActiveConnectionSourceHandleType(null);
          setActiveConnectionTargetHighlight(null);
          handleConnectEnd(event, connectionState);
        }}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={handlePaneClick}
        onMove={(_, viewport) => onViewportChange(viewport)}
        onMoveEnd={(_, viewport) => onViewportPersist(viewport)}
        deleteKeyCode={null}
        elementsSelectable={primaryToolMode === "select"}
        nodesDraggable={primaryToolMode === "select"}
        nodesConnectable={primaryToolMode === "select"}
        edgesFocusable={primaryToolMode === "select"}
        panOnDrag={primaryToolMode === "hand" ? [0, 1] : [1]}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch
        selectionOnDrag={primaryToolMode === "select"}
        minZoom={MIN_CANVAS_ZOOM}
        maxZoom={MAX_CANVAS_ZOOM}
        proOptions={{ hideAttribution: true }}
        className="bg-[#f5f5f5]"
      >
        <Background
          gap={28}
          size={1}
          color="rgba(15,23,42,0.16)"
          className="bg-[#f5f5f5]"
        />
        {showMiniMap ? (
          <MiniMap
            style={{ width: 220, height: 164 }}
            pannable
            zoomable
            position="bottom-right"
            offsetScale={1}
            maskColor={themeMode === "dark" ? "rgba(15, 23, 42, 0.54)" : "transparent"}
            maskStrokeColor={themeMode === "dark" ? "#d6dee8" : "#aab4c2"}
            maskStrokeWidth={1.3}
            bgColor={themeMode === "dark" ? "#10161d" : "rgba(255, 255, 255, 0.6)"}
            nodeColor={(node) =>
              node.type === "canvasText"
                ? "#dbc58f"
                : node.type === "canvasVideo"
                  ? "#233041"
                  : "#dce4f3"
            }
            nodeStrokeColor={(node) =>
              node.type === "canvasText"
                ? "#b58a3b"
                : node.type === "canvasVideo"
                  ? "#58739d"
                  : "#90a3c6"
            }
            nodeStrokeWidth={1}
            nodeBorderRadius={6}
            className="!bottom-[44px] !right-[4px] max-w-[calc(100vw-10px)] overflow-hidden !rounded-[18px] !border !border-black/6 !bg-white/60 !shadow-[0_20px_40px_-32px_rgba(15,23,42,0.16)] !backdrop-blur-md [&>svg]:origin-center [&>svg]:scale-[0.9] dark:!border-white/10 dark:!bg-[#10161d] dark:!shadow-[0_22px_42px_-30px_rgba(0,0,0,0.72)]"
          />
        ) : null}
      </ReactFlow>
      {pendingConnectionPath ? (
        <svg className="pointer-events-none absolute inset-0 z-20 overflow-visible">
          <path
            d={pendingConnectionPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.98}
          />
        </svg>
      ) : null}
    </div>
  );
}

export const CanvasFlowSurface = memo(
  forwardRef<CanvasFlowSurfaceHandle, CanvasFlowSurfaceProps>(
    CanvasFlowSurfaceComponent,
  ),
);
