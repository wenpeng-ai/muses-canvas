"use client";

import type { AspectRatio } from "@/store/generate-store";
import { cn } from "@/lib/utils";

export const ASPECT_RATIO_PICKER_ORDER: AspectRatio[] = [
  "auto",
  "9:16",
  "2:3",
  "3:4",
  "4:5",
  "1:1",
  "5:4",
  "4:3",
  "3:2",
  "16:9",
  "21:9",
  "1:2",
  "2:1",
  "1:4",
  "4:1",
  "1:8",
  "8:1",
];

function AutoRatioIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("ui-stroke-icon", className)}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M26 16h-6a4 4 0 0 0-4 4v6" />
      <path d="M38 16h6a4 4 0 0 1 4 4v6" />
      <path d="M48 38v6a4 4 0 0 1-4 4h-6" />
      <path d="M26 48h-6a4 4 0 0 1-4-4v-6" />
      <rect x="27" y="27" width="10" height="10" rx="2.6" />
    </svg>
  );
}

export function RatioOptionIllustration({
  ratio,
  className,
}: {
  ratio: AspectRatio;
  className?: string;
}) {
  if (ratio === "auto" || ratio === "adaptive" || ratio === "keep_ratio") {
    return <AutoRatioIcon className={cn("h-full w-full", className)} />;
  }

  const divider = ratio.includes(":") ? ":" : "x";
  const [w, h] = ratio.split(divider).map(Number);

  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    return <AutoRatioIcon className={cn("h-full w-full", className)} />;
  }

  const maxWidth = 38;
  const maxHeight = 30;
  const scale = Math.min(maxWidth / w, maxHeight / h);
  const width = Math.max(10, Math.round(w * scale));
  const height = Math.max(10, Math.round(h * scale));
  const x = (64 - width) / 2;
  const y = (64 - height) / 2;
  const radius = Math.min(4.5, Math.max(3, Math.min(width, height) * 0.18));
  const cornerInset = Math.max(2.75, Math.min(5, Math.min(width, height) * 0.24));
  const cornerLen = Math.max(2.5, Math.min(4.25, Math.min(width, height) * 0.2));

  return (
    <svg
      className={cn("ui-stroke-icon", className)}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={Math.min(6, Math.max(3.5, radius + 0.75))}
      />
      <path
        d={`M${x + cornerInset} ${y + cornerInset + cornerLen}v-${cornerLen}h${cornerLen}`}
      />
      <path
        d={`M${x + width - cornerInset} ${y + height - cornerInset - cornerLen}v${cornerLen}h-${cornerLen}`}
      />
    </svg>
  );
}

export function AspectRatioOptionCard({
  ratio,
  label,
  selected,
  onClick,
  className,
}: {
  ratio: AspectRatio;
  label?: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[8px] border px-1.5 py-2 transition-colors",
        selected
          ? "border-[#c8ccd2] bg-[#dfe1e4] text-[#1f2329] dark:border-white/10 dark:bg-white/10 dark:text-foreground"
          : "border-black/12 bg-white text-[#555b66] hover:bg-[#f8f8f9] dark:border-white/10 dark:bg-[#15171b] dark:text-foreground/62 dark:hover:bg-white/8",
        className,
      )}
    >
      <RatioOptionIllustration ratio={ratio} className="h-[26px] w-[26px]" />
      <span className="text-[12px] font-medium leading-none">
        {label ?? ratio}
      </span>
    </button>
  );
}
