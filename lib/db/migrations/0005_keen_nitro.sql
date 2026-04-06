DO $$ BEGIN
    ALTER TABLE "Document" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION WHEN others THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Document' AND column_name='kind') THEN
        ALTER TABLE "Document" ADD COLUMN "kind" text NOT NULL;
    END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='imageUrl') THEN
        ALTER TABLE "products" ADD COLUMN "imageUrl" text;
    END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Stream' AND column_name='content') THEN
        ALTER TABLE "Stream" ADD COLUMN "content" text NOT NULL DEFAULT '';
    END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Suggestion' AND column_name='isCurrent') THEN
        ALTER TABLE "Suggestion" ADD COLUMN "isCurrent" boolean DEFAULT true NOT NULL;
    END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Document' AND column_name='text') THEN
        ALTER TABLE "Document" DROP COLUMN "text";
    END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Suggestion' AND column_name='isResolved') THEN
        ALTER TABLE "Suggestion" DROP COLUMN "isResolved";
    END IF;
END $$;