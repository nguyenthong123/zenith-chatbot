import { tool } from "ai";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";

export const getDatabaseDiagnostics = () =>
  tool({
    description:
      "Get summary stats about the database (counts of knowledge records, documents, messages). Use this periodically to verify if the knowledge base is populated or if you are working with an empty database.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const getCount = async (tableName: string) => {
          try {
            const result = await db.execute(
              sql.raw(`SELECT count(*) FROM "${tableName}"`),
            );
            return Number(result[0]?.count || 0);
          } catch (_e) {
            return -1; // -1 indicates error for this specific table
          }
        };

        const kbCount = await getCount("knowledge_base");
        const docCount = await getCount("Document");
        const msgCount = await getCount("Message_v2");

        return {
          tables: {
            knowledge_base_records: kbCount,
            documents: docCount,
            total_messages_system_wide: msgCount,
          },
          message:
            "Database diagnostics complete. A count of -1 indicates a table search error.",
        };
      } catch (error) {
        // Fallback for different table names if there was a schema mismatch during migration
        return {
          error: "Diagnostic failed",
          details: error instanceof Error ? error.message : String(error),
          context:
            "This might happen if table names differ from expected 'KnowledgeBase', 'Document', or 'Message'.",
        };
      }
    },
  });
