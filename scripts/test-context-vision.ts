import * as path from "node:path";
import { generateText, tool } from "ai";
import * as dotenv from "dotenv";
import { z } from "zod";

// Load ENV
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { DEFAULT_CHAT_MODEL } from "../lib/ai/models";
import { getLanguageModel } from "../lib/ai/providers";

const modelId = DEFAULT_CHAT_MODEL;
const model = getLanguageModel(modelId);

async function testContextVision() {
  console.log("--- Starting Multi-turn Vision Context Test (Final) ---");

  const imageUrl =
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000";

  const history: any[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "[Kèm theo 1 ảnh] [HỆ THỐNG: Người dùng vừa gửi một ảnh]",
        },
        { type: "image", image: imageUrl },
      ],
    },
    {
      role: "assistant",
      content:
        "Tôi đã nhận được ảnh sản phẩm giày chạy bộ Nike Free màu đỏ. Bạn muốn:\n1. Lưu sản phẩm mới\n2. Cập nhật ảnh cho sản phẩm cũ\n3. Lưu minh chứng thanh toán",
    },
  ];

  const userMessage = "Cập nhật ảnh cho sản phẩm Giày Nike Chạy Bộ";

  console.log("Calling AI with history containing an image...");

  try {
    const result = await generateText({
      model,
      messages: [...history, { role: "user", content: userMessage }],
      system: `Bạn là Diamond AI - Trợ lý Kinh doanh Cấp cao.
      
      *** XỬ LÝ ĐA PHƯƠNG TIỆN ***
      - Bạn có khả năng "nhìn" thấy hình ảnh qua vision.
      - SỬ DỤNG HÌNH ẢNH TỪ LỊCH SỬ: Khi người dùng xác nhận hành động ngay sau khi đã gửi ảnh, hãy LUÔN KIỂM TRA LỊCH SỬ (tin nhắn có tiền tố '[Kèm theo ảnh]') để lấy URL của ảnh đó. 
      - KHÔNG HỎI LẠI ẢNH. Bạn phải tự trích xuất URL ảnh từ lịch sử để điền vào 'imageUrls'.`,
      tools: {
        updateProductImage: tool({
          description:
            "Cập nhật ảnh cho sản phẩm hiện có. Hãy lấy URL ảnh từ lịch sử nếu người dùng vừa gửi.",
          inputSchema: z.object({
            productName: z.string().describe("Tên sản phẩm"),
            imageUrls: z
              .array(z.string())
              .describe("Danh sách link ảnh từ lịch sử"),
          }),
          execute: async (args: any, _opts: any) => args,
        }),
      },
    });

    console.log("\n--- AI RESPONSE ---");
    console.log("Text:", result.text || "(No text)");

    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log(
        `Raw Tool Calls: ${JSON.stringify(result.toolCalls, null, 2)}`,
      );
      for (const tc of result.toolCalls) {
        if (tc.toolName === "updateProductImage") {
          const args = (tc as any).args || (tc as any).input;
          if (args && args.imageUrls && args.imageUrls.includes(imageUrl)) {
            console.log(
              "\n✅ SUCCESS: AI correctly picked up the image URL from history!",
            );
            return;
          }
        }
      }
      console.log(
        "\n❌ FAILURE: Tool called but image URL missing or incorrect.",
      );
    } else {
      console.log("\n❌ FAILURE: AI did not call the updateProductImage tool.");
    }
  } catch (error) {
    console.error("❌ Error during test:", error);
  }
}

testContextVision().catch(console.error);
