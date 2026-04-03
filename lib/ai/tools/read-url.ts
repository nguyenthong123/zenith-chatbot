import { tool } from "ai";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { z } from "zod";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export const readUrl = tool({
  description:
    "Read the content of a specific web URL to extract text and analyze it.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL of the web page to read."),
  }),
  execute: async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        return {
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        };
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove non-content elements
      $(
        "script, style, nav, footer, header, aside, .ads, #ads, .menu, #menu",
      ).remove();

      // Try to find the main content
      const mainContent = $("main, article, #content, .content, .main").first();
      const contentHtml = mainContent.length
        ? mainContent.html()
        : $("body").html();

      if (!contentHtml) {
        return {
          error: "Could not extract meaningful content from the page.",
        };
      }

      const markdown = turndownService.turndown(contentHtml);

      return {
        url,
        title: $("title").text().trim(),
        content: markdown.slice(0, 15000), // Limit content size for model context
        isTruncated: markdown.length > 15000,
      };
    } catch (error) {
      return {
        error: "An unexpected error occurred while reading the URL.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
