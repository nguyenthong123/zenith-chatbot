-- Align database columns with schema.ts changes from commit f907d7b
-- 1. Rename Document."text" → "kind"
-- 2. Rename Suggestion."isResolved" → "isCurrent" and flip default
-- 3. Add Stream."content" column

-- Document: rename "text" column to "kind" and change type to text
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Document' AND column_name='text')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Document' AND column_name='kind') THEN
        ALTER TABLE "Document" RENAME COLUMN "text" TO "kind";
        ALTER TABLE "Document" ALTER COLUMN "kind" SET DATA TYPE text;
        ALTER TABLE "Document" ALTER COLUMN "kind" DROP DEFAULT;
    END IF;
END $$;
--> statement-breakpoint

-- Suggestion: rename "isResolved" column to "isCurrent" and flip default
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Suggestion' AND column_name='isResolved')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Suggestion' AND column_name='isCurrent') THEN
        ALTER TABLE "Suggestion" RENAME COLUMN "isResolved" TO "isCurrent";
        ALTER TABLE "Suggestion" ALTER COLUMN "isCurrent" SET DEFAULT true;
        -- Flip existing values: false → true, true → false
        UPDATE "Suggestion" SET "isCurrent" = NOT "isCurrent";
    END IF;
END $$;
--> statement-breakpoint

-- Stream: add "content" column if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Stream' AND column_name='content') THEN
        ALTER TABLE "Stream" ADD COLUMN "content" text NOT NULL DEFAULT '';
    END IF;
END $$;
