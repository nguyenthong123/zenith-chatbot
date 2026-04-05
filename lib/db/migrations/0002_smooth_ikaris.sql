CREATE TABLE IF NOT EXISTS "guest_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"name" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"firestoreId" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "cash_book" ALTER COLUMN "date" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "date" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "date" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "price_lists" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "price_lists" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "price_lists" ALTER COLUMN "ownerId" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ownerId" uuid;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;