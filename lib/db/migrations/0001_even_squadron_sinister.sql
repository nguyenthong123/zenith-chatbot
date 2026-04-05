CREATE TABLE IF NOT EXISTS "cash_book" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" bigint,
	"type" varchar(50),
	"category" text,
	"date" timestamp,
	"bankName" text,
	"note" text,
	"interestRate" numeric,
	"loanTerm" text,
	"ownerId" uuid,
	"createdByEmail" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"userId" uuid NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"businessName" text,
	"phone" varchar(50),
	"address" text,
	"type" varchar(100),
	"status" varchar(50),
	"lat" double precision,
	"lng" double precision,
	"ownerId" uuid,
	"ownerEmail" text,
	"createdByEmail" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Document" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"text" varchar DEFAULT 'text' NOT NULL,
	"userId" uuid NOT NULL,
	CONSTRAINT "Document_id_createdAt_pk" PRIMARY KEY("id","createdAt")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_base" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"metadata" json,
	"userId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" varchar(100),
	"customerId" text,
	"customerName" text,
	"totalAmount" bigint,
	"status" varchar(50),
	"date" timestamp,
	"items" json,
	"ownerId" uuid,
	"createdByEmail" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"amount" bigint,
	"customerId" text,
	"customerName" text,
	"date" timestamp,
	"paymentMethod" varchar(100),
	"proofImage" text,
	"note" text,
	"ownerId" uuid,
	"createdByEmail" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"headers" json,
	"items" json,
	"ownerId" text,
	"updatedBy" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" varchar(255),
	"category" text,
	"priceBuy" bigint,
	"priceSell" bigint,
	"stock" numeric DEFAULT '0',
	"unit" varchar(100),
	"specification" text,
	"packaging" text,
	"density" text,
	"status" varchar(50),
	"note" text,
	"expiryDate" text,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Stream" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Stream_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Suggestion" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"documentCreatedAt" timestamp NOT NULL,
	"originalText" text NOT NULL,
	"suggestedText" text NOT NULL,
	"description" text,
	"isResolved" boolean DEFAULT false NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Suggestion_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_config" (
	"id" text PRIMARY KEY NOT NULL,
	"accountName" text,
	"accountNumber" text,
	"bankId" text,
	"subscriptionLimit" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedBy" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(64) NOT NULL,
	"password" varchar(64),
	"name" text,
	"displayName" text,
	"photoUrl" text,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"isAnonymous" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"firestoreId" varchar(255),
	"zaloId" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Vote_v2" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_v2_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
-- Cleanup orphans
UPDATE "cash_book" SET "ownerId" = NULL WHERE "ownerId" NOT IN (SELECT "id" FROM "users") AND "ownerId" IS NOT NULL;
DELETE FROM "Chat" WHERE "userId" NOT IN (SELECT "id" FROM "users");
UPDATE "customers" SET "ownerId" = NULL WHERE "ownerId" NOT IN (SELECT "id" FROM "users") AND "ownerId" IS NOT NULL;
DELETE FROM "Document" WHERE "userId" NOT IN (SELECT "id" FROM "users");
UPDATE "knowledge_base" SET "userId" = NULL WHERE "userId" NOT IN (SELECT "id" FROM "users") AND "userId" IS NOT NULL;
DELETE FROM "Message_v2" WHERE "chatId" NOT IN (SELECT "id" FROM "Chat");
UPDATE "orders" SET "customerId" = NULL WHERE "customerId" NOT IN (SELECT "id" FROM "customers") AND "customerId" IS NOT NULL;
UPDATE "orders" SET "ownerId" = NULL WHERE "ownerId" NOT IN (SELECT "id" FROM "users") AND "ownerId" IS NOT NULL;
UPDATE "payments" SET "customerId" = NULL WHERE "customerId" NOT IN (SELECT "id" FROM "customers") AND "customerId" IS NOT NULL;
UPDATE "payments" SET "ownerId" = NULL WHERE "ownerId" NOT IN (SELECT "id" FROM "users") AND "ownerId" IS NOT NULL;
DELETE FROM "Stream" WHERE "chatId" NOT IN (SELECT "id" FROM "Chat");
DELETE FROM "Suggestion" WHERE "userId" NOT IN (SELECT "id" FROM "users");
DELETE FROM "Suggestion" WHERE ("documentId", "documentCreatedAt") NOT IN (SELECT "id", "createdAt" FROM "Document");
DELETE FROM "user_memories" WHERE "userId" NOT IN (SELECT "id" FROM "users");
DELETE FROM "Vote_v2" WHERE "chatId" NOT IN (SELECT "id" FROM "Chat");
DELETE FROM "Vote_v2" WHERE "messageId" NOT IN (SELECT "id" FROM "Message_v2");

--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_book_ownerId_users_id_fk') THEN
        ALTER TABLE "cash_book" ADD CONSTRAINT "cash_book_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Chat_userId_users_id_fk') THEN
        ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_ownerId_users_id_fk') THEN
        ALTER TABLE "customers" ADD CONSTRAINT "customers_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Document_userId_users_id_fk') THEN
        ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_base_userId_users_id_fk') THEN
        ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_v2_chatId_Chat_id_fk') THEN
        ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_customerId_customers_id_fk') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_customers_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_ownerId_users_id_fk') THEN
        ALTER TABLE "orders" ADD CONSTRAINT "orders_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_customerId_customers_id_fk') THEN
        ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_customers_id_fk" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_ownerId_users_id_fk') THEN
        ALTER TABLE "payments" ADD CONSTRAINT "payments_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Stream_chatId_Chat_id_fk') THEN
        ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Suggestion_userId_users_id_fk') THEN
        ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk') THEN
        ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk" FOREIGN KEY ("documentId","documentCreatedAt") REFERENCES "public"."Document"("id","createdAt") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_memories_userId_users_id_fk') THEN
        ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vote_v2_chatId_Chat_id_fk') THEN
        ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Vote_v2_messageId_Message_v2_id_fk') THEN
        ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cash_date_idx" ON "cash_book" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cash_owner_idx" ON "cash_book" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_owner_idx" ON "customers" USING btree ("ownerId","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_date_idx" ON "orders" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_owner_idx" ON "orders" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_date_idx" ON "payments" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_owner_idx" ON "payments" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "firestore_id_idx" ON "users" USING btree ("firestoreId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zalo_id_idx" ON "users" USING btree ("zaloId");