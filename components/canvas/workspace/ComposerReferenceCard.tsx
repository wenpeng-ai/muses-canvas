"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "next-intl";
import { createPortal } from "react-dom";
import { ImageIcon, Type, Video, X } from "lucide-react";
import type { CanvasNodeKind } from "@/lib/supabase/types";
import { SessionImage } from "@/components/ui/session-image";
import { getCanvasPageCopy } from "@/lib/canvas/copy";
import type { AppMessages } from "@/i18n/messages";

export type ComposerReferenceEntry = {
  id: string;
  sourceKind: CanvasNodeKind;
  title: string;
  content: string;
  textHasContent?: boolean;
  imageUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
};

export function ComposerReferenceCard({
  entry,
  onRemove,
}: {
  entry: ComposerReferenceEntry;
  onRemove: () => void;
}) {
  const messages = useMessages() as AppMessages;
  const copy = getCanvasPageCopy(messages);
  const tileRef = useRef<HTMLDivElement>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const Icon =
    entry.sourceKind === "text"
      ? Type
      : entry.sourceKind === "image"
        ? ImageIcon
        : Video;
  const hasVisualPreview =
    entry.sourceKind === "image" || entry.sourceKind === "video";
  const showTextParagraphPreview =
    entry.sourceKind === "text" && entry.textHasContent === true;

  const updateTooltipPosition = useCallback(() => {
    if (!tileRef.current) {
      return;
    }

    const rect = tileRef.current.getBoundingClientRect();
    setTooltipPosition({
      left: rect.left + rect.width / 2,
      top: rect.top - 10,
    });
  }, []);

  useEffect(() => {
    if (!tooltipOpen) {
      return;
    }

    updateTooltipPosition();

    const handleWindowChange = () => {
      updateTooltipPosition();
    };

    window.addEventListener("scroll", handleWindowChange, true);
    window.addEventListener("resize", handleWindowChange);

    return () => {
      window.removeEventListener("scroll", handleWindowChange, true);
      window.removeEventListener("resize", handleWindowChange);
    };
  }, [tooltipOpen, updateTooltipPosition]);

  return (
    <>
      <div
        ref={tileRef}
        className="group/reference relative shrink-0"
        onPointerEnter={() => {
          if (entry.sourceKind !== "text") {
            return;
          }

          updateTooltipPosition();
          setTooltipOpen(true);
        }}
        onPointerLeave={() => {
          if (entry.sourceKind !== "text") {
            return;
          }

          setTooltipOpen(false);
        }}
      >
        <button
          type="button"
          className="pointer-events-none absolute -right-2 -top-2 z-30 flex h-5 w-5 scale-95 items-center justify-center rounded-full bg-[#111111] text-white opacity-0 shadow-[0_10px_20px_-12px_rgba(15,23,42,0.52)] transition-all group-hover/reference:pointer-events-auto group-hover/reference:scale-100 group-hover/reference:opacity-100 dark:bg-white dark:text-[#111111]"
          onClick={onRemove}
          title={copy.removeReference}
        >
          <X className="h-3 w-3" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[8px] border border-[#d8dde6] bg-[#eef0f3] dark:border-white/10 dark:bg-white/[0.08]">
          {hasVisualPreview ? (
            <div className="relative h-full w-full bg-black/[0.05] dark:bg-white/[0.06]">
              {entry.sourceKind === "image" && entry.imageUrl ? (
                <SessionImage
                  src={entry.imageUrl}
                  alt={entry.title}
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  disableReveal
                />
              ) : entry.sourceKind === "video" && entry.posterUrl ? (
                <SessionImage
                  src={entry.posterUrl}
                  alt={entry.title}
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  disableReveal
                />
              ) : entry.sourceKind === "video" && entry.videoUrl ? (
                <video
                  src={entry.videoUrl}
                  poster={entry.posterUrl ?? undefined}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-white/44">
                  <Icon className="h-4 w-4" />
                </div>
              )}
              {entry.sourceKind === "video" ? (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              ) : null}
            </div>
          ) : showTextParagraphPreview ? (
            <div className="flex h-full w-full flex-col justify-center gap-1 px-2">
              <div className="h-1.5 w-full rounded-full bg-[#c8ced9] dark:bg-white/16" />
              <div className="h-1.5 w-[70%] rounded-full bg-[#c8ced9] dark:bg-white/14" />
              <div className="h-1.5 w-[48%] rounded-full bg-[#c8ced9] dark:bg-white/12" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-white/44">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>
      {entry.sourceKind === "text" &&
      tooltipOpen &&
      tooltipPosition &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              data-canvas-zoom-relay=""
              className="pointer-events-none fixed z-[120] max-w-[280px] -translate-x-1/2 -translate-y-full rounded-[12px] bg-[#111111] px-3 py-2 text-[12px] leading-5 text-white shadow-[0_18px_38px_-22px_rgba(15,23,42,0.5)] dark:bg-white dark:text-[#111111]"
              style={{
                left: tooltipPosition.left,
                top: tooltipPosition.top,
              }}
            >
              <div className="max-h-[180px] overflow-hidden whitespace-pre-wrap break-all">
                {entry.content}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
