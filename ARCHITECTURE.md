# Kiến Trúc Hệ Thống Vercel Chatbot

Tài liệu này mô tả chi tiết luồng dữ liệu, các thành phần chính và cơ chế hoạt động của hệ thống Chatbot được xây dựng trên nền tảng Next.js và Vercel AI SDK.

## 1. Sơ Đồ Luồng Dữ Liệu (Data Flow Diagram)

Dưới đây là sơ đồ minh họa cách yêu cầu từ người dùng được xử lý, tương tác với AI và truy xuất dữ liệu từ các hệ thống nội bộ.

```mermaid
graph TD
    %% Users and Interfaces
    UserWeb[Web User (Next.js UI)] -->|Send Message| ChatAPI[Chat API /api/chat]
    UserTG[Telegram User] -->|Send Message| TGBot[Telegram Bot Logic]
    TGBot -->|Forward Request| ChatAPI

    %% Backend Processing
    subgraph Backend [Next.js Server]
        ChatAPI -->|Auth| Auth[Auth.js / NextAuth]
        ChatAPI -->|Normalize| MsgProc[Message Processor]
        ChatAPI -->|Stream| AISDK[Vercel AI SDK]
    end

    %% Database Operations
    subgraph Database [PostgreSQL / Drizzle]
        Auth -->|Query/Create| DBUsers[(Users Table)]
        MsgProc -->|Save/Fetch| DBChats[(Chats & Messages Table)]
        AISDK -->|Fetch History| DBChats
    end

    %% AI & Tool Integration
    subgraph AI_Engine [AI & Tools]
        AISDK -->|Prompt + Context| LLM[LLM: OpenAI/Vercel AI]
        LLM -->|Tool Call| Tools[AI Tools Wrapper]
        
        subgraph Tool_Ecosystem [Business Tools]
            Tools -->|Lookup| BillingTool[Billing Lookup]
            Tools -->|Lookup| CustomerTool[Customer Lookup]
            Tools -->|Lookup| OrderTool[Order Lookup]
            Tools -->|Lookup| ProductTool[Product Lookup]
            Tools -->|Fetch| RAGTool[Knowledge Base/RAG]
            Tools -->|Search| WebSearch[Web Search]
        end
        
        Tool_Ecosystem -->|Query| DBBusiness[(Business Data)]
        Tool_Ecosystem -->|Query| DBKnowledge[(Knowledge Base)]
    end

    %% Responses
    LLM -->|Stream Result| AISDK
    AISDK -->|Save Assistant Msg| DBChats
    AISDK -->|Update Title| DBChats
    AISDK -->|UI Stream| UserWeb
```

---

## 2. Các Thành Phần Chính

### A. Giao Diện Người Dùng (Client Interaction)
- **Web UI**: Giao diện chat xây dựng bằng React/Next.js. Hỗ trợ gửi tin nhắn văn bản và tệp đính kèm (hình ảnh, PDF).
- **Telegram Bot**: Bot lắng nghe tin nhắn từ Telegram và chuyển tiếp đơn phương về phía Chat API để xử lý chung một logic, đảm bảo tính nhất quán.

### B. Tầng API (`app/(chat)/api/chat/route.ts`)
- **Xác thực (Auth)**: Sử dụng `auth.js` để định danh người dùng và vai trò (Admin, User, Guest).
- **Chuẩn hóa thông điệp**: Tin nhắn được chuyển đổi sang định dạng mà LLM có thể hiểu. Các URL tệp đính kèm được đưa vào context để các tools có thể truy cập.
- **Tiêm ngữ cảnh (Context Injection)**: Lịch sử chat và "trí nhớ" người dùng được truy xuất từ DB để AI có ngữ cảnh dài hạn.

### C. Cơ Sở Dữ Liệu (Drizzle ORM)
- **Danh tính**: `users`, `telegram_users`, `guest_users`.
- **Trạng thái Chat**: `chats`, `messages_v2`, `votes_v2`.
- **Tri thức/Trí nhớ**: `user_memories`, `knowledge_base`.
- **Thực thể kinh doanh**: `products`, `orders`, `customers`, `payments`, `cash_book`.

### D. Hệ Thống Công Cụ AI (AI Tools)
AI có khả năng tự động gọi các công cụ sau khi cần thông tin bên ngoài:

| Tool Name | Action | Target Data |
| :--- | :--- | :--- |
| `billingLookup` | Truy xuất thông tin thanh toán | `payments`, `orders` |
| `customerLookup` | Lấy thông tin khách hàng | `customers` |
| `orderLookup` | Tra cứu đơn hàng | `orders` |
| `productLookup` | Tra giá và thông tin sản phẩm | `products`, `price_lists` |
| `knowledgeBaseLookup` | Tìm kiếm ngữ nghĩa trong tài liệu | `knowledge_base` |
| `webSearch` | Tìm kiếm thông tin thời gian thực | External Search API |

---

## 3. Bảo Mật & Toàn Vẹn Dữ Liệu
- **RBAC (Role-Based Access Control)**: Các công cụ tool được kiểm soát chặt chẽ, đảm bảo người dùng chỉ thấy dữ liệu họ được phép.
- **Zod Validation**: Mọi đầu vào từ API đều được kiểm tra nghiêm ngặt qua schema (`postRequestBodySchema`).
- **UUID**: Sử dụng UUID cho mọi định danh để tránh lộ dữ liệu qua việc đoán ID tuần tự.

---

## 4. Những Câu Hỏi Còn Bỏ Ngỏ (Open Questions)
- Cần phân quyền chi tiết hơn cho các tool như `cashBookLookup`?
- Cơ chế đồng bộ dữ liệu giữa các nguồn (Firestore/Supabase) là một chiều hay hai chiều?
