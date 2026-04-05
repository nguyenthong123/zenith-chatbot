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
  const { message, event_name } = body;
  log(`[Event] Received event_name: ${event_name}`);

  if (!message) {
    log(`Received event without message contents: ${event_name}`);
    return;
  }

  try {
    // 1. ID Extraction (Zalo OA stores ID in sender.id or from.id)
    const fromId = body.sender?.id || message.from?.id;
    const chatId = fromId; // For Zalo OA, the recipient ID for responses is the sender's ID
    const text = (message.text || "").trim();

    log(`[IDs] extracted fromId: ${fromId}, text: ${text}`);

    if (!fromId) {
      log("Error: Could not extract sender ID from Zalo event body");
      return;
    }

    // 2. Deduplication
    const messageId = message.message_id || message.msg_id;
    if (messageId) {
      if (processedMessageIds.has(messageId)) {
        log(`Duplicate message detected, skipping: ${messageId}`);
        return;
      }
      processedMessageIds.add(messageId);
      // Basic house keeping for memory
      if (processedMessageIds.size > 1000) {
        const firstId = processedMessageIds.values().next().value;
        if (firstId) processedMessageIds.delete(firstId);
      }
    }

    // 3. Media (Image) Processing
    let photoUrl = message.photo_url;
    if (!photoUrl && message.attachments && message.attachments.length > 0) {
      const imgAttachment = message.attachments.find(
        (att: any) => att.type === "image" || att.type === "photo",
      );
      if (imgAttachment) {
        photoUrl = imgAttachment.payload?.url || imgAttachment.url;
      }
    }

    // 4. Authenticate User (by Zalo ID)
    const users = await getUserByZaloId(fromId);
    const user = users[0];

    // 5. Handle Linking Flow
    if (!user) {
      log(`[Auth] User not found for Zalo ID: ${fromId}`);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedText = text.toLowerCase();

      log(`[Link] Checking if message '${trimmedText}' is an email...`);

      if (emailRegex.test(trimmedText)) {
        log(`[Link] Email detected: ${trimmedText}. Searching database...`);
        const existingUsers = await getUserByEmail(trimmedText);
        log(
          `[Link] Found ${existingUsers.length} users with email ${trimmedText}`,
        );

        if (existingUsers.length > 0) {
          const targetUser = existingUsers[0];
          log(
            `[Link] Linking Zalo ID ${fromId} to user ${targetUser.id} (${targetUser.email})`,
          );
          await updateUserZaloId(targetUser.id, fromId);

          await zaloClient.sendText(
            chatId,
            "✅ Đã kết nối tài khoản thành công! Bây giờ bạn có thể chat với trợ lý Zenith.",
          );
          return;
        }

        log(
          `[Link] Email '${trimmedText}' is not registered in our 'users' table.`,
        );
        await zaloClient.sendText(
          chatId,
          `❌ Không tìm thấy tài khoản với email: ${trimmedText}. Vui lòng đăng ký tài khoản trên website trước khi kết nối.`,
        );
        return;
      }

      log(`[Link] Prompting user for email registration.`);
      await zaloClient.sendText(
        chatId,
        "Chào bạn! Tôi là trợ lý Zenith. Vui lòng nhập Email đã đăng ký trên hệ thống để kết nối và bắt đầu trò chuyện.",
      );
      return;
    }

    log(`[Auth] Authenticated user: ${user.email} (ID: ${user.id})`);

    // 6. AI Conversation Processing
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

    // Save Chat & Message
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

    log(`[AI] Processing AI response for ${user.email}...`);

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
      onToolCall: async () => {
        if (!hasSentIndicator) {
          await zaloClient.sendText(
            chatId,
            "🔍 Đang tra cứu dữ liệu, vui lòng chờ trong giây lát...",
          );
          hasSentIndicator = true;
        }
      },
    });

    log(`[AI] Response generated. Saving to DB...`);

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

    log(`[Zalo] Sending AI reply to user...`);
    const sent = await zaloClient.sendText(chatId, result.text);
    log(`[Zalo] Result: ${JSON.stringify(sent)}`);
  } catch (error: any) {
    log(`FATAL ERROR in processZaloEvent: ${error.message}\n${error.stack}`);
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "ok", service: "Zalo Webhook" });
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const secretFromHeader = request.headers.get("x-bot-api-secret-token");

    // Debug Log (Vercel console)
    console.log(`[ZaloWebhookIncoming] Body: ${JSON.stringify(body, null, 2)}`);

    // We await to keep the Lambda alive until the processing is truly finished
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
