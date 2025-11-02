import { z } from "zod";
import { chatModels } from "@/lib/ai/models";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(2000),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/csv",
    "text/csv",
  ]),
  name: z.string().min(1).max(100),
  // Allow relative URLs (proxy URLs like /api/files/get?key=...) or absolute URLs
  url: z.string().min(1).refine(
    (url) => url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://'),
    { message: 'URL must be a valid absolute or relative URL' }
  ),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

// Dynamically generate valid model IDs from the chatModels array
const validModelIds = chatModels.map((model) => model.id) as [
  string,
  ...string[],
];

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(["user"]),
    parts: z.array(partSchema),
  }),
  selectedChatModel: z.enum(validModelIds),
  selectedVisibilityType: z.enum(["public", "private"]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
