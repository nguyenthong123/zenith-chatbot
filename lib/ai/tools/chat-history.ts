import { tool } from "ai";
import { z } from "zod";
import { searchMessages } from "@/lib/db/queries";

export const getChatHistorySearch = (userId: string) =>
  tool({
    description:
      "Search through the user's past chat conversations for specific keywords or topics. Use this to answer questions about previous discussions, like 'What did we talk about last week?' or 'Did I ask about X before?'.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The keyword or topic to search for in past messages."),
    }),
    execute: async ({ query }) => {
      try {
        const results = await searchMessages({ userId, query });

        if (results.length === 0) {
          return {
            message: `No past conversations found matching "${query}".`,
            results: [],
          };
        }

        return {
          message: `Found ${results.length} relevant snippets from past conversations:`,
          results: results.map((r) => ({
            chatTitle: r.chatTitle,
            chatId: r.chatId,
            role: r.role,
            content: (r.parts as any)[0]?.text || "No text content",
            createdAt: r.createdAt,
          })),
        };
      } catch (error) {
        return {
          error: "Failed to search chat history.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
