"use client";

import Image from "next/image";
import {
  getProviderDefinition,
  type ProviderId,
} from "@/lib/provider-settings";
import { cn } from "@/lib/utils";

type ProviderBrandMeta = {
  label: string;
  iconSrc?: string;
  monogram?: string;
  opticalClassName?: string;
};

const PROVIDER_BRAND_META: Partial<Record<ProviderId, ProviderBrandMeta>> = {
  openai: {
    label: "OpenAI",
    iconSrc: "/icons/gpt.svg",
  },
  google: {
    label: "Gemini",
    iconSrc: "/icons/gemini.svg",
  },
  grok: {
    label: "Grok",
    iconSrc: "/icons/grok.svg",
  },
  deepseek: {
    label: "DeepSeek",
    iconSrc: "/icons/deepseek.svg",
  },
  seedance: {
    label: "Seedance",
    iconSrc: "/icons/seedream.svg",
    opticalClassName: "scale-[0.92]",
  },
  hailuo: {
    label: "Hailuo",
    iconSrc: "/icons/hailuo.svg",
  },
  kling: {
    label: "Kling",
    iconSrc: "/icons/kling.svg",
    opticalClassName: "scale-[0.92]",
  },
  sora: {
    label: "Sora",
    iconSrc: "/icons/sora.svg",
    opticalClassName: "scale-[0.9]",
  },
  veo: {
    label: "Veo",
    iconSrc: "/icons/veo.svg",
  },
  wan: {
    label: "Wan",
    iconSrc: "/icons/qwen&wan.svg",
    opticalClassName: "scale-[0.92]",
  },
  custom: {
    label: "Custom",
    iconSrc: "/icons/custom-endpoint.svg",
  },
};

export function getProviderBrandMeta(providerId: ProviderId): ProviderBrandMeta {
  const fallbackLabel = getProviderDefinition(providerId).shortLabel;

  return (
    PROVIDER_BRAND_META[providerId] ?? {
      label: fallbackLabel,
      monogram: fallbackLabel.slice(0, 2).toUpperCase(),
    }
  );
}

export function CanvasProviderBrandIcon({
  providerId,
  className,
  imageClassName,
}: {
  providerId: ProviderId;
  className?: string;
  imageClassName?: string;
}) {
  const meta = getProviderBrandMeta(providerId);

  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center text-[#2f3540] dark:text-foreground",
        className,
      )}
      aria-hidden="true"
    >
      {meta.iconSrc ? (
        <Image
          src={meta.iconSrc}
          alt=""
          width={22}
          height={22}
          className={cn(
            "h-[18px] w-[18px] object-contain",
            meta.opticalClassName,
            imageClassName,
          )}
          unoptimized
        />
      ) : (
        <span className="text-[10px] font-semibold tracking-[0.08em] text-foreground dark:text-white">
          {meta.monogram ?? meta.label.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
