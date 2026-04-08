# 🤖 Telegram Remote Coding Agent

Công cụ này cho phép bạn điều khiển dự án, viết code và chạy lệnh terminal trực tiếp từ Telegram.

## 🚀 Hướng dẫn thiết lập (Setup)

### Bước 1: Lấy thông tin từ Telegram

1.  **Bot Token**:
    - Tìm và chat với [@BotFather](https://t.me/botfather).
    - Gõ `/newbot`, đặt tên cho bot và nhận mã **API Token**.
2.  **User ID của bạn**:
    - Tìm và chat với [@userinfobot](https://t.me/userinfobot).
    - Chat một tin nhắn bất kỳ, nó sẽ trả về **ID** của bạn (một chuỗi số).

### Bước 2: Cấu hình môi trường

1.  Mở thư mục `tools/telegram-agent`.
2.  Tạo file `.env` (copy từ `.env.example`).
3.  Điền các thông tin sau:
    - `TELEGRAM_BOT_TOKEN`: Token từ BotFather.
    - `ADMIN_TELEGRAM_ID`: ID từ userinfobot.
    - `GOOGLE_GENERATIVE_AI_API_KEY`: API Key của Gemini (giống với dự án chính).

### Bước 3: Chạy bot

Tạm dừng các tiến trình khác nếu cần, mở terminal tại thư mục gốc của dự án và chạy:

```bash
cd tools/telegram-agent
pnpm install
pnpm run dev
```

### 🎮 Cách sử dụng

Bây giờ bạn có thể mở Telegram, tìm con bot của mình và ra lệnh:
- `List files trong dự án`
- `Đọc nội dung file package.json`
- `Hãy viết thêm route mới cho trang liên hệ`
- `Chạy npm run build giúp tôi`

---

## ⚠️ Cảnh báo Bảo mật

- Bot này có quyền **Toàn quyền (Full Autonomy)** trên máy của bạn.
- Đừng bao giờ chia sẻ Token cho người khác.
- Mình đã cài đặt cơ chế chỉ phản hồi **ID Admin** của bạn để đảm bảo an toàn.
