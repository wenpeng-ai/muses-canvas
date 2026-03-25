import type { CanvasProject, CanvasProjectSummary } from "@/lib/supabase/types";

export type ProjectSwitcherItem = {
  id: string;
  title: string;
  meta: string;
  isCurrent: boolean;
};

export type ProjectHistoryItem = {
  id: string;
  title: string;
  prompt: string;
  timestamp: string;
  status: "pending" | "processing" | "completed" | "failed";
};

export const EMPTY_PROJECT_HISTORY_ITEMS: ProjectHistoryItem[] = [];

export function formatRelativeTimestamp(locale: string, value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = date.getTime() - Date.now();
  const absMinutes = Math.abs(diffMs) / (1000 * 60);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (absMinutes < 60) {
    return rtf.format(Math.round(diffMs / (1000 * 60)), "minute");
  }

  if (absMinutes < 60 * 24) {
    return rtf.format(Math.round(diffMs / (1000 * 60 * 60)), "hour");
  }

  if (absMinutes < 60 * 24 * 7) {
    return rtf.format(Math.round(diffMs / (1000 * 60 * 60 * 24)), "day");
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function sortProjectSummaries(projects: CanvasProjectSummary[]) {
  return [...projects].sort((left, right) => {
    const updatedDiff =
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();

    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return left.title.localeCompare(right.title);
  });
}

export function getProjectSummaryForGraph(
  project: CanvasProject,
  imageCount: number,
): CanvasProjectSummary {
  return {
    id: project.id,
    title: project.title,
    cover_image_url: project.cover_image_url,
    last_refined_at: project.last_refined_at,
    created_at: project.created_at,
    updated_at: project.updated_at,
    operation_count: 0,
    image_count: imageCount,
  };
}
