ALTER TABLE "Document" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "kind" text NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "imageUrl" text;--> statement-breakpoint
ALTER TABLE "Stream" ADD COLUMN "content" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "Suggestion" ADD COLUMN "isCurrent" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "Document" DROP COLUMN "text";--> statement-breakpoint
ALTER TABLE "Suggestion" DROP COLUMN "isResolved";