import { tool } from "ai";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { document } from "@/lib/db/schema";

export const getDocumentSearch = (userId: string) =>
  tool({
    description:
      "Search through saved technical documents, code artifacts, and spreadsheets (the 'Document' table). Use this to find specific technical specs or project-related files like building plans or material lists.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The topic or filename to search for in documents."),
    }),
    execute: async ({ query }) => {
      try {
        const results = await db
          .select()
          .from(document)
          .where(
            and(
              eq(document.userId, userId),
              or(
                ilike(document.title, `%${query}%`),
                ilike(document.content, `%${query}%`),
              ),
            ),
          )
          .orderBy(desc(document.createdAt))
          .limit(10);

        if (results.length === 0) {
          return {
            message: `No documents found matching "${query}".`,
            results: [],
          };
        }

        return {
          results: results.map((d) => ({
            id: d.id,
            title: d.title,
            kind: d.kind,
            content: d.content,
            createdAt: d.createdAt,
          })),
        };
      } catch (error) {
        return {
          error: "Failed to search documents.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
