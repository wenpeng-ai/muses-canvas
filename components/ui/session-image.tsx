"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const loadedImageUrls = new Set<string>();
const pendingImageLoads = new Map<string, Promise<void>>();

export function isSessionImageWarm(src: string) {
  return !!src && loadedImageUrls.has(src);
}

export function warmSessionImage(src: string): Promise<void> {
  if (!src || typeof window === "undefined") {
    return Promise.resolve();
  }

  if (loadedImageUrls.has(src)) {
    return Promise.resolve();
  }

  const pending = pendingImageLoads.get(src);
  if (pending) {
    return pending;
  }

  const promise = new Promise<void>((resolve) => {
    const img = new window.Image();

    const finish = () => {
      loadedImageUrls.add(src);
      pendingImageLoads.delete(src);
      resolve();
    };

    img.onload = finish;
    img.onerror = finish;
    img.src = src;

    if (img.complete) {
      finish();
    }
  });

  pendingImageLoads.set(src, promise);
  return promise;
}

export function warmSessionImages(urls: Array<string | null | undefined>) {
  return Promise.all(
    Array.from(new Set(urls.filter((url): url is string => !!url))).map((url) =>
      warmSessionImage(url),
    ),
  ).then(() => undefined);
}

type SessionImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  disableReveal?: boolean;
  wrapperClassName?: string;
  errorLabel?: string;
};

export function SessionImage({
  src,
  alt,
  disableReveal = false,
  wrapperClassName,
  className,
  onLoad,
  onError,
  errorLabel,
  loading = "lazy",
  decoding = "async",
  ...props
}: SessionImageProps) {
  const imageSrc = typeof src === "string" ? src : "";
  const [loadedSrc, setLoadedSrc] = useState(() =>
    isSessionImageWarm(imageSrc) ? imageSrc : "",
  );
  const [failedSrc, setFailedSrc] = useState("");
  const loaded = !!imageSrc && (loadedImageUrls.has(imageSrc) || loadedSrc === imageSrc);
  const failed = !!imageSrc && failedSrc === imageSrc;

  useEffect(() => {
    let cancelled = false;

    if (!imageSrc || loaded) {
      return;
    }
    warmSessionImage(imageSrc).then(() => {
      if (!cancelled) {
        setLoadedSrc(imageSrc);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageSrc, loaded]);

  return (
    <div className={cn("relative overflow-hidden", wrapperClassName)}>
      {!loaded && !failed && <div className="absolute inset-0 shimmer" />}
      {failed && errorLabel ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 px-3 text-center text-xs font-medium text-muted-foreground">
          {errorLabel}
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...props}
        src={imageSrc}
        alt={alt ?? ""}
        loading={loading}
        decoding={decoding}
        className={cn(
          "transition-all duration-500 ease-out will-change-transform",
          loaded
            ? disableReveal
              ? "opacity-100 blur-0 scale-100"
              : "opacity-100 blur-0 scale-100 image-reveal"
            : "opacity-0 blur-[2px] scale-[1.03]",
          failed && "pointer-events-none opacity-0",
          className,
        )}
        onLoad={(event) => {
          if (imageSrc) {
            loadedImageUrls.add(imageSrc);
            pendingImageLoads.delete(imageSrc);
          }
          setLoadedSrc(imageSrc);
          setFailedSrc("");
          onLoad?.(event);
        }}
        onError={(event) => {
          setFailedSrc(imageSrc);
          onError?.(event);
        }}
      />
    </div>
  );
}
