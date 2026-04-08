import { tool } from "ai";
import { z } from "zod";

export const generateStatus = () =>
  tool({
    description:
      "Generate a structured status update or summary from a given text. Use this when you want to provide a professional status report or summarize progress into a status format.",
    inputSchema: z.object({
      text: z.string().describe("The text content to generate a status from."),
      category: z
        .enum(["progress", "success", "error", "warning", "info"])
        .optional()
        .describe("The category of the status."),
    }),
    execute: async ({ text, category = "info" }) => {
      try {
        // In a real scenario, this might involve more complex logic or DB updates.
        // For now, it returns a structured status object.
        return {
          status: "generated",
          category,
          summary: text.length > 100 ? `${text.substring(0, 97)}...` : text,
          timestamp: new Date().toISOString(),
          originalText: text,
        };
      } catch (error) {
        return {
          error: "Failed to generate status.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
