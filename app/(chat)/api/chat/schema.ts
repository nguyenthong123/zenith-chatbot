import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string(),
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.string(),
  name: z.string(),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const attachmentSchema = z.object({
  url: z.string(),
  name: z.string(),
  contentType: z.string().optional(),
});

const userMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user"]),
  parts: z.array(partSchema),
  attachments: z.array(attachmentSchema).optional(),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.record(z.unknown())),
});

export const postRequestBodySchema = z.object({
  id: z.string(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
