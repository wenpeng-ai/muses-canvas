"use client";

export async function getImageDimensionsFromUrl(url: string): Promise<{
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      reject(new Error("image_dimensions_load_failed"));
    };

    image.src = url;
  });
}

export async function getImageDimensionsFromFile(file: File): Promise<{
  width: number;
  height: number;
}> {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await getImageDimensionsFromUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
