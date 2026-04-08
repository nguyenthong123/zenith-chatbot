import * as dotenv from "dotenv";

dotenv.config();

import { eq } from "drizzle-orm";
import { db } from "../../lib/db/queries";
import { user as userSchema } from "../../lib/db/schema";
import { type AgentContext, processMessage } from "./agent";

async function runTests() {
  console.log("🧪 Bắt đầu mô phỏng kịch bản người dùng Telegram...");

  // 1. Tìm thông tin người dùng nbt1024@gmail.com
  const user = await db
    .select()
    .from(userSchema)
    .where(eq(userSchema.email, "nbt1024@gmail.com"))
    .then((res: any[]) => res[0]);

  if (!user) {
    console.error("❌ Không tìm thấy người dùng nbt1024@gmail.com trong DB.");
    process.exit(1);
  }

  const context: AgentContext = {
    chatId: "mock-12345",
    telegramId: "mock-12345",
    user: user,
    isGuest: false,
  };

  console.log(`👤 Đang giả lập cho người dùng: ${user.name} (${user.email})`);

  // --- Test 1: Upload 2 ảnh sản phẩm ---
  console.log("\n📸 Test 1 & 2: Upload ảnh sản phẩm...");
  const img1 =
    "https://images.unsplash.com/photo-1514228742587-6b1558fbed50?q=80&w=1000";
  const msg1 = `[HỆ THỐNG: Người dùng vừa gửi một ảnh. Link ảnh: ${img1}. Tôi muốn lưu sản phẩm này tên "Mug Blue" giá 150000.]`;
  const res1 = await processMessage(msg1, context);
  console.log("Bot:", res1.text);

  const img2 =
    "https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=1000";
  const msg2 = `[HỆ THỐNG: Người dùng vừa gửi một ảnh. Link ảnh: ${img2}. Tôi muốn lưu sản phẩm này tên "Brown Wallet" giá 350000.]`;
  const res2 = await processMessage(msg2, context);
  console.log("Bot:", res2.text);

  // --- Test 3: Tra cứu 5 hình ảnh vừa đăng ---
  console.log("\n🔍 Test 3: Tra cứu 5 hình ảnh vừa đăng...");
  const msg3 = "Cho tôi xem 5 sản phẩm/hình ảnh tôi vừa đăng gần đây.";
  const res3 = await processMessage(msg3, context);
  console.log("Bot:", res3.text);

  // --- Test 4: Tra cứu nợ khách hàng "Anh Kiên" ---
  console.log("\n💸 Test 4: Tra cứu nợ khách hàng Anh Kiên...");
  const msg4 = "Anh Kiên còn nợ bao nhiêu?";
  const res4 = await processMessage(msg4, context);
  console.log("Bot:", res4.text);

  // --- Test 5: Báo cáo tài chính ---
  console.log(
    "\n📊 Test 5: Báo cáo tài chính (Doanh thu, lợi nhuận, công nợ)...",
  );
  const msg5 = "Cho tôi xem báo cáo tài chính tổng thể của tôi.";
  const res5 = await processMessage(msg5, context);
  console.log("Bot:", res5.text);

  console.log("\n✅ Hoàn thành mô phỏng.");
}

runTests().catch((err) => {
  console.error("💥 Lỗi trong quá trình test:", err);
  process.exit(1);
});
