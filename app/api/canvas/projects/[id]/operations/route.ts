import { errorResponse } from "@/lib/server/route-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await params;
  return errorResponse("canvas_actions_disabled", { status: 410 });
}
