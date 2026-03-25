import type { AspectRatio } from "@/store/generate-store";
import { resolveProviderModelSelection } from "@/lib/provider-settings";

export const IMAGE_COMPOSER_RATIO_OPTIONS: AspectRatio[] = [
  "9:16",
  "2:3",
  "3:4",
  "1:1",
  "4:3",
  "3:2",
  "16:9",
  "1:2",
  "2:1",
];

export type VideoComposerConfig = {
  durations: number[];
  sizes: AspectRatio[];
  defaultDuration: number;
  defaultSize: AspectRatio;
};

const DEFAULT_IMAGE_ASPECT_RATIO: AspectRatio = "9:16";

const DEFAULT_VIDEO_COMPOSER_CONFIG: VideoComposerConfig = {
  durations: [4, 8, 12],
  sizes: ["16:9", "9:16", "1280x720", "720x1280"],
  defaultDuration: 4,
  defaultSize: "16:9",
};

const VEO_VIDEO_COMPOSER_CONFIG: VideoComposerConfig = {
  durations: [4, 6, 8],
  sizes: ["16:9", "9:16"],
  defaultDuration: 4,
  defaultSize: "16:9",
};

export function resolveImageComposerAspectRatio(
  value: string | null | undefined,
) {
  const normalized = typeof value === "string" ? value.trim() : "";

  return IMAGE_COMPOSER_RATIO_OPTIONS.includes(normalized as AspectRatio)
    ? (normalized as AspectRatio)
    : DEFAULT_IMAGE_ASPECT_RATIO;
}

export function getVideoComposerConfig(model: string | null | undefined): VideoComposerConfig {
  const resolved = resolveProviderModelSelection(model, "video");

  if (resolved.providerId === "veo") {
    return VEO_VIDEO_COMPOSER_CONFIG;
  }

  return DEFAULT_VIDEO_COMPOSER_CONFIG;
}

export function resolveVideoComposerDuration(
  model: string | null | undefined,
  value: number | null | undefined,
) {
  const config = getVideoComposerConfig(model);
  return config.durations.includes(value ?? NaN)
    ? (value as number)
    : config.defaultDuration;
}

export function resolveVideoComposerSize(
  model: string | null | undefined,
  value: string | null | undefined,
) {
  const config = getVideoComposerConfig(model);
  const normalized = typeof value === "string" ? value.trim() : "";

  return config.sizes.includes(normalized as AspectRatio)
    ? (normalized as AspectRatio)
    : config.defaultSize;
}
