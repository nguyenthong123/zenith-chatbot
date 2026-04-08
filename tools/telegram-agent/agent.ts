import * as path from "node:path";
import { generateText, tool } from "ai";
import * as dotenv from "dotenv";
import { z } from "zod";
import * as dbQueries from "../../lib/db/queries";
import { generateStableUUID } from "../../lib/utils";
import * as bizTools from "./business-tools";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { DEFAULT_CHAT_MODEL } from "../../lib/ai/models";
import { getLanguageModel } from "../../lib/ai/providers";

const modelId = DEFAULT_CHAT_MODEL;
const model = getLanguageModel(modelId);
console.log(`Bot using stable model: ${modelId}`);

export interface AgentContext {
  chatId: string;
  telegramId: string;
  user?: any;
  isGuest: boolean;
}

export async function processMessage(
  userMessage: string,
  context: AgentContext,
  attachments: { url: string; contentType: string }[] = [],
) {
  const { chatId, telegramId, user, isGuest } = context;
  const ownerId = user?.id;

  if (!ownerId) {
    return {
      text: "⚠️ Vui lòng đăng nhập để tiếp tục. Hãy gửi email và mật khẩu của bạn.",
    };
  }

  const chatUUID = generateStableUUID(`tg-chat-${chatId}`);

  // 1. Fetch History from DB
  const dbMessages = await dbQueries.getMessagesByChatId({ id: chatUUID });
  const history: any[] = dbMessages.map((m) => {
    const attachments = (m.attachments as any[]) || [];
    if (attachments.length > 0) {
      return {
        role: m.role,
        content: [
          { type: "text", text: String(m.parts) },
          ...attachments.map((a) => ({
            type: "image",
            image: a.url,
          })),
        ],
      };
    }
    return {
      role: m.role,
      content: m.parts,
    };
  });

  // 2. Add current user message with multimodal parts if attachments exist
  const newUserMessage: any = {
    role: "user",
    content:
      attachments.length > 0
        ? [
            { type: "text", text: userMessage },
            ...attachments.map((a) => ({
              type: "image",
              image: a.url,
            })),
          ]
        : userMessage,
  };

  const currentMessages: any[] = [...history, newUserMessage].slice(-40);

  // 3. Generate Response
  const result = await generateText({
    model,
    messages: currentMessages,
    system: `Bạn là Diamond AI - Trợ lý Kinh doanh Cấp cao và Thông minh nhất (Phiên bản Telegram). 
    Phong cách của bạn là: Tinh tế, Chuyên nghiệp, Nhạy bén và Luôn sẵn sàng hành động.
    
    Người đang chat với bạn là chủ sở hữu hoặc nhân viên của hệ thống kinh doanh.
    
    *** THÔNG TIN NGƯỜI DÙNG HIỆN TẠI ***
    - Hồ sơ: ${user?.name || "Khách (Guest)"}
    - ID: ${user?.id || "N/A"}
    - Email: ${user?.email || "Chưa có"}
    - Vai trò: ${user?.role || "guest"}
    - Chế độ: ${isGuest ? "GUEST MODE (Hạn chế)" : "LOGGED IN (Toàn quyền)"}
    
    *** HƯỚNG DẪN CHIẾN THUẬT ***
    - OWNER_ID ĐỊNH DANH: "${ownerId}" (BẮT BUỘC sử dụng ID này cho tất cả các công tác truy xuất dữ liệu).
    
    *** NHIỆM VỤ TRỌNG TÂM ***
    1. QUY TRÌNH ĐĂNG NHẬP: Nếu người dùng cung cấp Email và Mật khẩu, hãy gọi công cụ 'login' NGAY LẬP TỨC để xác thực danh tính.
    2. QUẢN TRỊ DỮ LIỆU: Cung cấp báo cáo chính xác về doanh thu, đơn hàng và khách hàng dựa trên dữ liệu thời gian thực.
    3. XỬ LÝ ĐA PHƯƠNG TIỆN: 
       - Nếu nhận được ảnh vừa upload từ [HỆ THỐNG], hãy ghi nhớ link để sẵn sàng cập nhật cho sản phẩm khi được yêu cầu.
       - Khi tra cứu sản phẩm ('productLookup'): Luôn hiển thị hình ảnh sản phẩm (nếu có) thông qua Markdown (Telegram sẽ tự động tạo preview).
       - Nếu khách hàng muốn "xem hình" của sản phẩm vừa nhắc đến, hãy cung cấp hình ảnh của đúng sản phẩm đó một cách trực quan nhất.
    4. GIAO TIẾP: Sử dụng Tiếng Việt chuẩn mực, lịch sự nhưng vô cùng năng động. Dùng Markdown hoặc HTML nhẹ (<b>, <code>) để làm nổi bật thông tin quan trọng.
    5. TÀI CHÍNH: Hiển thị tiền tệ VNĐ rõ ràng (VD: 1.000.000 VNĐ).
    6. PHẢN HỒI: Súc tích, đi thẳng vào vấn đề trừ khi cần phân tích chuyên sâu. Luôn thể hiện mình là một trợ lý đắc lực, thấu hiểu công việc kinh doanh.`,
    tools: {
      login: tool({
        description:
          "Đăng nhập bằng email và mật khẩu để liên kết với Telegram.",
        inputSchema: z.object({
          email: z.string().email().describe("Email đăng nhập"),
          password: z.string().describe("Mật khẩu"),
        }),
        execute: async ({ email, password }: any) => {
          return await (bizTools.loginTool.execute as any)({
            email,
            password,
            telegramId,
            chatId,
          });
        },
      }),
      logout: tool({
        description: "Đăng xuất khỏi tài khoản hiện tại.",
        inputSchema: z.object({}),
        execute: async () => {
          return await (bizTools.logoutTool.execute as any)({ telegramId });
        },
      }),
      switchAccount: tool({
        description: "Chuyển giữa Guest và tài khoản đã liên kết.",
        inputSchema: z.object({
          toGuest: z
            .boolean()
            .describe("True = Guest, False = Tài khoản riêng"),
        }),
        execute: async ({ toGuest }: any) => {
          return await (bizTools.switchAccountTool.execute as any)({
            toGuest,
            telegramId,
          });
        },
      }),
      productLookup: tool({
        description: bizTools.productLookup.description,
        inputSchema: z.object({
          query: z.string().describe("Tên sản phẩm"),
        }),
        execute: async ({ query }: any) => {
          return await (bizTools.productLookup.execute as any)({
            query,
            ownerId,
          });
        },
      }),
      orderLookup: tool({
        description: bizTools.orderLookup.description,
        inputSchema: z.object({
          limit: z.number().optional().default(5),
        }),
        execute: async ({ limit }: any) => {
          return await (bizTools.orderLookup.execute as any)({
            userId: ownerId,
            limit,
          });
        },
      }),
      saveProduct: tool({
        description: bizTools.saveProductTool.description,
        inputSchema: z.object({
          name: z.string(),
          priceSell: z.number().optional(),
          imageUrls: z.array(z.string()).optional(),
        }),
        execute: async (args: any) => {
          return await (bizTools.saveProductTool.execute as any)({
            ...args,
            ownerId,
          });
        },
      }),
      financialReport: tool({
        description: bizTools.getFinancialSummaryTool.description,
        inputSchema: z.object({}),
        execute: async () => {
          return await (bizTools.getFinancialSummaryTool.execute as any)({
            userId: ownerId,
          });
        },
      }),
      getRecentProducts: tool({
        description: bizTools.getRecentProductsTool.description,
        inputSchema: z.object({
          limit: z.number().optional().default(5),
        }),
        execute: async ({ limit }: any) => {
          return await (bizTools.getRecentProductsTool.execute as any)({
            userId: ownerId,
            limit,
          });
        },
      }),
      customerLookup: tool({
        description: bizTools.customerLookup.description,
        inputSchema: z.object({
          query: z.string().optional(),
          limit: z.number().optional().default(5),
        }),
        execute: async (args: any) => {
          return await (bizTools.customerLookup.execute as any)({
            ...args,
            userId: ownerId,
          });
        },
      }),
      cashBookLookup: tool({
        description: bizTools.cashBookLookup.description,
        inputSchema: z.object({
          limit: z.number().optional().default(5),
        }),
        execute: async ({ limit }: any) => {
          return await (bizTools.cashBookLookup.execute as any)({
            userId: ownerId,
            limit,
          });
        },
      }),
      updateProductImage: tool({
        description:
          "Dùng để cập nhật hoặc thêm hình ảnh mới cho một sản phẩm hiện có. SỬ DỤNG TOOL NÀY khi người dùng gửi ảnh/các ảnh và yêu cầu cập nhật cho sản phẩm cụ thể.",
        inputSchema: z.object({
          productName: z
            .string()
            .describe("Tên sản phẩm (có thể lấy một phần tên)"),
          imageUrls: z.array(z.string()).describe("Danh sách Link ảnh mới"),
        }),
        execute: async (args: any) => {
          console.log(
            `[Agent] Calling updateProductImage for ${args.productName} with ${args.imageUrls?.length} images`,
          );
          return await (bizTools.updateProductImageTool.execute as any)({
            ...args,
            ownerId,
          });
        },
      }),
    },
    maxSteps: 10,
    onStepFinish: ({
      text,
      toolCalls,
      toolResults,
      finishReason,
      stepNumber,
    }: any) => {
      console.log(`Step ${stepNumber} Finished, reason: ${finishReason}`);
      if (toolCalls && toolCalls.length > 0) {
        console.log(
          `Tool Calls: ${toolCalls.map((tc: any) => tc.toolName).join(", ")}`,
        );
      }
      if (toolResults && toolResults.length > 0) {
        console.log(`Tool Results: ${toolResults.length} items`);
      }
      if (text) {
        console.log(`Step Text: ${text.substring(0, 100)}...`);
      }
    },
  } as any);

  console.log(
    `Generation Finished. Total Steps: ${result.steps.length}, Final Text: ${result.text ? "YES" : "NO"}`,
  );

  // 4. Persistence Logic
  try {
    // Ensure chat exists
    await dbQueries.saveChat({
      id: chatUUID,
      userId: ownerId,
      title: userMessage.slice(0, 50),
      visibility: "private",
    });

    // Save User Message
    await dbQueries.saveMessages({
      messages: [
        {
          id: generateStableUUID(`${chatUUID}-user-${Date.now()}`),
          chatId: chatUUID,
          role: "user",
          parts: userMessage,
          attachments: attachments,
          createdAt: new Date(),
        },
      ],
    });

    // Save Assistant Responses and Tool Results
    // The result from generateText has response.messages
    const messagesToSave = result.response.messages;
    if (messagesToSave.length > 0) {
      await dbQueries.saveMessages({
        messages: messagesToSave.map((m, idx) => ({
          id: generateStableUUID(`${chatUUID}-resp-${Date.now()}-${idx}`),
          chatId: chatUUID,
          role: m.role as any,
          parts: m.content as any,
          attachments: [],
          createdAt: new Date(),
        })),
      });
    }
  } catch (_err) {
    // Persistence errors are swallowed to maintain user experience
  }

  let responseText = result.text || "";

  // If result.text is empty, reconstruct from steps
  if (!responseText) {
    responseText = result.steps
      .map((step) => step.text)
      .filter(Boolean)
      .join("\n\n");
  }

  // Debug tool results
  const allToolResults = result.steps.flatMap((s) => s.toolResults);
  if (allToolResults.length > 0) {
    console.log(`Total tool results: ${allToolResults.length}`);
    allToolResults.forEach((tr, i) => {
      console.log(
        `Result ${i} (${tr.toolName}):`,
        JSON.stringify(tr.output).substring(0, 100),
      );
    });
  }

  // If still no text, fallback to the last tool result message if available
  if (!responseText && allToolResults.length > 0) {
    const lastResult = allToolResults[allToolResults.length - 1].output;
    if (typeof lastResult === "string") {
      responseText = lastResult;
    } else if (
      lastResult &&
      typeof lastResult === "object" &&
      (lastResult as any).message
    ) {
      responseText = (lastResult as any).message;
    } else {
      responseText = "✅ Đã xử lý yêu cầu của bạn thành công.";
    }
  }

  return {
    text:
      responseText ||
      "⚠️ Tôi đã nhận được yêu cầu nhưng không thể tạo ra phản hồi văn bản. Vui lòng thử lại.",
  };
}
