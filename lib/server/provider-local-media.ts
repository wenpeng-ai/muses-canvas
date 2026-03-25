import { mutateLibrary, writeMediaFile } from "@/lib/server/local-canvas-store";
import type { Generation } from "@/lib/supabase/types";

type PersistGeneratedImage = {
  buffer: Buffer<ArrayBufferLike>;
  mimeType: string;
};

type PersistGeneratedVideo = {
  buffer: Buffer<ArrayBufferLike>;
  mimeType: string;
};

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getExtensionFromContentType(contentType: string) {
  const normalized = contentType.toLowerCase();

  if (normalized.includes("mp4")) {
    return "mp4";
  }

  if (normalized.includes("webm")) {
    return "webm";
  }

  if (normalized.includes("quicktime") || normalized.includes("mov")) {
    return "mov";
  }

  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }

  if (normalized.includes("webp")) {
    return "webp";
  }

  if (normalized.includes("gif")) {
    return "gif";
  }

  return "png";
}

export async function persistGeneratedImages(params: {
  model: string;
  prompt: string;
  images: PersistGeneratedImage[];
  referenceImages?: string[];
}) {
  const imageUrls: string[] = [];

  for (const image of params.images) {
    const extension = getExtensionFromContentType(image.mimeType);
    const fileName = `${createId("media")}.${extension}`;

    await writeMediaFile({
      fileName,
      buffer: image.buffer,
    });

    imageUrls.push(`/api/media/${fileName}`);
  }

  const now = nowIso();
  const generation = {
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
    output_count: imageUrls.length,
    result_urls: imageUrls,
    reference_images: params.referenceImages ?? null,
    batch_task_ids: null,
    error_message: null,
    credits_used: 0,
    created_at: now,
    updated_at: now,
  } satisfies Generation;

  await mutateLibrary((current) => ({
    generations: [generation, ...current.generations],
  }));

  return {
    imageUrls,
    generation,
  };
}

export async function persistGeneratedVideos(params: {
  model: string;
  prompt: string;
  videos: PersistGeneratedVideo[];
  referenceImages?: string[];
}) {
  const videoUrls: string[] = [];

  for (const video of params.videos) {
    const extension = getExtensionFromContentType(video.mimeType);
    const fileName = `${createId("media")}.${extension}`;

    await writeMediaFile({
      fileName,
      buffer: video.buffer,
    });

    videoUrls.push(`/api/media/${fileName}`);
  }

  const now = nowIso();
  const generation = {
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
    output_count: videoUrls.length,
    result_urls: videoUrls,
    reference_images: params.referenceImages ?? null,
    batch_task_ids: null,
    error_message: null,
    credits_used: 0,
    created_at: now,
    updated_at: now,
  } satisfies Generation;

  await mutateLibrary((current) => ({
    generations: [generation, ...current.generations],
  }));

  return {
    videoUrls,
    generation,
  };
}
