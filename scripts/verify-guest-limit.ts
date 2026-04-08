import { config } from "dotenv";
import { and, count, eq, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chat, message, user } from "../lib/db/schema";
import { generateUUID } from "../lib/utils";

config({ path: [".env.local", ".env"] });

async function verify() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not found");
    return;
  }

  const connection = postgres(dbUrl, { max: 1 });
  const db = drizzle(connection);

  const testUserId = generateUUID();
  const testChatId = generateUUID();

  console.log(`Testing with Target User ID: ${testUserId}`);

  try {
    // 1. Create test user
    await db.insert(user).values({
      id: testUserId,
      email: `test-${testUserId}@example.com`,
      role: "guest",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Create test chat
    await db.insert(chat).values({
      id: testChatId,
      userId: testUserId,
      title: "Test Chat",
      createdAt: new Date(),
    });

    // 3. Insert 5 user messages
    for (let i = 0; i < 5; i++) {
      await db.insert(message).values({
        id: generateUUID(),
        chatId: testChatId,
        role: "user",
        parts: [{ type: "text", text: `Question ${i + 1}` }],
        attachments: [],
        createdAt: new Date(),
      });
    }

    // 4. Verify count
    const cutoffTime = new Date(Date.now() - 24 * 365 * 60 * 60 * 1000);
    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, testUserId),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user"),
        ),
      )
      .execute();

    console.log(`Message count for guest: ${stats.count}`);

    if (stats.count === 5) {
      console.log("SUCCESS: Guest limit (5) reached correctly.");
    } else {
      console.error(`FAILURE: Expected 5 messages, got ${stats.count}`);
    }

    // 5. Insert assistant message (should not count)
    await db.insert(message).values({
      id: generateUUID(),
      chatId: testChatId,
      role: "assistant",
      parts: [{ type: "text", text: "Answer" }],
      attachments: [],
      createdAt: new Date(),
    });

    const [statsWithAssistant] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, testUserId),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user"),
        ),
      )
      .execute();

    console.log(
      `Message count with assistant message: ${statsWithAssistant.count}`,
    );
    if (statsWithAssistant.count === 5) {
      console.log("SUCCESS: Assistant messages are correctly ignored.");
    }
  } catch (error) {
    console.error("Error during verification:", error);
  } finally {
    // Cleanup
    console.log("Cleaning up test data...");
    try {
      await db.delete(message).where(eq(message.chatId, testChatId));
      await db.delete(chat).where(eq(chat.id, testChatId));
      await db.delete(user).where(eq(user.id, testUserId));
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
    await connection.end();
  }
}

verify();
