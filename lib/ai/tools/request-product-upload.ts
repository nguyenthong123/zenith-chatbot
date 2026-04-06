import { tool } from "ai";
import { z } from "zod";

export const requestProductUploadTool = tool({
  description:
    "When the user mentions that they want to upload product images, or asks for a form/tool to attach images, use this tool. It will show a client-side interactive component letting them bypass chat attachments and safely upload directly to Cloudinary.",
  inputSchema: z.object({
    intentMatched: z
      .boolean()
      .describe(
        "True if you believe the user clearly wants the product upload interface."
      ),
  }),
  execute: async ({ intentMatched }) => {
    return {
      message:
        "The client UI should now display the <ProductUploadForm /> to allow the user to manually upload their files.",
      showForm: true,
      intentMatched,
    };
  },
});
