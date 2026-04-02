import { tool } from "ai";
import { z } from "zod";

export const webSearch = tool({
  description: "Search the web for real-time information, news, and facts.",
  inputSchema: z.object({
    query: z.string().describe("The search query to look up on the web."),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
      return {
        error: "Tavily API key is not configured.",
      };
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: 5,
          search_depth: "basic",
          include_answer: true,
          include_images: false,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: `Tavily API error: ${response.status} ${response.statusText}`,
          details: errorData,
        };
      }

      const data = await response.json();
      
      // Return structured results for the AI
      return {
        query: data.query,
        answer: data.answer,
        results: data.results?.map((source: any) => ({
          title: source.title,
          url: source.url,
          content: source.content,
          score: source.score,
        })) ?? [],
      };
    } catch (error) {
      return {
        error: "Failed to perform web search.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
