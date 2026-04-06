CREATE TABLE IF NOT EXISTS "zalo_config" (
	"id" text PRIMARY KEY NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_customerId_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_customerId_customers_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "cash_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "cash_owner_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "customer_name_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "order_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "order_owner_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "payment_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "payment_owner_idx";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" SET DATA TYPE varchar(255);--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_book' AND column_name='ownerEmail') THEN ALTER TABLE "cash_book" ADD COLUMN "ownerEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_book' AND column_name='createdBy') THEN ALTER TABLE "cash_book" ADD COLUMN "createdBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_book' AND column_name='updatedBy') THEN ALTER TABLE "cash_book" ADD COLUMN "updatedBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_book' AND column_name='updatedByEmail') THEN ALTER TABLE "cash_book" ADD COLUMN "updatedByEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='createdBy') THEN ALTER TABLE "customers" ADD COLUMN "createdBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='updatedBy') THEN ALTER TABLE "customers" ADD COLUMN "updatedBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='updatedByEmail') THEN ALTER TABLE "customers" ADD COLUMN "updatedByEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='ownerEmail') THEN ALTER TABLE "orders" ADD COLUMN "ownerEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='createdBy') THEN ALTER TABLE "orders" ADD COLUMN "createdBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='updatedBy') THEN ALTER TABLE "orders" ADD COLUMN "updatedBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='updatedByEmail') THEN ALTER TABLE "orders" ADD COLUMN "updatedByEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='ownerEmail') THEN ALTER TABLE "payments" ADD COLUMN "ownerEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='createdBy') THEN ALTER TABLE "payments" ADD COLUMN "createdBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='updatedBy') THEN ALTER TABLE "payments" ADD COLUMN "updatedBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='updatedByEmail') THEN ALTER TABLE "payments" ADD COLUMN "updatedByEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='price_lists' AND column_name='ownerEmail') THEN ALTER TABLE "price_lists" ADD COLUMN "ownerEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='price_lists' AND column_name='createdBy') THEN ALTER TABLE "price_lists" ADD COLUMN "createdBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='price_lists' AND column_name='createdByEmail') THEN ALTER TABLE "price_lists" ADD COLUMN "createdByEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='price_lists' AND column_name='updatedByEmail') THEN ALTER TABLE "price_lists" ADD COLUMN "updatedByEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='ownerEmail') THEN ALTER TABLE "products" ADD COLUMN "ownerEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='createdBy') THEN ALTER TABLE "products" ADD COLUMN "createdBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='createdByEmail') THEN ALTER TABLE "products" ADD COLUMN "createdByEmail" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='updatedBy') THEN ALTER TABLE "products" ADD COLUMN "updatedBy" text; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='updatedByEmail') THEN ALTER TABLE "products" ADD COLUMN "updatedByEmail" text; END IF; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_date_idx" ON "cash_book" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_owner_idx" ON "cash_book" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_date_idx" ON "orders" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_owner_idx" ON "orders" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_date_idx" ON "payments" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_owner_idx" ON "payments" USING btree ("ownerId");