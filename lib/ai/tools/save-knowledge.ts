import { tool } from "ai";
import { z } from "zod";
import { saveKnowledgeBaseItem } from "@/lib/db/queries";

export const saveKnowledge = (userId: string) =>
  tool({
    description:
      "Save important business information, procedures, or facts to the Supabase knowledge base for future reference. Use this when the user gives you a new process to remember or when you learn a recurring business fact.",
    inputSchema: z.object({
      content: z.string().describe("The information to save."),
      title: z
        .string()
        .optional()
        .describe("A short title for this piece of knowledge."),
      tags: z.array(z.string()).optional().describe("Tags for categorization."),
    }),
    execute: async ({ content, title, tags }) => {
      try {
        await saveKnowledgeBaseItem({
          content,
          userId,
          metadata: { title, tags, savedAt: new Date().toISOString() },
        });

        return {
          success: true,
          message: "Knowledge successfully saved to the Supabase database.",
        };
      } catch (error) {
        console.error("Save knowledge failed:", error);
        return {
          error: "Failed to save knowledge.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
