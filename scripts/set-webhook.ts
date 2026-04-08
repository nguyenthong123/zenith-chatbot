import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.argv[2];

if (!BOT_TOKEN) {
  console.error("❌ Error: TELEGRAM_BOT_TOKEN is not defined in .env");
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error("❌ Error: Please provide the webhook URL as an argument.");
  console.log(
    "Usage: npx tsx scripts/set-webhook.ts https://your-domain.vercel.app/api/webhook/telegram",
  );
  process.exit(1);
}

const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}`;

async function setWebhook() {
  try {
    console.log(`📡 Setting webhook to: ${WEBHOOK_URL}...`);
    const response = await axios.get(url);
    if (response.data.ok) {
      console.log("✅ Webhook set successfully!");
      console.log(response.data.description);
    } else {
      console.error("❌ Failed to set webhook:", response.data);
    }
  } catch (error: any) {
    console.error(
      "❌ Error setting webhook:",
      error.response?.data || error.message,
    );
  }
}

setWebhook();
