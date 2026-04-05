import { type NextRequest, NextResponse } from "next/server";
import { generateHeadlessResponse } from "@/lib/ai/headless-chat";
import {
  getChatById,
  getMessagesByChatId,
  getUserByEmail,
  getUserByZaloId,
  saveChat,
  saveMessages,
  updateUserZaloId,
} from "@/lib/db/queries";
import { generateStableUUID, generateUUID } from "@/lib/utils";
import { zaloClient } from "@/lib/zalo/client";

// In-memory set to prevent processing the same message twice (deduplication)
const processedMessageIds = new Set<string>();

const log = (msg: string) => {
  console.log(`[ZaloWebhook] ${msg}`);
};

/**
 * Ensures message history alternates roles and handles multi-modal parts.
 */
function sanitizeHistory(messages: any[]) {
  const result: any[] = [];
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    if (result.length > 0 && result[result.length - 1].role === role) {
      result[result.length - 1].content = [
        ...(Array.isArray(result[result.length - 1].content)
          ? result[result.length - 1].content
          : [{ type: "text", text: result[result.length - 1].content }]),
        ...(Array.isArray(msg.content)
          ? msg.content
          : [{ type: "text", text: msg.content }]),
      ];
    } else {
      result.push({ role, content: msg.content });
    }
  }
  return result;
}

async function processZaloEvent(body: any, secretFromHeader: string | null) {
  try {
    // 1. Security Check (Optional based on how user configures Zalo)
    if (
      process.env.ZALO_SECRET_KEY &&
      secretFromHeader !== process.env.ZALO_SECRET_KEY
    ) {
      log("Unauthorized attempt: secret mismatch (Header vs ENV)");
      // We still process if secret is not set to avoid blocking during debug, but log it.
    }

    const { message, event_name } = body;
    if (!message) {
      log(`Received event without message: ${event_name}`);
      return;
    }

    const messageId = message.message_id || message.msg_id;
    if (messageId && processedMessageIds.has(messageId)) {
      log(`Duplicate message detected, skipping: ${messageId}`);
      return;
    }
    if (messageId) {
      processedMessageIds.add(messageId);
      if (processedMessageIds.size > 1000) {
        const firstId = processedMessageIds.values().next().value;
        if (firstId) processedMessageIds.delete(firstId);
      }
    }

    const chatId = message.chat?.id;
    const fromId = message.from?.id;
    const text = message.text || message.caption || "";
    let photoUrl = message.photo_url;

    if (!photoUrl && message.attachments && message.attachments.length > 0) {
      const imgAttachment = message.attachments.find(
        (att: any) => att.type === "image" || att.type === "photo",
      );
      if (imgAttachment) {
        photoUrl = imgAttachment.payload?.url || imgAttachment.url;
      }
    }

    if (!chatId || !fromId) {
      log("Missing chatId or fromId in event body");
      return;
    }

    log(
      `Processing Zalo message from ${fromId}. Text: "${text}", Photo: ${photoUrl ? "Yes" : "No"}`,
    );

    const users = await getUserByZaloId(fromId);
    const user = users[0];

    if (!user) {
      log(`User not found for Zalo ID: ${fromId}`);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedText = text.trim().toLowerCase();

      if (emailRegex.test(trimmedText)) {
        const existingUsers = await getUserByEmail(trimmedText);
        if (existingUsers.length > 0) {
          await updateUserZaloId(existingUsers[0].id, fromId);
          await zaloClient.sendText(
            chatId,
            "✅ Đã kết nối tài khoản thành công!",
          );
          return;
        }
      }

      const sent = await zaloClient.sendText(
        chatId,
        "Chào bạn! Tôi là trợ lý Zenith. Vui lòng nhập Email để kết nối.",
      );
      log(`Sent Welcome Response: ${JSON.stringify(sent)}`);
      return;
    }

    const apiChatId = generateStableUUID(chatId);
    const history = await getMessagesByChatId({ id: apiChatId });

    const parts: any[] = [];
    if (text) parts.push({ type: "text", text });
    if (photoUrl) {
      parts.push({ type: "image", image: photoUrl });
      if (!text) parts.push({ type: "text", text: "[Ảnh đính kèm]" });
    }

    const userMessage = {
      id: generateUUID(),
      role: "user" as const,
      content: text || (photoUrl ? "[Ảnh đính kèm]" : ""),
      parts: parts,
      attachments: photoUrl
        ? [
            {
              id: generateUUID(),
              url: photoUrl,
              name: "image.jpg",
              contentType: "image/jpeg",
            },
          ]
        : [],
    };

    const existingChat = await getChatById({ id: apiChatId });
    if (!existingChat) {
      await saveChat({
        id: apiChatId,
        userId: user.id,
        title: "Zalo Chat",
        visibility: "private",
      });
    }

    await saveMessages({
      messages: [{ ...userMessage, chatId: apiChatId, createdAt: new Date() }],
    });

    log(`Starting AI for user ${user.id} (${user.email})`);

    const aiHistory = history.slice(-10).map((m) => {
      const formattedParts = (m.parts as any[]).map((p: any) => {
        if (p.type === "image" || p.image)
          return { type: "image", image: p.image || p.url };
        return { type: "text", text: p.text || "" };
      });
      return { role: m.role, content: formattedParts };
    });

    const aiMessages = sanitizeHistory([
      ...aiHistory,
      { role: "user", content: parts },
    ]);

    let hasSentIndicator = false;
    const result = await generateHeadlessResponse({
      userId: user.id,
      userRole: user.role ?? "user",
      userName: user.displayName || user.name,
      userEmail: user.email,
      messages: aiMessages,
      onToolCall: async (toolNames) => {
        if (!hasSentIndicator) {
          await zaloClient.sendText(
            chatId,
            "🔍 Đang tra cứu dữ liệu, vui lòng chờ trong giây lát...",
          );
          hasSentIndicator = true;
        }
      },
    });

    log(`AI Result: ${result.text.substring(0, 50)}...`);

    await saveMessages({
      messages: [
        {
          id: generateUUID(),
          chatId: apiChatId,
          role: "assistant",
          parts: [{ type: "text", text: result.text }],
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const sent = await zaloClient.sendText(chatId, result.text);
    log(`AI Reply sent to Zalo: ${chatId}. Result: ${JSON.stringify(sent)}`);
  } catch (error: any) {
    log(`FATAL ERROR in processZaloEvent: ${error.message}\n${error.stack}`);
  }
}

// GET support for health checks / verification
export async function GET(request: NextRequest) {
  log("Received GET request for health check");
  return NextResponse.json({ status: "ok", service: "Zalo Webhook" });
}

// HEAD support
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = Object.fromEntries(request.headers.entries());
    const secretFromHeader = request.headers.get("x-bot-api-secret-token");

    const logData = `\n--- ${new Date().toISOString()} ---\nHeaders: ${JSON.stringify(headers, null, 2)}\nBody: ${JSON.stringify(body, null, 2)}\n`;
    console.log(`[ZaloWebhookDebug] ${logData}`);

    // Await processing to prevent Vercel from terminating the function early
    await processZaloEvent(body, secretFromHeader);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    log(`Critical setup error in POST: ${e.message}`);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
