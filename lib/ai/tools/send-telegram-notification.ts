import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { user as userTable } from "@/lib/db/schema";

export const sendTelegramNotification = tool({
  description:
    "Send a proactive notification message to the user via Telegram.",
  inputSchema: z.object({
    message: z.string().describe("The message text to send to Telegram."),
    userId: z.string().describe("The ID of the user to notify."),
  }),
  execute: async ({ message, userId }) => {
    try {
      const [user] = await db
        .select()
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      if (!user?.telegramChatId) {
        return {
          success: false,
          error:
            "User does not have a Telegram Chat ID linked. Ask them to link their Telegram first.",
        };
      }

      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!BOT_TOKEN) {
        return {
          success: false,
          error: "TELEGRAM_BOT_TOKEN is not configured on the server.",
        };
      }

      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: user.telegramChatId,
            text: message,
            parse_mode: "HTML",
          }),
        },
      );

      const result = await response.json();

      if (result.ok) {
        return {
          success: true,
          message: "Notification sent successfully via Telegram.",
        };
      } else {
        return {
          success: false,
          error: result.description || "Failed to send Telegram message.",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});
