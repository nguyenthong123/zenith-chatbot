CREATE TABLE IF NOT EXISTS "zalo_config" (
	"id" text PRIMARY KEY NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_customerId_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_customerId_customers_id_fk";
--> statement-breakpoint
DROP INDEX "cash_date_idx";--> statement-breakpoint
DROP INDEX "cash_owner_idx";--> statement-breakpoint
DROP INDEX "customer_name_idx";--> statement-breakpoint
DROP INDEX "order_date_idx";--> statement-breakpoint
DROP INDEX "order_owner_idx";--> statement-breakpoint
DROP INDEX "payment_date_idx";--> statement-breakpoint
DROP INDEX "payment_owner_idx";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "cash_book" ADD COLUMN "ownerEmail" text;--> statement-breakpoint
ALTER TABLE "cash_book" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "cash_book" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "cash_book" ADD COLUMN "updatedByEmail" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "updatedByEmail" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ownerEmail" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updatedByEmail" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "ownerEmail" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updatedByEmail" text;--> statement-breakpoint
ALTER TABLE "price_lists" ADD COLUMN "ownerEmail" text;--> statement-breakpoint
ALTER TABLE "price_lists" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "price_lists" ADD COLUMN "createdByEmail" text;--> statement-breakpoint
ALTER TABLE "price_lists" ADD COLUMN "updatedByEmail" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ownerEmail" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "createdBy" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "createdByEmail" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updatedBy" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "updatedByEmail" text;--> statement-breakpoint
CREATE INDEX "cash_date_idx" ON "cash_book" USING btree ("date");--> statement-breakpoint
CREATE INDEX "cash_owner_idx" ON "cash_book" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "customer_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "order_date_idx" ON "orders" USING btree ("date");--> statement-breakpoint
CREATE INDEX "order_owner_idx" ON "orders" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "payment_date_idx" ON "payments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "payment_owner_idx" ON "payments" USING btree ("ownerId");