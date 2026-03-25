export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type User = {
  id: string;
  email: string;
  name: string | null;
  plan: "free" | "premium" | "ultimate";
  credits: number;
  monthly_quota: number;
  credits_reset_at: string;
  creem_customer_id: string | null;
  creem_customer_email: string | null;
  creem_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Generation = {
  id: string;
  user_id: string | null;
  guest_session_id: string | null;
  task_id: string;
  prompt: string;
  negative_prompt: string | null;
  model: string;
  size: string;
  quality: string;
  style: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  output_count: number;
  result_urls: string[] | null;
  reference_images: string[] | null;
  batch_task_ids: string[] | null;
  error_message: string | null;
  credits_used: number;
  created_at: string;
  updated_at: string;
};

export type CanvasProject = {
  id: string;
  user_id: string;
  title: string;
  cover_image_url: string | null;
  viewport_json: Json;
  last_refined_at: string;
  created_at: string;
  updated_at: string;
};

export type CanvasProjectSummary = Pick<
  CanvasProject,
  "id" | "title" | "cover_image_url" | "last_refined_at" | "created_at" | "updated_at"
> & {
  operation_count: number;
  image_count: number;
};

export type CanvasNodeKind = "text" | "image" | "video";

export type CanvasTextNode = {
  id: string;
  project_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  model: string;
  color: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  align: "left" | "center" | "right";
  created_at: string;
  updated_at: string;
};

export type CanvasImageNode = {
  id: string;
  project_id: string;
  image_url: string;
  origin_type: "upload" | "asset" | "generated" | "draft";
  source_generation_id: string | null;
  source_generation_image_index: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  prompt: string;
  model: string;
  size: string;
  created_at: string;
  updated_at: string;
};

export type CanvasVideoNode = {
  id: string;
  project_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  prompt: string;
  model: string;
  size: string;
  trimStartSeconds: number;
  durationSeconds: number;
  motionStrength: number;
  status: "idle" | "queued" | "running" | "completed";
  posterUrl: string | null;
  videoUrl: string | null;
  created_at: string;
  updated_at: string;
};

export type CanvasOperation = {
  id: string;
  project_id: string;
  action_type: string;
  engine: "qwen" | "wan" | null;
  model_id: string;
  prompt: string;
  params_json: Json;
  status: "pending" | "processing" | "completed" | "failed";
  generation_id: string | null;
  task_id: string | null;
  revision_of_operation_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CanvasLink = {
  id: string;
  project_id: string;
  source_kind: CanvasNodeKind | "operation";
  source_id: string;
  target_kind: CanvasNodeKind | "operation";
  target_id: string;
  relation_type: "prompt" | "reference" | "primary" | "input" | "output";
  sort_order: number;
  created_at: string;
};
