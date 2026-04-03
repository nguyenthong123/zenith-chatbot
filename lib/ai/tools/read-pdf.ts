import "@/lib/polyfills";
import { tool } from "ai";
import { z } from "zod";

// Import pdf-parse using require to ensure polyfills are set up first
const { PDFParse } = require("pdf-parse");

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
      const parser = new PDFParse({ data: buffer });

      const [textResult, infoResult] = await Promise.all([
        parser.getText(),
        parser.getInfo(),
      ]);

      return {
        url,
        text: textResult.text.slice(0, 20000), // Limit text size for model context
        info: infoResult,
        numpages: textResult.pages.length,
        isTruncated: textResult.text.length > 20000,
      };
    } catch (error) {
      return {
        error: "An unexpected error occurred while reading the PDF.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
