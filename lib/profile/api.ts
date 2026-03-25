import type { User } from "@/lib/supabase/types";
import { requestJson } from "@/lib/client/json-fetch";

export async function fetchLocalProfile() {
  const { response, data } = await requestJson<{ profile?: User }>(
    "/api/profile",
    {
      cache: "no-store",
    },
    {},
  );

  return response.ok && data.profile ? data.profile : null;
}
