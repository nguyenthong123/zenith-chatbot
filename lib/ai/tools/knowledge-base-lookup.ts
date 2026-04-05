import { tool } from "ai";
import { z } from "zod";
import { searchKnowledgeBase } from "@/lib/db/queries";

export const knowledgeBaseLookup = tool({
  description:
    "Search the Supabase knowledge base for advice, guides, and general information to help answer user questions. This is your primary source of truth for business advice and general queries.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query to look for in the knowledge base."),
  }),
  execute: async ({ query }) => {
    try {
      const results = await searchKnowledgeBase(query);

      if (results.length === 0) {
        return {
          message: `No related information found in the knowledge base for "${query}".`,
        };
      }

      return {
        results: results.map((r) => ({
          content: r.content,
          title: r.title,
          source: r.source,
          createdAt: r.createdAt,
        })),
        message: `Found ${results.length} related articles in the Supabase knowledge base and documents.`,
      };
    } catch (error) {
      console.error("Knowledge base lookup failed:", error);
      return {
        error: "Failed to search the knowledge base.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
