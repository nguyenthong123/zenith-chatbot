import { after } from "next/server";
import { Telegraf } from "telegraf";
import { setupBot } from "@/lib/telegram/bot";

export const maxDuration = 60;

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

const bot = new Telegraf(token);
setupBot(bot);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Respond to Telegram immediately so it doesn't consider the webhook failed.
    // Process the update in the background using Next.js after().
    after(async () => {
      try {
        await bot.handleUpdate(body);
      } catch (error) {
        console.error(
          `Telegram Background Processing Error (update_id: ${body?.update_id}):`,
          error,
        );
      }
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Telegram Webhook Error:", error);
    return new Response("Error", { status: 500 });
  }
}
