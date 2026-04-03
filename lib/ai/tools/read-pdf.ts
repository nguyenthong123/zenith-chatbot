import { tool } from "ai";
// @ts-ignore
import pdf from "pdf-parse";
import { z } from "zod";

export const readPdf = tool({
  description:
    "Extract text content from a PDF file provided via a URL for analysis.",
  inputSchema: z.object({
    url: z.string().url().describe("The public URL of the PDF file to read."),
  }),
  execute: async ({ url }) => {
    try {
      const response = await fetch(url);

      if (!response.ok) {
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
      return {
        error: "An unexpected error occurred while reading the PDF.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
