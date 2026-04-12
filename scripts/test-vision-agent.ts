import * as path from "node:path";
import * as dotenv from "dotenv";

// Load ENV first
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import * as dbQueries from "../lib/db/queries";
import { processMessage } from "../tools/telegram-agent/agent";

async function testVision() {
  console.log("--- Starting Telegram Vision Simulation ---");

  // Mock Context
  const context = {
    chatId: "test-chat-123",
    telegramId: "123456789",
    user: {
      id: "6e21013a-a19c-43f1-9486-1d70a3b68f56", // Using a real UUID from DB if possible, or a stable one
      name: "Test User",
      email: "test@example.com",
      role: "owner",
    },
    isGuest: false,
  };

  // Mock Attachments (A red Nike shoe)
  const attachments = [
    {
      url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000",
      contentType: "image/jpeg",
    },
  ];

  const userMessage = "[HỆ THỐNG: Người dùng vừa gửi một ảnh]";

  console.log("Calling processMessage with image...");
  try {
    const response = await processMessage(userMessage, context, attachments);
    console.log("\n--- AI RESPONSE ---");
    console.log(response.text);
    console.log("-------------------\n");

    if (
      (response.text && response.text.toLowerCase().includes("giày")) ||
      response.text.toLowerCase().includes("nike")
    ) {
      console.log("✅ Success: AI correctly identified the image content.");
    } else {
      console.log("⚠️ Warning: AI response might not be descriptive enough.");
    }
  } catch (error) {
    console.error("❌ Error during simulation:", error);
  }
}

testVision().catch(console.error);
