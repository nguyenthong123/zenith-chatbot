import { generateText, stepCountIs } from "ai";
import { DEFAULT_CHAT_MODEL, getCapabilities } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { getBillingLookup } from "@/lib/ai/tools/billing-lookup";
import { getCashBookLookup } from "@/lib/ai/tools/cash-book-lookup";
import { getCustomerLookup } from "@/lib/ai/tools/customer-lookup";
import { getOrderLookup } from "@/lib/ai/tools/order-lookup";
import { getOrderSupabaseLookup } from "@/lib/ai/tools/order-supabase-lookup";
import { getProductLookup } from "@/lib/ai/tools/product-lookup";
import { getSaveProductTool } from "@/lib/ai/tools/save-product";
import { generateStatus } from "@/lib/ai/tools/status";
import { getUserLookup } from "@/lib/ai/tools/user-lookup";

export interface HeadlessChatOptions {
  userId: string;
  userRole?: string;
  userName?: string | null;
  userEmail?: string | null;
  messages: Array<Record<string, unknown>>;
  selectedChatModel?: string;
  onToolCall?: (toolNames: string[]) => void | Promise<void>;
}

export async function generateHeadlessResponse({
  userId,
  userRole = "user",
  userName = "Unknown",
  userEmail = "Unknown",
  messages,
  selectedChatModel = DEFAULT_CHAT_MODEL,
  onToolCall,
}: HeadlessChatOptions) {
  const modelCapabilities = await getCapabilities();
  const capabilities = modelCapabilities[selectedChatModel];
  const supportsTools = capabilities?.tools === true;

  const result = await generateText({
    model: getLanguageModel(selectedChatModel),
    system: systemPrompt({
      supportsTools,
      userRole,
      userName,
      userEmail,
      requestHints: {
        city: "Unknown",
        country: "Unknown",
        latitude: "0",
        longitude: "0",
      },
    }),
    messages: messages as any,
    stopWhen: stepCountIs(5),
    tools: {
      productLookup: getProductLookup(userId, userRole, userEmail || undefined),
      saveProduct: getSaveProductTool(userId, userEmail || undefined),
      customerLookup: getCustomerLookup(
        userId,
        userRole,
        userEmail || undefined,
      ),
      orderLookup: getOrderLookup(userId, userRole),
      orderSupabaseLookup: getOrderSupabaseLookup(userId, userRole, userEmail),
      userLookup: getUserLookup(userId, userRole, userEmail),
      billingLookup: getBillingLookup(userId, userRole),
      cashBookLookup: getCashBookLookup(userId, userRole),
      generateStatus: generateStatus(),
    },
    onStepFinish: async ({ toolCalls }) => {
      if (toolCalls.length > 0 && onToolCall) {
        const toolNames = toolCalls.map((tc) => tc.toolName);
        await onToolCall(toolNames);
      }
    },
  });

  return result;
}
