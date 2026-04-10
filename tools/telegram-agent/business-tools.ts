import { tool } from "ai";
import { z } from "zod";
import * as dbQueries from "../../lib/db/queries";
import * as tgQueries from "../../lib/db/telegram-queries";

// --- Auth Tools ---

export const loginTool = tool({
  description:
    "Đăng nhập tài khoản bằng email và mật khẩu để liên kết với Telegram này.",
  inputSchema: z.object({
    email: z.string().email().describe("Email đăng ký"),
    password: z.string().describe("Mật khẩu"),
    telegramId: z.string().describe("ID Telegram (Nội bộ)"),
    chatId: z.string().describe("ID Chat (Nội bộ)"),
  }),
  execute: async ({ email, password, telegramId, chatId }) => {
    if (!telegramId || !chatId)
      return { success: false, message: "Lỗi hệ thống: Thiếu ID Telegram." };
    const res = await tgQueries.linkTelegramAccount(
      telegramId,
      chatId,
      email,
      password,
    );
    return res;
  },
});

export const logoutTool = tool({
  description: "Đăng xuất và hủy liên kết tài khoản này khỏi Telegram.",
  inputSchema: z.object({
    telegramId: z.string().describe("ID Telegram (Nội bộ)"),
  }),
  execute: async ({ telegramId }) => {
    if (!telegramId)
      return { success: false, message: "Lỗi hệ thống: Thiếu ID Telegram." };
    return await tgQueries.unlinkTelegramAccount(telegramId);
  },
});

export const switchAccountTool = tool({
  description: "Chuyển đổi giữa chế độ Guest và tài khoản cá nhân đã liên kết.",
  inputSchema: z.object({
    toGuest: z
      .boolean()
      .describe(
        "True nếu muốn chuyển sang Guest, False nếu muốn chuyển sang tài khoản đã đăng nhập",
      ),
    telegramId: z.string().describe("ID Telegram (Nội bộ)"),
  }),
  execute: async ({ toGuest, telegramId }) => {
    if (!telegramId)
      return { success: false, message: "Lỗi hệ thống: Thiếu ID Telegram." };
    return await tgQueries.switchTelegramIdentity(telegramId, toGuest);
  },
});

// --- Data Tools (Reused from main app) ---

export const productLookup = tool({
  description:
    "Tra cứu thông tin sản phẩm, giá bán, tồn kho. Cần cung cấp ownerId từ thông tin người dùng.",
  inputSchema: z.object({
    query: z.string().describe("Tên sản phẩm chính xác"),
    ownerId: z.string().describe("ID của người sở hữu (Nội bộ)"),
  }),
  execute: async ({ query, ownerId }) => {
    if (!ownerId) return "❌ Lỗi: Bạn chưa đăng nhập để tra cứu sản phẩm.";
    const products = await dbQueries.getProductsByNameAndUser({
      name: query,
      userId: ownerId,
    });
    if (!products || products.length === 0)
      return "❌ Không tìm thấy sản phẩm nào.";
    return products
      .map((p) => {
        let info = `📦 <b>${p.name}</b> (SKU: <code>${p.sku || "N/A"}</code>)\n💰 Giá bán: <b>${(p.priceSell || 0).toLocaleString()} VNĐ</b>\n📉 Tồn kho: <b>${p.stock || 0}</b>`;
        if (p.imageUrls) {
          const urls = p.imageUrls.split(",").map((u) => u.trim());
          if (urls.length > 0) {
            info += `\n🖼️ Hình ảnh: ${urls.map((u, i) => `<a href="${u}">Ảnh ${i + 1}</a>`).join(", ")}`;
          }
        }
        return info;
      })
      .join("\n\n");
  },
});

export const orderLookup = tool({
  description: "Tra cứu thông tin đơn hàng của người dùng.",
  inputSchema: z.object({
    userId: z.string().describe("ID người dùng (Nội bộ)"),
    limit: z.number().optional().default(5),
  }),
  execute: async ({ userId, limit }) => {
    if (!userId) return "❌ Lỗi: Bạn chưa đăng nhập để tra cứu đơn hàng.";
    const orders = await dbQueries.getOrdersByUserId({ userId });
    const recent = orders.slice(0, limit);
    if (recent.length === 0) return "📭 Bạn chưa có đơn hàng nào.";

    return (
      `📋 <b>Danh sách ${recent.length} đơn hàng gần nhất:</b>\n\n` +
      recent
        .map(
          (o) =>
            `🔹 Đơn: <code>${o.orderId || o.id.slice(0, 8)}</code>\n👤 Khách: <b>${o.customerName || "N/A"}</b>\n💰 Tổng: <b>${(o.totalAmount || 0).toLocaleString()} VNĐ</b>\n📅 Ngày: ${o.date || "N/A"}`,
        )
        .join("\n\n")
    );
  },
});

export const saveProductTool = tool({
  description: "Lưu hoặc cập nhật thông tin sản phẩm (bao gồm cả link ảnh).",
  inputSchema: z.object({
    name: z.string(),
    priceSell: z.number().optional(),
    imageUrls: z
      .array(z.string())
      .optional()
      .describe("Danh sách các link ảnh"),
    id: z.string().optional(),
    ownerId: z.string().describe("ID của người sở hữu (Nội bộ)"),
  }),
  execute: async (params) => {
    if (!params.ownerId) return "❌ Lỗi: Bạn chưa đăng nhập để lưu sản phẩm.";

    // Convert array to comma-separated string for upsertProduct
    const formattedUrls = params.imageUrls
      ? params.imageUrls.join(", ")
      : undefined;

    const result = await dbQueries.upsertProduct({
      ...params,
      imageUrls: formattedUrls,
      id: params.id || `tg-${Date.now()}`,
      name: params.name,
      ownerId: params.ownerId,
    });
    const saved = Array.isArray(result) ? result[0] : result;
    return saved
      ? `✅ Đã lưu sản phẩm: <b>${saved.name}</b>`
      : "❌ Lỗi khi lưu sản phẩm.";
  },
});

export const getFinancialSummaryTool = tool({
  description:
    "Báo cáo tổng doanh thu, lợi nhuận và công nợ của người dùng hiện tại.",
  inputSchema: z.object({
    userId: z.string().describe("ID của người dùng hiện tại (Nội bộ)"),
  }),
  execute: async ({ userId }) => {
    if (!userId)
      return {
        revenue: 0,
        profit: 0,
        debt: 0,
        message: "❌ Lỗi: Bạn chưa đăng nhập để xem báo cáo tài chính.",
      };
    const orders = await dbQueries.getOrdersByUserId({ userId });
    const totalPayments = await dbQueries.getTotalPaymentsByUserId({ userId });

    let revenue = 0;
    let totalCost = 0;

    for (const ord of orders) {
      revenue += ord.totalAmount || 0;
      const items = ord.items as any[];
      if (Array.isArray(items)) {
        for (const item of items) {
          totalCost +=
            (Number(item.priceBuy) || 0) * (Number(item.quantity) || 1);
        }
      }
    }

    const profit = revenue - totalCost;
    const debt = revenue - totalPayments;

    return {
      revenue,
      profit,
      debt,
      message: `📊 <b>BÁO CÁO TÀI CHÍNH</b>\n━━━━━━━━━━━━━━━━━━\n💰 Tổng doanh thu: <b>${revenue.toLocaleString()} VNĐ</b>\n📈 Tổng lợi nhuận: <b>${profit.toLocaleString()} VNĐ</b>\n📉 Tổng công nợ: <b>${debt.toLocaleString()} VNĐ</b>`,
    };
  },
});

export const getRecentProductsTool = tool({
  description: "Lấy danh sách các sản phẩm/hình ảnh vừa đăng gần đây.",
  inputSchema: z.object({
    userId: z.string().describe("ID của người dùng hiện tại (Nội bộ)"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Số lượng sản phẩm muốn lấy"),
  }),
  execute: async ({ userId, limit }) => {
    if (!userId) return "❌ Lỗi: Bạn chưa đăng nhập.";
    const products = await dbQueries.getAllProductsByUserId({ userId });
    const recent = products.slice(0, limit);

    if (recent.length === 0) return "📭 Bạn chưa đăng sản phẩm nào.";

    return (
      `✨ <b>Sản phẩm mới đăng:</b>\n\n` +
      recent
        .map((p) => {
          let info = `🔹 <b>${p.name}</b>`;
          if (p.imageUrls) {
            const firstImg = p.imageUrls.split(",")[0].trim();
            info += `\n🖼️ <a href="${firstImg}">Xem hình ảnh</a>`;
          } else {
            info += `\n🖼️ <i>Không có ảnh</i>`;
          }
          return info;
        })
        .join("\n\n")
    );
  },
});

export const customerLookup = tool({
  description: "Tra cứu danh sách khách hàng của người dùng.",
  inputSchema: z.object({
    userId: z.string().describe("ID người dùng (Nội bộ)"),
    query: z.string().optional().describe("Tên khách hàng hoặc số điện thoại"),
    limit: z.number().optional().default(5),
  }),
  execute: async ({ userId, query, limit }) => {
    if (!userId) return "❌ Lỗi: Bạn chưa đăng nhập.";
    const customers = await dbQueries.getCustomersByUserId({ userId });
    let filtered = customers;
    if (query) {
      const q = query.toLowerCase();
      filtered = customers.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q),
      );
    }
    const recent = filtered.slice(0, limit);
    if (recent.length === 0) return "👤 Không tìm thấy khách hàng nào.";

    return (
      `👥 <b>Danh sách khách hàng:</b>\n\n` +
      recent
        .map(
          (c) =>
            `👤 <b>${c.name || "N/A"}</b>\n📞 SĐT: <code>${c.phone || "N/A"}</code>\n📍 ĐC: ${c.address || "N/A"}`,
        )
        .join("\n\n")
    );
  },
});

export const cashBookLookup = tool({
  description: "Tra cứu sổ quỹ (thu chi) của người dùng.",
  inputSchema: z.object({
    userId: z.string().describe("ID người dùng (Nội bộ)"),
    limit: z.number().optional().default(5),
  }),
  execute: async ({ userId, limit }) => {
    if (!userId) return "💰 Lỗi: Bạn chưa đăng nhập để tra cứu sổ quỹ.";
    const records = await dbQueries.getCashBookByUserId({ userId });
    const recent = records.slice(0, limit);
    if (recent.length === 0) return "💰 Chưa có giao dịch nào trong sổ quỹ.";

    return (
      `📖 <b>Lịch sử sổ quỹ gần nhất:</b>\n\n` +
      recent
        .map(
          (r) =>
            `🔹 ${r.type === "income" ? "➕ Thu" : "➖ Chi"}: <b>${(r.amount || 0).toLocaleString()} VNĐ</b>\n📝 Nội dung: ${r.note || "N/A"}\n📅 Ngày: ${r.date || "N/A"}`,
        )
        .join("\n\n")
    );
  },
});

export const updateProductImageTool = tool({
  description:
    "Cập nhật (thêm) hình ảnh cho sản phẩm hiện có theo tên. Có thể gửi nhiều ảnh cùng lúc.",
  inputSchema: z.object({
    productName: z.string().describe("Tên sản phẩm cần cập nhật hình ảnh"),
    imageUrls: z.array(z.string()).describe("Danh sách các URL hình ảnh mới"),
    ownerId: z.string().describe("ID người sở hữu (Nội bộ)"),
  }),
  execute: async ({ productName, imageUrls, ownerId }) => {
    if (!ownerId) return "❌ Lỗi: Bạn chưa đăng nhập để cập nhật sản phẩm.";
    if (!imageUrls || imageUrls.length === 0)
      return "❌ Lỗi: Thiếu link hình ảnh.";

    // Check if product exists
    const products = await dbQueries.getProductsByNameAndUser({
      name: productName,
      userId: ownerId,
    });
    if (!products || products.length === 0) {
      console.log(
        `[updateProductImageTool] No product found for name: "${productName}" and ownerId: "${ownerId}"`,
      );
      return `❌ Không tìm thấy sản phẩm có tên liên quan đến: <b>${productName}</b>. Vui lòng kiểm tra lại tên sản phẩm!`;
    }

    const targetProduct = products[0];

    try {
      // Joins multiple URLs with comma to match upsertProduct expected format
      const combinedUrls = imageUrls.join(", ");
      const result = await dbQueries.upsertProduct({
        id: targetProduct.id,
        name: targetProduct.name,
        imageUrls: combinedUrls,
        ownerId: ownerId,
      });

      const saved = Array.isArray(result) ? result[0] : result;
      return saved
        ? `✅ Đã cập nhật ${imageUrls.length} hình ảnh mới cho sản phẩm: <b>${saved.name}</b>`
        : "❌ Lỗi khi cập nhật hình ảnh.";
    } catch (error) {
      console.error("Update Image Error:", error);
      return "❌ Lỗi hệ thống khi cập nhật hình ảnh sản phẩm.";
    }
  },
});

export const savePaymentTool = tool({
  description: "Lưu thông tin phiếu thu/thanh toán (kèm theo ảnh chứng từ nếu có).",
  inputSchema: z.object({
    amount: z.number().describe("Số tiền thanh toán"),
    customerName: z.string().optional().describe("Tên khách hàng"),
    date: z.string().optional().describe("Ngày thanh toán (YYYY-MM-DD)"),
    paymentMethod: z.string().optional().describe("Phương thức (Chuyển khoản, Tiền mặt...)"),
    proofImage: z.string().optional().describe("Link ảnh chứng từ/bill"),
    note: z.string().optional().describe("Ghi chú thêm"),
    ownerId: z.string().describe("ID người sở hữu (Nội bộ)"),
  }),
  execute: async (params) => {
    if (!params.ownerId) return "❌ Lỗi: Bạn chưa đăng nhập để lưu phiếu thu.";

    const id = `pay-${Date.now()}`;
    const result = await dbQueries.upsertPayment({
      ...params,
      id,
      date: params.date || new Date().toISOString().split("T")[0],
    });

    const saved = Array.isArray(result) ? result[0] : result;
    return saved
      ? `✅ Đã lưu phiếu thu: <b>${(saved.amount || 0).toLocaleString()} VNĐ</b> cho khách hàng <b>${saved.customerName || "N/A"}</b>.`
      : "❌ Lỗi khi lưu phiếu thu.";
  },
});
