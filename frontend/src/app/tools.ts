import {
  IconArrowsDiff,
  IconBraces,
  IconFileTypePdf,
  type Icon,
} from "@tabler/icons-react";

export type ToolID = "text-diff" | "json-visualizer" | "base64-pdf";

export interface ToolDefinition {
  id: ToolID;
  label: string;
  description: string;
  icon: Icon;
}

export const tools: readonly ToolDefinition[] = [
  {
    id: "text-diff",
    label: "Text Diff",
    description: "Compare two blocks of text side by side.",
    icon: IconArrowsDiff,
  },
  {
    id: "json-visualizer",
    label: "JSON Visualizer",
    description: "Explore JSON structures and relationships.",
    icon: IconBraces,
  },
  {
    id: "base64-pdf",
    label: "Base64 → PDF",
    description: "Decode Base64 content into a PDF preview.",
    icon: IconFileTypePdf,
  },
] as const;
