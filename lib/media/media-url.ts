export type MediaKind = "image" | "video";

function getNormalizedPathname(value: string) {
  try {
    return new URL(value, "http://localhost").pathname.toLowerCase();
  } catch {
    return value.toLowerCase().split(/[?#]/, 1)[0];
  }
}

export function inferMediaKindFromUrl(url: string): MediaKind {
  const pathname = getNormalizedPathname(url);

  if (
    pathname.endsWith(".mp4") ||
    pathname.endsWith(".webm") ||
    pathname.endsWith(".mov")
  ) {
    return "video";
  }

  return "image";
}

export function isDirectHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
