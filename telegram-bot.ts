import "dotenv/config";
import { sql } from "drizzle-orm";
import { Telegraf } from "telegraf";
import { db } from "./lib/db/queries";
import { setupBot } from "./lib/telegram/bot";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env file.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Initialize handlers
setupBot(bot);

console.log("🚀 Business Telegram Agent is starting (Polling Mode)...");

async function startupCheck() {
  try {
    console.log("Checking database connection...");
    await db.execute(sql`SELECT 1`);
    console.log("✅ Database connected successfully.");

    bot.launch();
    console.log("🚀 Bot is live and listening for messages.");
  } catch (error) {
    console.error("❌ CRITICAL: Database connection failed at startup!");
    console.error(error);
    process.exit(1);
  }
}

startupCheck();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Optional: Basic HTTP server for local health check if not running via Next.js Route
// For Vercel, the /api/webhook/telegram route handles the bot.
