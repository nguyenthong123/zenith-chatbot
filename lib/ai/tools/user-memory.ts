import { tool } from "ai";
import { z } from "zod";
import { getUserMemories, saveUserMemory } from "@/lib/db/queries";

export const getManageUserMemory = (userId: string) =>
  tool({
    description:
      "Manage facts and preferences about the user. Use 'save' to remember shared information across sessions, and 'list' to retrieve those facts. Use this to remember things like personal preferences or business requests.",
    inputSchema: z.object({
      action: z
        .enum(["save", "list"])
        .describe(
          "The action to perform: save a new fact or list existing ones.",
        ),
      content: z
        .string()
        .optional()
        .describe(
          "The fact or preference to save (required for 'save' action).",
        ),
    }),
    execute: async ({ action, content }) => {
      try {
        if (action === "save") {
          if (!content)
            return { error: "Content is required for 'save' action." };
          await saveUserMemory(userId, content);
          return {
            success: true,
            message: `Successfully saved to memory: "${content}"`,
          };
        } else {
          const memories = await getUserMemories(userId);
          return {
            memories: memories.map((m) => m.content),
            count: memories.length,
          };
        }
      } catch (error) {
        return {
          error: "Failed to manage user memory.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
