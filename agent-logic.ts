import * as dotenv from "dotenv";

dotenv.config();

import { google } from "@ai-sdk/google";
import { generateText, type ModelMessage } from "ai";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import type { User } from "@/lib/db/schema";
import * as bizTools from "./business-tools";

const model = getLanguageModel(DEFAULT_CHAT_MODEL);

// Store conversation history in memory (keyed by chatId)
const chatHistory: Record<string, ModelMessage[]> = {};

export interface AgentContext {
  chatId: string;
  telegramId: string;
  user?: User;
  isGuest?: boolean;
}

export async function processMessage(
  userMessage: string,
  context: AgentContext,
) {
  const { chatId, user, isGuest } = context;

  // Initialize history if needed
  if (!chatHistory[chatId]) {
    chatHistory[chatId] = [];
  }

  // Add user message to history
  chatHistory[chatId].push({
    role: "user",
    content: [{ type: "text", text: userMessage }],
  });

  // Keep history manageable
  if (chatHistory[chatId].length > 30) {
    chatHistory[chatId] = chatHistory[chatId].slice(-30);
  }

  const result = await generateText({
    model,
    messages: chatHistory[chatId],
    system: `BẠN LÀ TRỢ LÝ KINH DOANH THÔNG MINH - PHIÊN BẢN TELEGRAM.
    Người đang chat với bạn là sếp hoặc nhân viên của cửa hàng.
    
    THÔNG TIN NGƯỜI DÙNG HIỆN TẠI:
    - Hồ sơ: ${user?.name || "Khách (Guest)"}
    - ID: ${user?.id || "N/A"}
    - Email: ${user?.email || "Chưa có"}
    - Vai trò: ${user?.role || "guest"}
    - Chế độ: ${isGuest ? "GUEST MODE (Hạn chế)" : "LOGGED IN (Toàn quyền)"}
    
    NHIỆM VỤ CỦA BẠN:
    1. Tư vấn thông tin sản phẩm, đơn hàng từ database.
    2. Nếu người dùng gửi link ảnh (hoặc hệ thống báo có ảnh vừa upload), hãy dùng saveProductTool để lưu lại link đó.
    3. Trả lời chuyên nghiệp, thân thiện bằng Tiếng Việt.
    4. Xử lý các yêu cầu Đăng nhập (loginTool), Đăng ký (registerTool) và Chuyển tài khoản (switchAccountTool).
    
    LƯU Ý QUAN TRỌNG:
    - Nếu sếp gửi link ảnh từ Cloudinary, hãy tự động hỏi sếp "Sếp có muốn lưu ảnh này cho sản phẩm nào không?".
    - Nếu trả lời có JSON hoặc dữ liệu phức tạp, hãy trình bày đẹp bằng Markdown Telegram.`,
    tools: {
      login: bizTools.loginTool,
      register: bizTools.registerTool,
      switchAccount: bizTools.switchAccountTool,
      productLookup: bizTools.productLookup,
      orderLookup: bizTools.orderLookup,
      saveProduct: bizTools.saveProductTool,
    },
    maxSteps: 5,
  } as any);

  // Robust Response Synthesis
  const finalResponse = result.text;

  // Update history with the assistant's response
  if (result.text) {
    chatHistory[chatId].push({
      role: "assistant",
      content: [{ type: "text", text: result.text }],
    });
  }

  // Handle Special Tool Results (Auth Redirects)
  for (const step of result.steps) {
    if (step.toolResults) {
      for (const res of step.toolResults as any[]) {
        const responseData = res.result;
        if (responseData?.action === "login_request") {
          return {
            text: finalResponse || "Đang xử lý yêu cầu đăng nhập...",
            authAction: responseData,
          };
        }
        if (responseData?.action === "switch_request") {
          return {
            text: finalResponse || "Đang chuyển đổi định danh...",
            authAction: res.result,
          };
        }
      }
    }
  }

  return { text: finalResponse || "Tôi đã nhận được yêu cầu của bạn." };
}
