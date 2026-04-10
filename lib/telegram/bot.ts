import type { Context, Telegraf } from "telegraf";
import { type AgentContext, processMessage } from "../../tools/telegram-agent/agent";
import cloudinary from "../cloudinary";
import * as tgQueries from "../db/telegram-queries";

export function setupBot(bot: Telegraf<Context>) {
  // Middleware to resolve User/Guest context
  bot.use(async (ctx: any, next) => {
    if (!ctx.from) return next();

    const telegramId = ctx.from.id.toString();
    const chatId = ctx.chat?.id.toString() || telegramId;
    const username = ctx.from.username || ctx.from.first_name;
    
    console.log(`[Telegraf] INCOMING: From ${username} (${telegramId}) in Chat ${chatId}`);

    try {
      const result = await tgQueries.getActiveTelegramUser(telegramId);

      if (!result) {
        console.log(
          `New user detected: ${telegramId}. Creating guest profile.`,
        );
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
        ownerId: ctx.state.user?.ownerId || ctx.state.telegramId,
      };

      // Gửi thông báo kèm theo ảnh thực tế dưới dạng attachment để AI có thể "nhìn" thấy
      const aiMsg = "[HỆ THỐNG: Người dùng vừa gửi một ảnh]"; 
      const response = await processMessage(aiMsg, context, [
        { url: uploadRes.secure_url, contentType: "image/jpeg" },
      ]);

      await ctx.reply(response.text || "💎 [Diamond AI] Đang xử lý dữ liệu hình ảnh... vui lòng nhắn lại sau 5 giây nếu không thấy phản hồi.", { parse_mode: "HTML" });
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
      console.log(`[Telegraf] Message from ${ctx.from?.username || ctx.from?.first_name}: "${userMessage}"`);
      await ctx.sendChatAction("typing");

      const context: AgentContext = {
        chatId: ctx.state.chatId,
        telegramId: ctx.state.telegramId,
        ownerId: ctx.state.user?.id || ctx.state.telegramId,
        user: ctx.state.user,
        isGuest: ctx.state.isGuest,
      };

      const response = await processMessage(userMessage, context);

      // Handle Auth Actions requested by AI
      if (response.authAction) {
        if (response.authAction.action === "login_request") {
          const res = await tgQueries.linkTelegramAccount(
            ctx.state.telegramId,
            ctx.state.chatId,
            response.authAction.email,
            response.authAction.password,
          );
          if (res.success) {
            await ctx.reply(`✅ Đã liên kết tài khoản: ${res.user?.name}`);
          } else {
            await ctx.reply(`❌ Đăng nhập thất bại: ${res.message}`);
          }
        } else if (response.authAction.action === "switch_request") {
          const res = await tgQueries.switchTelegramIdentity(
            ctx.state.telegramId,
            response.authAction.toGuest,
          );
          if (res.success) {
            await ctx.reply(
              `🔄 Đã chuyển sang chế độ ${response.authAction.toGuest ? "GUEST" : "CHÍNH THỨC"}.`,
            );
          } else {
            await ctx.reply(`❌ Không thể chuyển đổi: ${res.message}`);
          }
        }
      }

      // 1. Automatic Native Media Delivery from Tool Results
      // SDK v6: output = { type: 'json', value: { photoUrl: ... } }
      if (response && response.response && response.response.messages) {
        for (const msg of response.response.messages) {
          if ((msg.role === "tool" || msg.role === "assistant") && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "tool-result") {
                // SDK v6 structured: output.value contains the actual data
                const rawOut = (part as any).output ?? (part as any).result;
                const out = (rawOut && typeof rawOut === 'object' && rawOut.value) ? rawOut.value : rawOut;
                if (out && typeof out === "object" && out.photoUrl && out.photoUrl !== "N/A" && out.photoUrl.startsWith("http")) {
                  console.log(`[Bot] Auto-delivering photo from tool result: ${out.photoUrl}`);
                  try {
                    await ctx.replyWithPhoto(out.photoUrl);
                  } catch (photoErr) {
                    console.error("Auto-photo delivery failed:", photoErr);
                  }
                }
              }
            }
          }
        }
      }

      // 2. Standard Text Reply with Robust HTML Sanitation
      const rawText = response.text || "💎 [Diamond AI] Đã xử lý yêu cầu của bạn.";
      const sanitizedText = rawText
        .replace(/<\/?(ul|ol|div|p|h[1-6]|table|tr|td|th|thead|tbody|span)\s*\/?>/gi, "\n")  // Block-level → newlines
        .replace(/<li\s*\/?>/gi, "• ")      // <li> → bullet
        .replace(/<\/li>/gi, "\n")           // </li> → newline
        .replace(/<br\s*\/?>/gi, "\n")       // <br> → newline
        .replace(/<hr\s*\/?>/gi, "\n───\n")  // <hr> → separator
        // Strip ALL tags EXCEPT Telegram-supported ones (whitelist approach)
        .replace(/<\/?(?!\/?(b|strong|i|em|u|ins|s|strike|del|a|code|pre|blockquote)\b)[^>]*>/gi, "")
        .replace(/\n{3,}/g, "\n\n")          // Collapse excessive newlines
        .trim();

      try {
        await ctx.reply(sanitizedText, { parse_mode: "HTML" });
      } catch (htmlErr: any) {
        // Fallback: strip ALL HTML and send as plain text
        console.warn("[Bot] HTML parse failed, falling back to plain text:", htmlErr.message);
        const plainText = sanitizedText.replace(/<[^>]*>/g, "").trim();
        await ctx.reply(plainText || "💎 Đã xử lý yêu cầu.");
      }
    } catch (error: any) {
      console.error("Agent Error:", error);
      await ctx.reply(`❌ Hệ thống đang bận. Vui lòng thử lại sau giây lát.`);
    }
  });

  return bot;
}
