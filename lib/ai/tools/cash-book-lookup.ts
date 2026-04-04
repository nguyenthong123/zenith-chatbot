import { tool } from "ai";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type CashBook, cashBook } from "@/lib/db/schema";

export const getCashBookLookup = (userId: string, userRole: string) =>
  tool({
    description:
      "Check for cash book entries including income (thu) and expenses (chi). Use this to answer questions about 'today's cash flow' or 'current balance'. Provide date range (YYYY-MM-DD) for accuracy.",
    inputSchema: z.object({
      type: z
        .enum(["thu", "chi"])
        .optional()
        .describe("Filter by type: income or expense."),
      startDate: z
        .string()
        .optional()
        .describe("Start date in YYYY-MM-DD format."),
      endDate: z.string().optional().describe("End date in YYYY-MM-DD format."),
    }),
    execute: async ({ type, startDate, endDate }) => {
      try {
        const conditions = [];

        if (type) {
          conditions.push(eq(cashBook.type, type));
        }
        if (startDate) {
          conditions.push(gte(cashBook.date, startDate));
        }
        if (endDate) {
          conditions.push(lte(cashBook.date, endDate));
        }

        // Role-based data isolation
        if (userRole !== "admin") {
          conditions.push(eq(cashBook.ownerId, userId));
        }

        const entries = await db
          .select()
          .from(cashBook)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(cashBook.date))
          .limit(30);

        const totalIncome = entries
          .filter((e) => e.type === "thu")
          .reduce((acc, e) => acc + (e.amount || 0), 0);
        const totalExpense = entries
          .filter((e) => e.type === "chi")
          .reduce((acc, e) => acc + (e.amount || 0), 0);

        return {
          totalIncome,
          totalExpense,
          netCashFlow: totalIncome - totalExpense,
          entries: entries.map((e: CashBook) => ({
            id: e.id,
            date: e.date,
            amount: e.amount,
            type: e.type,
            category: e.category,
            note: e.note,
            createdBy: e.createdBy,
            createdByEmail: e.createdByEmail,
            ownerEmail: e.ownerEmail,
            createdAt: e.createdAt,
          })),
        };
      } catch (error) {
        return {
          error: "Failed to fetch cash book info.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
