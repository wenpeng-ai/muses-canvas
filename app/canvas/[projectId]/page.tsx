import { CanvasWorkspacePage } from "@/components/canvas/CanvasWorkspacePage";

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <CanvasWorkspacePage key={projectId} projectId={projectId} />;
}
