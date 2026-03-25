export async function readJsonResponse<T>(response: Response, fallback: T): Promise<T> {
  return (await response.json().catch(() => fallback)) as T;
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallback: T,
) {
  const response = await fetch(input, init);
  const data = await readJsonResponse(response, fallback);

  return {
    response,
    data,
  };
}
