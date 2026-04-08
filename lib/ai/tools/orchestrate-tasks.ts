import { generateObject, tool } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "../models";
import { getLanguageModel } from "../providers";

export const orchestrateTasks = tool({
  description:
    "A Master Management Tool (Orchestrator). Use this when the user's request is complex, multi-step, or requires multiple tools. It helps you create a strategic plan, break down goals into sub-tasks, and manage the flow of information between tools.",
  inputSchema: z.object({
    goal: z
      .string()
      .describe(
        "The high-level goal or complex request that needs to be decomposed into steps.",
      ),
  }),
  execute: async ({ goal }) => {
    try {
      const model = getLanguageModel(DEFAULT_CHAT_MODEL);

      const { object } = await generateObject({
        model,
        schema: z.object({
          plan: z.array(
            z.object({
              step: z.number(),
              description: z.string(),
              toolSuggested: z
                .string()
                .describe("The name of the tool to use for this step."),
              reasoning: z.string(),
            }),
          ),
          strategy: z
            .string()
            .describe(
              "Brief overview of how the overall goal will be achieved.",
            ),
        }),
        prompt: `You are the Master Orchestrator. Your mission is to break down this complex goal into a clear, logical sequence of steps using available tools.
        
        GOAL: ${goal}
        
        AVAILABLE TOOLS:
        - readImage: Analyze images/OCR.
        - readUrl: Read webpage content.
        - webSearch: Search the internet.
        - readPdf: Extract text from PDF.
        - productLookup: Search for product information.
        - saveProduct: Create or update product data.
        - customerLookup: Search for customer info.
        - orderLookup: Search for orders in Firestore.
        - orderSupabaseLookup: Search for orders in Supabase.
        - sendTelegramNotification: Send alerts to Telegram.
        - databaseLookup: Query general database info.
        - knowledgeBaseLookup: Search company knowledge.
        - saveKnowledge: Save new information.
        
        Create a precise execution plan. For each step, suggest the best tool to use and provide the reasoning.`,
      });

      return {
        strategy: object.strategy,
        plan: object.plan,
      };
    } catch (error) {
      console.error("[orchestrateTasks Tool Error]:", error);
      return {
        goal,
        error: "Failed to create an orchestration plan.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
