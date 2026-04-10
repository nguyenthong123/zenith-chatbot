import { tool } from "ai";
import { z } from "zod";

/**
 * Web Search Tool using Tavily API
 * Documentation: https://docs.tavily.com/docs/tavily-api/introduction
 */
export const webSearch = tool({
  description:
    "Tìm kiếm thông tin trên Internet (tin tức, giá thị trường, kiến thức tổng hợp).",
  inputSchema: z.object({
    query: z.string().describe("Từ khóa tìm kiếm"),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "❌ Lỗi: Chưa cấu hình TAVILY_API_KEY.";
    }

    try {
      console.log(`[Search] Querying Tavily for: "${query}"`);
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: "basic",
          max_results: 3,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        return `❌ Lỗi API Search: ${errData.message || response.statusText}`;
      }

      const data = await response.json();
      const results = data.results || [];

      if (results.length === 0) {
        return "🌐 Không tìm thấy thông tin liên quan trên Internet.";
      }

      return (
        `🌐 <b>Kết quả tìm kiếm từ Internet:</b>\n\n` +
        results
          .map((r: any, i: number) => {
            // Strip markdown images and truncate to prevent Gemini thinking timeout
            const content = (r.content || "")
              .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, "") // remove markdown images
              .replace(/!\[.*?\]\(.*?\)/g, "") // remove inline images
              .replace(/\[Image \d+:.*?\]/g, "") // remove image refs
              .replace(/\s+/g, " ") // normalize whitespace
              .trim()
              .slice(0, 300);
            return `${i + 1}. <b>${r.title}</b>\n📝 ${content}\n🔗 <a href="${r.url}">Nguồn</a>`;
          })
          .join("\n\n")
      );
    } catch (error: any) {
      console.error("[Search] Critical Error:", error);
      return `❌ Lỗi kết nối công cụ Search: ${error.message}`;
    }
  },
});
