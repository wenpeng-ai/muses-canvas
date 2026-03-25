"use client";

type ClientCropPresentation = {
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

async function loadImageBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("canvas_image_fetch_failed");
  }

  const blob = await response.blob();
  return createImageBitmap(blob);
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export async function createCroppedImageFile(params: {
  imageUrl: string;
  fileName?: string;
  presentation: ClientCropPresentation;
}) {
  const bitmap = await loadImageBitmap(params.imageUrl);
  const radians = (params.presentation.rotation * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const transformedWidth = Math.max(
    1,
    Math.ceil(bitmap.width * cosine + bitmap.height * sine),
  );
  const transformedHeight = Math.max(
    1,
    Math.ceil(bitmap.width * sine + bitmap.height * cosine),
  );

  const transformedCanvas = createCanvas(transformedWidth, transformedHeight);
  const transformedContext = transformedCanvas.getContext("2d");
  if (!transformedContext) {
    throw new Error("canvas_context_unavailable");
  }

  transformedContext.translate(transformedWidth / 2, transformedHeight / 2);
  transformedContext.rotate(radians);
  transformedContext.scale(
    params.presentation.flipX ? -1 : 1,
    params.presentation.flipY ? -1 : 1,
  );
  transformedContext.drawImage(
    bitmap,
    -bitmap.width / 2,
    -bitmap.height / 2,
    bitmap.width,
    bitmap.height,
  );

  const crop = params.presentation.crop;
  const cropX = Math.max(
    0,
    Math.min(
      transformedWidth - 1,
      Math.round(crop.x * transformedWidth),
    ),
  );
  const cropY = Math.max(
    0,
    Math.min(
      transformedHeight - 1,
      Math.round(crop.y * transformedHeight),
    ),
  );
  const cropWidth = Math.max(1, Math.round(crop.width * transformedWidth));
  const cropHeight = Math.max(1, Math.round(crop.height * transformedHeight));
  const safeCropWidth = Math.min(cropWidth, transformedWidth - cropX);
  const safeCropHeight = Math.min(cropHeight, transformedHeight - cropY);

  const outputCanvas = createCanvas(safeCropWidth, safeCropHeight);
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) {
    throw new Error("canvas_context_unavailable");
  }

  outputContext.drawImage(
    transformedCanvas,
    cropX,
    cropY,
    safeCropWidth,
    safeCropHeight,
    0,
    0,
    safeCropWidth,
    safeCropHeight,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("canvas_crop_blob_failed"));
        return;
      }

      resolve(nextBlob);
    }, "image/png");
  });

  const fileName =
    params.fileName?.trim() ||
    `canvas-crop-${Date.now().toString(36)}.png`;

  return {
    file: new File([blob], fileName, { type: "image/png" }),
    width: safeCropWidth,
    height: safeCropHeight,
  };
}
