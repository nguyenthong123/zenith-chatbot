# Kế hoạch công việc

## Nhiệm vụ hiện tại
Kiểm tra toàn bộ dự án, tạo một file `plan.md` và ghi chú các thay đổi vào đó. Dự án đã được đồng bộ mới từ GitHub về.

## Tình trạng dự án hiện tại (từ .ai_project_status.md)
* YÊU CẦU CỦA KHÁCH HÀNG: 'Vào dự án /Volumes/DATA_SSD/Projects/vercel_chatbot, hãy sửa triệt để các lỗi Biome linter/formatter mà GitHub Actions báo tại đây: https://github.com/nguyenthong123/zenith-chatbot/actions/runs/24301711292. Sau khi push code lên GitHub thành công, hãy vào lại đường link trên để kiểm tra xem workflow 'Lint' đã PASSED chưa.'
* Lỗi từ lần chạy trước: `Task execution failed: Invalid response from LLM call - None or empty.`
* Các lỗi Linter trên GitHub Actions liên quan đến `Node.js 20 actions are deprecated`, `Process completed with exit code 1`, `noExplicitAny`, và `noConsole`. `noExplicitAny` và `noConsole` đã được tắt trong `biome.json` nhưng lỗi vẫn xuất hiện.
* Một `Anti-pattern` đã gặp là chạy `npm run fix` mà không kiểm tra cấu hình linter chính xác trên CI.

## Các file đã được liệt kê (từ `ls -F`):
```
ARCHITECTURE.md
LICENSE
README.md
agent-logic.ts
app/
artifacts/
biome.json
business-tools.ts
components/
components.json
config/
drizzle.config.ts
hooks/
instrumentation-client.ts
instrumentation.ts
lib/
next-env.d.ts
next.config.ts
node_modules/
optimized_supabase_schema.sql
package-lock.json
package.json
playwright.config.ts
pnpm-lock.yaml
postcss.config.mjs
proxy.ts
public/
scratch-check-db.ts
scripts/
server_debug.log
server_output.log
telegram-bot.ts
test-models.ts
test_tool.ts
tests/
tmp/
tools/
tsconfig.bot.json
tsconfig.json
tsconfig.tsbuildinfo
vercel-template.json
vercel.json
zalo_debug.log
```

## Các thay đổi và ghi chú
*  Dự án này đã có lịch sử sửa lỗi linter và cập nhật cấu hình `biome.json`. Có vẻ như vấn đề `Node.js 20 actions are deprecated` trong GitHub Actions cần được kiểm tra.
*  Để xác định các "thay đổi" mới nhất sau khi đồng bộ từ GitHub, tôi cần thực hiện kiểm tra sâu hơn.
*  `npm install` đã thất bại do xung đột phụ thuộc.

## Các bước tiếp theo
1.  Chạy `npm install --legacy-peer-deps` để giải quyết xung đột phụ thuộc và cài đặt các gói cần thiết.
2.  Sau khi cài đặt xong, chạy `code_diagnostic_tool` để kiểm tra các lỗi cú pháp và linter hiện tại trong dự án. Điều này sẽ giúp xác định liệu có bất kỳ lỗi mới nào xuất hiện sau khi đồng bộ mã nguồn hay không.
3.  Dựa vào kết quả từ `code_diagnostic_tool` và thông tin từ GitHub Actions, lập kế hoạch sửa lỗi linter và đảm bảo dự án sạch.
4.  Cập nhật file `.ai_project_status.md` với những kinh nghiệm và hành động đã thực hiện.