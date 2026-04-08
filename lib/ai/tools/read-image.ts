import { generateText, tool } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "../models";
import { getLanguageModel } from "../providers";

export const readImage = tool({
  description:
    "Analyze an image from a URL or attachment with high precision. Use this for OCR, structured data extraction, or detailed visual analysis. Requires the image URL and a specific prompt of what to look for.",
  inputSchema: z.object({
    url: z.string().describe("The URL of the image to analyze."),
    prompt: z
      .string()
      .describe(
        "A specific prompt or question about the image (e.g., 'OCR this document', 'Identify the objects', 'Extract product details').",
      ),
  }),
  execute: async ({ url, prompt }) => {
    if (url === "attachment_url" || url === "URL") {
      return {
        error: "Invalid URL provided.",
        message:
          "You provided a placeholder string instead of the actual image URL. Please find the REAL URL from the message attachments and try again.",
      };
    }

    try {
      const model = getLanguageModel(DEFAULT_CHAT_MODEL);

      const { text } = await generateText({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", image: new URL(url) },
            ],
          },
        ],
      });

      return {
        url,
        analysis: text,
      };
    } catch (error) {
      console.error("[readImage Tool Error]:", error);
      return {
        url,
        error: "Failed to analyze image.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
