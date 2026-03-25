import { redirect } from "next/navigation";

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  redirect(`/canvas/${projectId}`);
}
