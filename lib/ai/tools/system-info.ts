import { tool } from "ai";
import { z } from "zod";
import { getSystemConfig } from "@/lib/db/queries";

export const getSystemInfo = () =>
  tool({
    description:
      "Get system configuration and business information such as bank account name, account number, and bank ID. Use this when the user asks for payment information or 'Where should I transfer money?'.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const config = await getSystemConfig();
        if (!config) {
          return {
            error: "No system configuration found.",
          };
        }

        return {
          accountName: config.accountName,
          accountNumber: config.accountNumber,
          bankId: config.bankId,
          updatedAt: config.updatedAt,
        };
      } catch (error) {
        return {
          error: "Failed to fetch system info.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
