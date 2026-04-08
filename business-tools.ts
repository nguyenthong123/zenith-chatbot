import { tool } from "ai";
import { z } from "zod";
import * as dbQueries from "./lib/db/queries";

// --- Auth Tools ---

export const loginTool = tool({
  description:
    "Đăng nhập tài khoản bằng email và mật khẩu để liên kết với Telegram này.",
  inputSchema: z.object({
    email: z.string().email().describe("Email đăng ký"),
    password: z.string().describe("Mật khẩu"),
  }),
  execute: async ({ email, password }) => {
    return { action: "login_request", email, password };
  },
});

export const registerTool = tool({
  description: "Đăng ký tài khoản mới.",
  inputSchema: z.object({
    name: z.string().describe("Tên hiển thị"),
    email: z.string().email().describe("Email"),
    password: z.string().describe("Mật khẩu"),
  }),
  execute: async ({ name, email, password }) => {
    return { action: "register_request", name, email, password };
  },
});

export const switchAccountTool = tool({
  description: "Chuyển đổi giữa chế độ Guest và tài khoản cá nhân.",
  inputSchema: z.object({
    toGuest: z
      .boolean()
      .describe(
        "True nếu muốn chuyển sang Guest, False nếu muốn chuyển sang tài khoản đã đăng nhập",
      ),
  }),
  execute: async ({ toGuest }) => {
    return { action: "switch_request", toGuest };
  },
});

// --- Data Tools (Reused from main app) ---

export const productLookup = tool({
  description:
    "Tra cứu thông tin sản phẩm, giá bán, tồn kho. Cần cung cấp ownerId từ thông tin người dùng.",
  inputSchema: z.object({
    query: z.string().describe("Tên sản phẩm chính xác"),
    ownerId: z
      .string()
      .describe("ID của người sở hữu (lấy từ thông tin người dùng hiện tại)"),
  }),
  execute: async ({ query, ownerId }) => {
    const products = await dbQueries.getProductsByNameAndUser({
      name: query,
      userId: ownerId,
    });
    if (!products || products.length === 0)
      return "Không tìm thấy sản phẩm nào.";
    return products
      .map(
        (p: any) =>
          `- ${p.name} (SKU: ${p.sku || "N/A"}): ${p.priceSell || 0} VNĐ`,
      )
      .join("\n");
  },
});

export const orderLookup = tool({
  description: "Tra cứu thông tin đơn hàng.",
  inputSchema: z.object({
    orderId: z.string().optional().describe("Mã đơn hàng"),
    customerName: z.string().optional().describe("Tên khách hàng"),
  }),
  execute: async ({ orderId: _orderId, customerName: _customerName }) => {
    return "Tính năng tra cứu đơn hàng đang được cập nhật dữ liệu...";
  },
});

export const saveProductTool = tool({
  description: "Lưu hoặc cập nhật thông tin sản phẩm (bao gồm cả link ảnh).",
  inputSchema: z.object({
    name: z.string(),
    priceSell: z.number().optional(),
    imageUrls: z
      .string()
      .optional()
      .describe("Dãy link ảnh cách nhau bởi dấu phẩy"),
    id: z.string().optional(),
    ownerId: z
      .string()
      .describe("ID của người sở hữu (lấy từ thông tin người dùng hiện tại)"),
  }),
  execute: async (params: any) => {
    const result = await dbQueries.upsertProduct({
      ...params,
      id: params.id || `tg-${Date.now()}`,
      name: params.name,
      ownerId: params.ownerId,
    } as any);
    const saved = Array.isArray(result) ? result[0] : result;
    return saved ? `Đã lưu sản phẩm: ${saved.name}` : "Lỗi khi lưu sản phẩm.";
  },
});
