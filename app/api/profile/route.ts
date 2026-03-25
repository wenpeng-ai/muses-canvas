import { getLocalProfile } from "@/lib/server/canvas-local-service";
import { jsonResponse } from "@/lib/server/route-utils";

export async function GET() {
  const profile = await getLocalProfile();
  return jsonResponse({ profile });
}
