ALTER TABLE "cash_book" ADD COLUMN "infoMarkdown" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "infoMarkdown" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "infoMarkdown" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "infoMarkdown" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "infoMarkdown" text;--> statement-breakpoint
ALTER TABLE "system_config" ADD COLUMN "infoMarkdown" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegramId" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegramChatId" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "product_name_owner_idx" ON "products" USING btree ("name","ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_id_idx" ON "users" USING btree ("telegramId");