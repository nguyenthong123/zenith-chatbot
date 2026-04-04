import "@/lib/polyfills";
import { tool } from "ai";
import { z } from "zod";

// Import pdf-parse using require to ensure polyfills are set up first
// Import pdf-parse using require to ensure polyfills are set up first
const pdf = require("pdf-parse");

export const readPdf = tool({
  description:
    "Extract text content from a PDF file. The URL must be a valid http/https link found in the message text or attachments. Do NOT use placeholder strings.",
  inputSchema: z.object({
    url: z
      .string()
      .describe("The actual URL of the PDF file (starting with http/https)."),
  }),
  execute: async ({ url }) => {
    console.log("readPdf: Fetching URL:", url);

    if (url === "attachment_url" || url === "URL") {
      console.error(
        "readPdf: AI provided a placeholder URL instead of an actual one.",
      );
      return {
        error: "Invalid URL provided.",
        message:
          "You provided a placeholder string instead of the actual PDF URL from the message attachments. Please find the REAL URL (starting with http/https) and try again.",
      };
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          "readPdf: Failed to fetch PDF:",
          response.status,
          response.statusText,
        );
        return {
          error: `Failed to fetch PDF: ${response.status} ${response.statusText}`,
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const data = await pdf(buffer);

      return {
        url,
        text: data.text.slice(0, 20000), // Limit text size for model context
        info: data.info,
        numpages: data.numpages,
        isTruncated: data.text.length > 20000,
      };
    } catch (error) {
      console.error("readPdf: Unexpected error:", error);
      return {
        url,
        error: "An unexpected error occurred while reading the PDF.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
