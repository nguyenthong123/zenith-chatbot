import { google } from "@ai-sdk/google";
import { generateText, tool } from "ai";
import { z } from "zod";
import { getVietnamTimeString } from "../../lib/ai/prompts";
import * as dbQueries from "../../lib/db/queries";
import { generateStableUUID } from "../../lib/utils";
import * as bizTools from "./business-tools";
import { webSearch } from "./search-tools";

// gemini-2.5-flash — thinking disabled via providerOptions in generateText
const model = google("gemini-2.0-flash");

// Timeout limits for Gemini generateText calls (prevents indefinite hangs)
const PASS_1_TIMEOUT_MS = 30_000;
const PASS_2_TIMEOUT_MS = 25_000;

export interface AgentContext {
  telegramId: string;
  chatId: string;
  ownerId?: string;
  user?: any;
  isGuest?: boolean;
}

export interface MessageAttachment {
  url: string;
  contentType: string;
}

export async function processMessage(
  userMessage: string,
  context: AgentContext,
  attachments: MessageAttachment[] = [],
) {
  const { telegramId, chatId, ownerId = telegramId, user } = context;
  const chatUUID = generateStableUUID(`tg-chat-${chatId}`);
  const isGuest = user?.role === "guest" || !ownerId;

  console.log(
    `\n[BOT] >>> INCOMING: "${userMessage}" | Guest: ${isGuest} | Owner: ${ownerId}`,
  );

  // 1. History Fetching & Advanced Gemini Synchronization (The Final Protocol)
  let dbMessages: any[] = [];
  try {
    dbMessages = await dbQueries.getMessagesByChatId({ id: chatUUID });

    const rolePriority: Record<string, number> = {
      user: 0,
      assistant: 1,
      tool: 2,
    };
    dbMessages.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (rolePriority[a.role] || 0) - (rolePriority[b.role] || 0);
    });
  } catch (_e) {
    console.error("[Agent] History Fetch Error:", _e);
  }

  // NORMALIZE field names for AI SDK v6 compatibility
  // SDK v6 requires: tool-call.input (not args), tool-result.output = { type: 'json', value: ... }
  const normalizedMessages = dbMessages.map((m) => {
    if (!Array.isArray(m.parts)) return m;
    const cleanParts = m.parts.map((p: any) => {
      const np = { ...p };
      if (p.tool_call_id && !p.toolCallId) np.toolCallId = p.tool_call_id;

      if (p.type === "tool-call") {
        // SDK v6 uses 'input' not 'args'
        if (p.args && !p.input) {
          np.input = p.args;
          delete np.args;
        }
      }
      if (p.type === "tool-result") {
        // SDK v6 requires output = { type: 'json'|'text', value: ... }
        const rawValue = p.result ?? p.output;
        if (rawValue !== undefined) {
          if (
            typeof rawValue === "object" &&
            rawValue?.type &&
            rawValue?.value !== undefined
          ) {
            // Already in SDK v6 format
            np.output = rawValue;
          } else if (typeof rawValue === "string") {
            np.output = { type: "text", value: rawValue };
          } else {
            np.output = { type: "json", value: rawValue };
          }
        }
        delete np.result;
      }
      return np;
    });
    return { ...m, parts: cleanParts };
  });

  const allToolCallIds = new Set<string>();
  const allToolResultIds = new Set<string>();
  normalizedMessages.forEach((m) => {
    if (Array.isArray(m.parts)) {
      m.parts.forEach((p: any) => {
        if (p.type === "tool-call" && p.toolCallId)
          allToolCallIds.add(p.toolCallId);
        if (p.type === "tool-result" && p.toolCallId)
          allToolResultIds.add(p.toolCallId);
      });
    }
  });

  const syncToolIds = new Set(
    [...allToolCallIds].filter((id) => allToolResultIds.has(id)),
  );
  const orphanedCallIds = [...allToolCallIds].filter(
    (id) => !allToolResultIds.has(id),
  );
  const orphanedResultIds = [...allToolResultIds].filter(
    (id) => !allToolCallIds.has(id),
  );
  if (orphanedCallIds.length > 0 || orphanedResultIds.length > 0) {
    console.log(
      `[Agent] Orphan Suppression: ${orphanedCallIds.length} orphaned calls, ${orphanedResultIds.length} orphaned results stripped`,
    );
  }

  // Filter out any orphaned tool calls or results to keep Gemini happy
  const cleanedMessages: any[] = normalizedMessages
    .map((m) => {
      const partsArray = Array.isArray(m.parts) ? m.parts : [];
      const validParts = partsArray.filter((p: any) => {
        if (p.type === "tool-call" || p.type === "tool-result") {
          return p.toolCallId && syncToolIds.has(p.toolCallId);
        }
        return true;
      });
      return { ...m, parts: validParts };
    })
    .filter((m) => m.parts.length > 0);

  const history: any[] = [];
  const processedIds = new Set<string>();

  cleanedMessages.forEach((m) => {
    if (processedIds.has(m.id)) return;

    if (m.role === "assistant") {
      const toolCallIdsInMsg = m.parts
        .filter((p: any) => p.type === "tool-call")
        .map((p: any) => p.toolCallId);

      if (toolCallIdsInMsg.length > 0) {
        // 1. Assistant Call
        history.push({ role: "assistant", content: m.parts });
        processedIds.add(m.id);

        // 2. CONSOLIDATE results immediately after the call
        const results: any[] = [];
        cleanedMessages.forEach((im) => {
          if (processedIds.has(im.id) || im.role !== "tool") return;
          const matching = (Array.isArray(im.parts) ? im.parts : []).filter(
            (p: any) =>
              p.type === "tool-result" &&
              toolCallIdsInMsg.includes(p.toolCallId),
          );
          if (matching.length > 0) {
            results.push(...matching);
            // If message only contains synced results for THIS turn, mark as processed
            const allPartsMatched = im.parts.every(
              (p: any) =>
                p.type === "tool-result" &&
                toolCallIdsInMsg.includes(p.toolCallId),
            );
            if (allPartsMatched) processedIds.add(im.id);
          }
        });

        if (results.length > 0) {
          history.push({ role: "tool", content: results });
        }
      } else {
        history.push({ role: "assistant", content: m.parts });
        processedIds.add(m.id);
      }
    } else {
      history.push({ role: m.role, content: m.parts });
      processedIds.add(m.id);
    }
  });

  // CRITICAL: Strip providerOptions (thoughtSignature) from historical parts
  // Stale thought signatures cause Gemini to hang indefinitely on Step 1
  history.forEach((msg) => {
    if (Array.isArray(msg.content)) {
      msg.content = msg.content.map((p: any) => {
        const { providerOptions, ...clean } = p;
        return clean;
      });
    }
  });

  const newUserMessage: any = {
    role: "user",
    content:
      attachments.length > 0
        ? [
            { type: "text", text: userMessage },
            ...attachments.map((a) => ({ type: "image", image: a.url })),
          ]
        : userMessage,
  };

  // === GEMINI TURN-TAKING VALIDATOR ===
  // Gemini rules:
  // 1. assistant(tool-call) must come after user OR tool(result)
  // 2. tool(result) must come immediately after assistant(tool-call)
  // 3. No two consecutive assistant messages if the second has tool-call
  // 4. History must not start with tool or assistant(tool-call)

  const validatedHistory: any[] = [];
  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const hasToolCall =
      Array.isArray(msg.content) &&
      msg.content.some((p: any) => p.type === "tool-call");
    const hasToolResult =
      Array.isArray(msg.content) &&
      msg.content.some((p: any) => p.type === "tool-result");
    const prev = validatedHistory[validatedHistory.length - 1];
    const prevRole = prev?.role;
    const prevHasToolCall =
      prev &&
      Array.isArray(prev.content) &&
      prev.content.some((p: any) => p.type === "tool-call");

    if (msg.role === "assistant" && hasToolCall) {
      // Rule 1: assistant(tool-call) only after user or tool
      if (prevRole === "user" || prevRole === "tool") {
        validatedHistory.push(msg);
      }
      // else: skip this tool-call turn — it would violate Gemini rules
    } else if (msg.role === "tool") {
      // Rule 2: tool only after assistant(tool-call)
      if (prevRole === "assistant" && prevHasToolCall) {
        validatedHistory.push(msg);
      }
      // else: orphaned tool result — skip
    } else if (msg.role === "assistant") {
      // Plain assistant text — merge consecutive assistants
      if (prevRole === "assistant" && !prevHasToolCall) {
        // Merge into previous assistant message
        const prevContent = Array.isArray(prev.content)
          ? prev.content
          : [{ type: "text", text: prev.content }];
        const curContent = Array.isArray(msg.content)
          ? msg.content
          : [{ type: "text", text: msg.content }];
        prev.content = [...prevContent, ...curContent];
      } else {
        validatedHistory.push({ ...msg });
      }
    } else {
      // user messages
      validatedHistory.push(msg);
    }
  }

  // Take last 4 turns only — large history causes Gemini 2.5-flash to hang on Step 1
  const historySlice = validatedHistory.slice(-4);
  while (
    historySlice.length > 0 &&
    (historySlice[0].role === "tool" ||
      (historySlice[0].role === "assistant" &&
        Array.isArray(historySlice[0].content) &&
        historySlice[0].content.some((p: any) => p.type === "tool-call")))
  ) {
    historySlice.shift();
  }
  const currentMessages: any[] = [...historySlice, newUserMessage];

  const contextImageUrls: string[] = [];
  history.slice(-2).forEach((msg) => {
    if (Array.isArray(msg.content)) {
      msg.content.forEach((p: any) => {
        if (p.type === "image" && p.image) contextImageUrls.push(p.image);
      });
    }
  });
  for (const a of attachments) {
    contextImageUrls.push(a.url);
  }

  // 3. Generate Response — Manual 2-pass to avoid SDK multi-step hang with gemini-2.5-flash
  const systemPrompt = `Bạn là Diamond AI - Trợ lý Kinh doanh chuyên nghiệp.
      
      *** QUY TẮC CỐ ĐỊNH ***
      1. TRA CỨU & HIỂN THỊ (FRONTEND): Khi khách muốn XEM sản phẩm hoặc ảnh, hãy gọi 'productLookup'. Tool này sẽ tự động trả về thông tin chi tiết và link ảnh. Bạn chỉ cần tóm tắt lại thông tin văn bản. Việc gửi ảnh thật sẽ do hệ thống tự động xử lý dựa trên kết quả Tool.
      2. TÌM KIẾM INTERNET: Nếu khách hỏi về thông tin bên ngoài (giá sắt thép, tin tức, thời tiết, kiến thức chung) mà Database không có, hãy dùng 'webSearch'.
      3. LƯU TRỮ & CẬP NHẬT (BACKEND): Khi khách muốn LƯU hoặc CẬP NHẬT sản phẩm/ảnh, hãy gọi 'updateProductImage' hoặc 'saveProduct'. Các Tool này chỉ làm nhiệm vụ ghi vào Database. Sau khi hoàn tất, hãy thông báo xác nhận thành công cho khách.
      4. NGÔN NGỮ & ĐỊNH DẠNG: Trả lời bằng tiếng Việt. Chỉ sử dụng HTML <b>, <i>, <a>, <code>. TUYỆT ĐỐI KHÔNG dùng Markdown. QUAN TRỌNG: TUYỆT ĐỐI KHÔNG ĐƯỢC XIN LỖI về việc không thể gửi hình ảnh. HỆ THỐNG SẼ TỰ ĐỘNG HIỂN THỊ ẢNH CHO KHÁCH. Bạn chỉ cần trả lời ngắn gọn: "Sản phẩm của bạn đây."
      5. KHÔNG TRẢ LỜI RỖNG: Luôn viết ít nhất một câu kết sau khi tra cứu.
      
      THÔNG TIN NGỮ CẢNH:
      - ${getVietnamTimeString()}
      - OWNER_ID: "${ownerId}"
      - CONTEXT_IMAGES: ${contextImageUrls.length} ảnh trong phiên làm việc.`;

  const allTools = {
    productLookup: tool({
      description: "TRA CỨU VÀ HIỂN THỊ: Tìm kiếm sản phẩm trong kho.",
      inputSchema: z.object({
        query: z.string().describe("Tên hoặc SKU sản phẩm"),
      }),
      execute: async ({ query }) => {
        const products = await dbQueries.getProductsByNameAndUser({
          name: query,
          userId: ownerId,
        });
        if (!products || products.length === 0)
          return { success: false, message: "Không tìm thấy sản phẩm." };
        const p = products[0];
        const img = p.imageUrls ? p.imageUrls.split(",")[0].trim() : null;
        return {
          success: true,
          message: `📦 Sản phẩm: <b>${p.name}</b>\n💰 Giá: ${(p.priceSell || 0).toLocaleString()} VNĐ\n📉 Tồn kho: ${p.stock}`,
          photoUrl: img,
        };
      },
    }),
    webSearch,
    updateProductImage: tool({
      description: "LƯU TRỮ (BACKEND): Cập nhật ảnh cho sản phẩm.",
      inputSchema: z.object({
        productName: z.string(),
        imageUrls: z.array(z.string()).optional(),
      }),
      execute: async (args: any) => {
        if (!args.imageUrls?.length && contextImageUrls.length > 0)
          args.imageUrls = [contextImageUrls[contextImageUrls.length - 1]];
        return {
          success: true,
          message: await (bizTools.updateProductImageTool.execute as any)({
            ...args,
            ownerId,
          }),
        };
      },
    }),
    saveProduct: tool({
      description: "LƯU TRỮ (BACKEND): Lưu sản phẩm mới.",
      inputSchema: z.object({
        name: z.string(),
        priceSell: z.number().optional(),
        imageUrls: z.array(z.string()).optional(),
      }),
      execute: async (args: any) => {
        if (!args.imageUrls?.length && contextImageUrls.length > 0)
          args.imageUrls = [contextImageUrls[contextImageUrls.length - 1]];
        return {
          success: true,
          message: await (bizTools.saveProductTool.execute as any)({
            ...args,
            ownerId,
          }),
        };
      },
    }),
  };

  // Helper: wrap a promise with a timeout to prevent indefinite Gemini hangs
  const withTimeout = <T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error(`[Agent] ${label} timed out after ${ms / 1000}s`)),
        ms,
      );
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  };

  let result: any;
  try {
    // Pass 1: Gemini decides what to do — tools have NO execute so SDK won't auto-run them
    const declarationTools = {
      productLookup: tool({
        description: "TRA CỨU sản phẩm trong kho.",
        inputSchema: z.object({ query: z.string() }),
      }),
      webSearch: tool({
        description: "Tìm kiếm thông tin trên Internet.",
        inputSchema: z.object({ query: z.string() }),
      }),
      updateProductImage: tool({
        description: "Cập nhật ảnh sản phẩm.",
        inputSchema: z.object({
          productName: z.string(),
          imageUrls: z.array(z.string()).optional(),
        }),
      }),
      saveProduct: tool({
        description: "Lưu sản phẩm mới.",
        inputSchema: z.object({
          name: z.string(),
          priceSell: z.number().optional(),
          imageUrls: z.array(z.string()).optional(),
        }),
      }),
    };

    console.log(
      `[Agent] Pass 1: Sending ${currentMessages.length} messages to Gemini`,
    );
    result = await withTimeout(
      generateText({
        model,
        system: systemPrompt,
        messages: currentMessages,
        tools: declarationTools,
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 0 } },
        },
      }),
      PASS_1_TIMEOUT_MS,
      "Pass 1",
    );
    console.log(
      `[Agent] Pass 1 done | Text: ${result.text?.length || 0} chars | ToolCalls: ${result.toolCalls?.length || 0}`,
    );

    // If Gemini wants to call tools, execute them manually
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCallParts: any[] = [];
      const toolResultParts: any[] = [];

      for (const tc of result.toolCalls) {
        const args = tc.args || (tc as any).input || {};
        console.log(
          `[Agent] Executing tool: ${tc.toolName}`,
          JSON.stringify(args).slice(0, 200),
        );

        let toolOutput: any;
        const toolOpts = {
          toolCallId: tc.toolCallId,
          messages: currentMessages,
        } as any;
        if (tc.toolName === "webSearch") {
          toolOutput = await allTools.webSearch.execute?.(args, toolOpts);
        } else if (tc.toolName === "productLookup") {
          toolOutput = await allTools.productLookup.execute?.(args, toolOpts);
        } else if (tc.toolName === "updateProductImage") {
          toolOutput = await allTools.updateProductImage.execute?.(
            args,
            toolOpts,
          );
        } else if (tc.toolName === "saveProduct") {
          toolOutput = await allTools.saveProduct.execute?.(args, toolOpts);
        } else {
          toolOutput = { error: `Unknown tool: ${tc.toolName}` };
        }
        console.log(
          `[Agent] Tool result:`,
          JSON.stringify(toolOutput).slice(0, 200),
        );

        toolCallParts.push({
          type: "tool-call" as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: args,
        });
        toolResultParts.push({
          type: "tool-result" as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          output:
            typeof toolOutput === "string"
              ? { type: "text" as const, value: toolOutput }
              : { type: "json" as const, value: toolOutput },
        });
      }

      // Pass 2: Fresh call with tool results — no thinking to avoid hang
      const pass2Messages = [
        ...currentMessages,
        { role: "assistant" as const, content: toolCallParts },
        { role: "tool" as const, content: toolResultParts },
      ];
      console.log(`[Agent] Pass 2: Sending ${pass2Messages.length} messages`);
      result = await withTimeout(
        generateText({
          model,
          system: systemPrompt,
          messages: pass2Messages,
          providerOptions: {
            google: { thinkingConfig: { thinkingBudget: 0 } },
          },
        }),
        PASS_2_TIMEOUT_MS,
        "Pass 2",
      );
      console.log(
        `[Agent] Pass 2 done | Text: ${result.text?.length || 0} chars`,
      );
    }
  } catch (e: any) {
    console.error(`[Agent] CRITICAL ERROR during Generation:`, e);
    throw e;
  }

  // 4. Persistence
  try {
    if (!isGuest && result) {
      await dbQueries.saveChat({
        id: chatUUID,
        userId: ownerId,
        title: userMessage.slice(0, 50) || "Telegram Chat",
        visibility: "private",
      });
      await dbQueries.saveMessages({
        messages: [
          {
            id: generateStableUUID(`${chatUUID}-user-${Date.now()}`),
            chatId: chatUUID,
            role: "user",
            parts: newUserMessage.content as any,
            attachments: [],
          },
          ...result.response.messages.map((m: any, idx: number) => ({
            id: generateStableUUID(`${chatUUID}-resp-${Date.now()}-${idx}`),
            chatId: chatUUID,
            role: m.role as "assistant",
            parts: m.content as any,
            attachments: [],
          })),
        ],
      });
    }
  } catch (_e: any) {
    console.warn("[Agent] Persistence skipped:", _e.message);
  }
  console.log("[DEBUG] Agent Returning Result:", JSON.stringify(result, null, 2).slice(0, 500));

  return result;
}
