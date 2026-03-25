export type CanvasEngine = "qwen" | "wan";

export type CanvasActionType =
  | "quick_edit"
  | "expand"
  | "remove_bg"
  | "edit_text"
  | "edit_elements"
  | "remix"
  | "mockup"
  | "extract_subject"
  | "remove_watermark"
  | "multi_angles"
  | "sketch_to_image"
  | "detect"
  | "segment"
  | "background_swap";

type CanvasToolbarGroup = "primary" | "more";

type CanvasActionDefinition = {
  type: CanvasActionType;
  label: string;
  shortLabel: string;
  description: string;
  group: CanvasToolbarGroup;
  defaultEngine: CanvasEngine;
  allowedEngines: CanvasEngine[];
  maxInputs: number;
  minInputs: number;
  maxOutputs: number;
  defaultOutputs: number;
  promptPlaceholder: string;
};

const CANVAS_ACTIONS: CanvasActionDefinition[] = [
  {
    type: "quick_edit",
    label: "Quick Edit",
    shortLabel: "Quick Edit",
    description: "Natural-language image refinement.",
    group: "primary",
    defaultEngine: "qwen",
    allowedEngines: ["qwen"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the change you want to make.",
  },
  {
    type: "remove_bg",
    label: "Remove BG",
    shortLabel: "Remove BG",
    description: "Remove the background and isolate the main subject.",
    group: "primary",
    defaultEngine: "wan",
    allowedEngines: ["wan"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe what should stay in the foreground.",
  },
  {
    type: "expand",
    label: "Expand",
    shortLabel: "Expand",
    description: "Outpaint and extend the current composition.",
    group: "primary",
    defaultEngine: "wan",
    allowedEngines: ["wan"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe how the scene should extend beyond the current frame.",
  },
  {
    type: "edit_text",
    label: "Edit Text",
    shortLabel: "Text",
    description: "Add or replace text in the image.",
    group: "primary",
    defaultEngine: "qwen",
    allowedEngines: ["qwen"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the exact text change you want.",
  },
  {
    type: "edit_elements",
    label: "Edit Elements",
    shortLabel: "Elements",
    description: "Add, remove, replace, or move objects.",
    group: "primary",
    defaultEngine: "qwen",
    allowedEngines: ["qwen"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the elements to add, remove, or replace.",
  },
  {
    type: "remix",
    label: "Remix",
    shortLabel: "Remix",
    description: "Blend one or more inputs into a new result.",
    group: "primary",
    defaultEngine: "wan",
    allowedEngines: ["qwen", "wan"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 4,
    defaultOutputs: 2,
    promptPlaceholder: "Describe the blend, style, or composition you want.",
  },
  {
    type: "mockup",
    label: "Mockup",
    shortLabel: "Mockup",
    description: "Place artwork onto a scene or product mockup.",
    group: "primary",
    defaultEngine: "qwen",
    allowedEngines: ["qwen"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the product or scene for the mockup placement.",
  },
  {
    type: "extract_subject",
    label: "Extract Subject",
    shortLabel: "Extract",
    description: "Separate the subject or main element from the scene.",
    group: "more",
    defaultEngine: "wan",
    allowedEngines: ["wan"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 4,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the subject to isolate or extract.",
  },
  {
    type: "remove_watermark",
    label: "Remove Watermark/Text",
    shortLabel: "Clean",
    description: "Remove watermarks or unwanted text.",
    group: "more",
    defaultEngine: "wan",
    allowedEngines: ["wan"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 4,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the watermark or text to remove.",
  },
  {
    type: "multi_angles",
    label: "Multi-Angles",
    shortLabel: "Angles",
    description: "Create new views while preserving the subject.",
    group: "more",
    defaultEngine: "qwen",
    allowedEngines: ["qwen"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the new angle or pose you want.",
  },
  {
    type: "sketch_to_image",
    label: "Sketch to Image",
    shortLabel: "Sketch",
    description: "Use the current image as a structure guide.",
    group: "more",
    defaultEngine: "wan",
    allowedEngines: ["wan"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 4,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the final image style and details.",
  },
  {
    type: "detect",
    label: "Detect",
    shortLabel: "Detect",
    description: "Generate a detection-style analysis result.",
    group: "more",
    defaultEngine: "wan",
    allowedEngines: ["wan"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe what objects or regions should be detected.",
  },
  {
    type: "segment",
    label: "Segment",
    shortLabel: "Segment",
    description: "Generate a segmentation-style analysis result.",
    group: "more",
    defaultEngine: "wan",
    allowedEngines: ["wan"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe what should be segmented or isolated.",
  },
  {
    type: "background_swap",
    label: "Background Swap",
    shortLabel: "Backdrop",
    description: "Keep the subject while changing the setting.",
    group: "more",
    defaultEngine: "qwen",
    allowedEngines: ["qwen"],
    minInputs: 1,
    maxInputs: 3,
    maxOutputs: 1,
    defaultOutputs: 1,
    promptPlaceholder: "Describe the new background and atmosphere.",
  },
];

const CANVAS_ACTIONS_BY_TYPE = new Map(
  CANVAS_ACTIONS.map((action) => [action.type, action]),
);

export function getCanvasActionDefinition(type: CanvasActionType) {
  const action = CANVAS_ACTIONS_BY_TYPE.get(type);
  if (!action) {
    throw new Error(`Unsupported canvas action: ${type}`);
  }
  return action;
}

const PRIMARY_CANVAS_ACTIONS = CANVAS_ACTIONS.filter(
  (action) => action.group === "primary" && action.type !== "expand",
);

const HIDDEN_PRIMARY_CANVAS_ACTION_TYPES = new Set<CanvasActionType>([
  "edit_text",
  "edit_elements",
  "remix",
  "mockup",
]);

const TOOLBAR_PRIMARY_CANVAS_ACTIONS = PRIMARY_CANVAS_ACTIONS.filter(
  (action) => !HIDDEN_PRIMARY_CANVAS_ACTION_TYPES.has(action.type),
);

const MORE_CANVAS_ACTIONS = CANVAS_ACTIONS.filter(
  (action) => action.group === "more",
);

const HIDDEN_MORE_CANVAS_ACTION_TYPES = new Set<CanvasActionType>([
  "extract_subject",
  "remove_watermark",
  "multi_angles",
  "sketch_to_image",
  "detect",
  "segment",
  "background_swap",
]);

const TOOLBAR_MORE_CANVAS_ACTIONS = MORE_CANVAS_ACTIONS.filter(
  (action) => !HIDDEN_MORE_CANVAS_ACTION_TYPES.has(action.type),
);
