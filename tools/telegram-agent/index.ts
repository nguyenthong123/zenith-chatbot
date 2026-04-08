import "./env";
import { type Context, Telegraf } from "telegraf";
import cloudinary from "@/lib/cloudinary";
import * as tgQueries from "@/lib/db/telegram-queries";
import { type AgentContext, processMessage } from "./agent";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN in .env file.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Middleware to resolve User/Guest context
bot.use(async (ctx: any, next) => {
  if (!ctx.from) return next();

  const telegramId = ctx.from.id.toString();
  const chatId = ctx.chat?.id.toString() || telegramId;
  const username = ctx.from.username || ctx.from.first_name;

  try {
    const result = await tgQueries.getActiveTelegramUser(telegramId);

    if (!result) {
      console.log(`New user detected: ${telegramId}. Creating guest profile.`);
      const guest = await tgQueries.createTelegramGuest(
        telegramId,
        chatId,
        username,
      );
      ctx.state.user = guest;
      ctx.state.isGuest = true;
    } else {
      ctx.state.user = result.user;
      ctx.state.isGuest = result.user.isAnonymous;
    }

    ctx.state.telegramId = telegramId;
    ctx.state.chatId = chatId;

    return next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return ctx.reply("Đã xảy ra lỗi khi xác thực tài khoản.");
  }
});

bot.start((ctx: Context) => {
  const name = (ctx as any).state.user?.name || "bạn";
  ctx.reply(`Chào ${name}! Tôi là trợ lý kinh doanh của bạn. Tôi có thể giúp bạn tra cứu sản phẩm, đơn hàng hoặc quản lý cửa hàng.
  
Gõ /profile để xem thông tin tài khoản.
Gõ /login <email> <password> để liên kết tài khoản chính thức.`);
});

bot.command("profile", (ctx: any) => {
  const { user, isGuest } = ctx.state;
  ctx.reply(`📊 **Thông tin tài khoản:**
- Tên: ${user.name}
- Email: ${user.email}
- Chế độ: ${isGuest ? "GUEST (Khách)" : "CHÍNH THỨC"}
- ID Telegram: ${ctx.state.telegramId}`);
});

bot.command("login", async (ctx: any) => {
  const args = ctx.message.text.split(" ");
  if (args.length < 3)
    return ctx.reply("Vui lòng dùng: /login <email> <password>");

  const email = args[1];
  const password = args[2];

  const res = await tgQueries.linkTelegramAccount(
    ctx.state.telegramId,
    ctx.state.chatId,
    email,
    password,
  );
  if (res.success) {
    ctx.reply(
      `✅ Đã liên kết tài khoản: ${res.user?.name}. Toàn bộ chức năng quản lý đã sẵn sàng!`,
    );
  } else {
    ctx.reply(`❌ Lỗi: ${res.message}`);
  }
});

bot.command("guest", async (ctx: any) => {
  const res = await tgQueries.switchTelegramIdentity(
    ctx.state.telegramId,
    true,
  );
  if (res.success) {
    ctx.reply("🔄 Đã chuyển sang chế độ GUEST.");
  } else {
    ctx.reply(`❌ Lỗi: ${res.message}`);
  }
});

// Photo Handling
bot.on("photo", async (ctx: any) => {
  try {
    await ctx.sendChatAction("upload_document");
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const link = await ctx.telegram.getFileLink(photo.file_id);

    console.log(`Uploading photo from ${ctx.from.id} to Cloudinary...`);
    const uploadRes = await cloudinary.uploader.upload(link.href, {
      folder: "telegram_uploads",
    });

    const context: AgentContext = {
      chatId: ctx.state.chatId,
      telegramId: ctx.state.telegramId,
      user: ctx.state.user,
      isGuest: ctx.state.isGuest,
    };

    const caption = ctx.message.caption || "";
    const aiMsg =
      caption ||
      "[HỆ THỐNG: Người dùng vừa gửi một ảnh. Hãy kiểm tra nội dung ảnh và thực hiện yêu cầu nếu có.]";
    const response = await processMessage(aiMsg, context, [
      { url: uploadRes.secure_url, contentType: "image/jpeg" },
    ]);

    await ctx.reply(response.text || "Tôi đã nhận được hình ảnh.", {
      parse_mode: "HTML",
    });
  } catch (error: any) {
    console.error("Photo Error:", error);
    ctx.reply("Lỗi khi xử lý hình ảnh.");
  }
});

// Text Handling
bot.on("text", async (ctx: any) => {
  const userMessage = ctx.message.text;
  if (userMessage.startsWith("/")) return; // Skip commands

  try {
    await ctx.sendChatAction("typing");

    const context: AgentContext = {
      chatId: ctx.state.chatId,
      telegramId: ctx.state.telegramId,
      user: ctx.state.user,
      isGuest: ctx.state.isGuest,
    };

    const response = await processMessage(userMessage, context);

    if (response.text) {
      await ctx.reply(response.text, { parse_mode: "HTML" });
    }
  } catch (error: any) {
    console.error("Agent Error:", error);
    await ctx.reply(`❌ Lỗi: ${error.message || "Lỗi không xác định"}`);
  }
});

console.log("🚀 Business Telegram Agent is running...");
bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
