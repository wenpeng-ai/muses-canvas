import { NextResponse } from "next/server";

type JsonResponseInit = number | ResponseInit | undefined;

function resolveResponseInit(init: JsonResponseInit): ResponseInit | undefined {
  if (typeof init === "number") {
    return { status: init };
  }

  return init;
}

export async function readJsonBody<T>(request: Request, fallback: T): Promise<T> {
  return (await request.json().catch(() => fallback)) as T;
}

export function jsonResponse<T>(body: T, init?: JsonResponseInit) {
  return NextResponse.json(body, resolveResponseInit(init));
}

export function createdResponse<T>(body: T, init?: Omit<ResponseInit, "status">) {
  return jsonResponse(body, {
    ...init,
    status: 201,
  });
}

export function errorResponse(
  error: string,
  options?: {
    status?: number;
    extras?: Record<string, unknown>;
  },
) {
  return jsonResponse(
    {
      error,
      ...(options?.extras ?? {}),
    },
    options?.status ?? 400,
  );
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function parseNumberInput(
  value: FormDataEntryValue | string | null | undefined,
  fallback: number,
) {
  const normalized =
    typeof value === "string"
      ? value
      : typeof value?.toString === "function"
        ? value.toString()
        : null;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : fallback;
}
