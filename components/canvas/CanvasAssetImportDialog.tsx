"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMessages } from "next-intl";
import { Check, ImageIcon, Loader2, Trash2, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SessionImage } from "@/components/ui/session-image";
import {
  deleteGenerationAsset,
  importCanvasAssets,
  listCanvasGenerations,
} from "@/lib/canvas/api";
import { getCanvasPageCopy } from "@/lib/canvas/copy";
import { getImageDimensionsFromUrl } from "@/lib/canvas/client-image-dimensions";
import { inferMediaKindFromUrl } from "@/lib/media/media-url";
import type { AppMessages } from "@/i18n/messages";

type AssetOption = {
  id: string;
  kind: "image" | "video";
  mediaUrl: string;
  posterUrl: string | null;
  generationId: string;
  resultIndex: number;
  prompt: string;
};

function getVideoDimensionsFromUrl(videoUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const video = document.createElement("video");
    const handleLoadedMetadata = () => {
      cleanup();
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };
    const handleError = () => {
      cleanup();
      reject(new Error("canvas_video_dimensions_failed"));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("error", handleError);
      video.src = "";
      video.load();
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", handleError);
    video.src = videoUrl;
  });
}

type CanvasAssetImportDialogProps = {
  open: boolean;
  projectId: string;
  getImportAnchorPosition?: () => { x: number; y: number };
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export function CanvasAssetImportDialog({
  open,
  projectId,
  getImportAnchorPosition,
  onOpenChange,
  onImported,
}: CanvasAssetImportDialogProps) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listCanvasGenerations({ limit: 80 });

      const nextAssets =
        items.flatMap((generation) =>
          (generation.result_urls ?? []).map((resultUrl, index) => ({
            id: `${generation.id}:${index}`,
            kind: inferMediaKindFromUrl(resultUrl),
            mediaUrl: resultUrl,
            posterUrl: null,
            generationId: generation.id,
            resultIndex: index,
            prompt: generation.prompt,
          })),
        ) ?? [];

      setAssets(nextAssets);
    } catch (error) {
      console.error("Failed to load assets for canvas import:", error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      return;
    }

    void loadAssets();

    return undefined;
  }, [loadAssets, open]);

  const selectionLabel = useMemo(
    () => copy.assetSelection.replace("{count}", String(selectedIds.length)),
    [copy.assetSelection, selectedIds.length],
  );

  const toggleSelection = (assetId: string) => {
    setSelectedIds((current) =>
      current.includes(assetId)
        ? current.filter((item) => item !== assetId)
        : [...current, assetId],
    );
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    setImporting(true);
    try {
      const selectedAssets = assets
        .filter((asset) => selectedIds.includes(asset.id))
        .map(async (asset) => {
          const dimensions =
            asset.kind === "image"
              ? await getImageDimensionsFromUrl(asset.mediaUrl).catch(() => null)
              : await getVideoDimensionsFromUrl(asset.mediaUrl).catch(() => null);

          return {
            kind: asset.kind,
            url: asset.mediaUrl,
            posterUrl: asset.posterUrl,
            generationId: asset.generationId,
            imageIndex: asset.resultIndex,
            prompt: asset.prompt,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
          };
        });
      const resolvedAssets = await Promise.all(selectedAssets);

      await importCanvasAssets({
        projectId,
        assets: resolvedAssets,
        anchorPosition: getImportAnchorPosition?.() ?? null,
      });

      setSelectedIds([]);
      onImported();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to import assets into canvas:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    const selectedAssets = assets.filter((asset) => selectedIds.includes(asset.id));
    if (selectedAssets.length === 0) {
      return;
    }

    setDeleting(true);
    try {
      const indexesByGeneration = new Map<string, number[]>();

      for (const asset of selectedAssets) {
        const next = indexesByGeneration.get(asset.generationId) ?? [];
        next.push(asset.resultIndex);
        indexesByGeneration.set(asset.generationId, next);
      }

      for (const [generationId, imageIndexes] of indexesByGeneration) {
        const sortedIndexes = [...imageIndexes].sort((left, right) => right - left);

        for (const imageIndex of sortedIndexes) {
          await deleteGenerationAsset(generationId, imageIndex);
        }
      }

      setSelectedIds([]);
      await loadAssets();
    } catch (error) {
      console.error("Failed to delete selected assets:", error);
    } finally {
      setDeleting(false);
    }
  };

  const busy = importing || deleting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,760px)] max-h-[85vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6 pr-12">
          <DialogTitle>{copy.importTitle}</DialogTitle>
          <DialogDescription>{selectionLabel}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="flex h-full min-h-[280px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex h-full min-h-[280px] items-center justify-center rounded-[22px] border border-dashed border-border/80 bg-muted/25 px-6 text-center text-sm text-muted-foreground">
              {copy.importEmpty}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 pb-1 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {assets.map((asset) => {
                const selected = selectedIds.includes(asset.id);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggleSelection(asset.id)}
                    className="group relative overflow-hidden text-left transition-transform hover:-translate-y-0.5"
                  >
                    <div className="relative overflow-hidden pb-[76%] ring-1 ring-black/6 transition-shadow group-hover:shadow-[0_14px_28px_-18px_rgba(15,23,42,0.36)] dark:ring-white/10">
                      {asset.kind === "image" ? (
                        <SessionImage
                          src={asset.mediaUrl}
                          alt={copy.canvasAssetImageAlt}
                          wrapperClassName="absolute inset-0 h-full w-full"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <video
                          src={asset.mediaUrl}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          muted
                          loop
                          playsInline
                          preload="metadata"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 via-black/24 to-transparent px-2.5 pb-2.5 pt-6 text-left">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                          {asset.kind === "image" ? (
                            <ImageIcon className="h-3 w-3" />
                          ) : (
                            <Video className="h-3 w-3" />
                          )}
                          <span>
                            {asset.kind === "image" ? copy.imageType : copy.videoType}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm ${
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-white/80 bg-white/90 text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4">
          <Button
            variant="destructive"
            className="bg-[#d92d20] text-white hover:bg-[#b42318] sm:mr-auto dark:bg-[#d92d20] dark:text-white dark:hover:bg-[#b42318]"
            onClick={() => void handleDeleteSelected()}
            disabled={selectedIds.length === 0 || busy}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {copy.deleteSelected}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {copy.cancel}
          </Button>
          <Button
            onClick={() => void handleImport()}
            disabled={selectedIds.length === 0 || busy}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {copy.importConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
