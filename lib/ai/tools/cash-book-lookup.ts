import { tool } from "ai";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type CashBook, cashBook } from "@/lib/db/schema";
import { getSupabaseClient } from "@/lib/supabase/server";

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
        // Try Supabase client first
        const supabase = getSupabaseClient();
        if (supabase) {
          return await queryWithSupabase(supabase, {
            userId,
            userRole,
            type,
            startDate,
            endDate,
          });
        }

        // Fallback to Drizzle ORM
        return await queryWithDrizzle({
          userId,
          userRole,
          type,
          startDate,
          endDate,
        });
      } catch (error) {
        return {
          error: "Failed to fetch cash book info.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

interface CashBookFilters {
  userId: string;
  userRole: string;
  type?: "thu" | "chi";
  startDate?: string;
  endDate?: string;
}

async function queryWithSupabase(
  supabase: ReturnType<typeof getSupabaseClient> & object,
  filters: CashBookFilters,
) {
  let q = supabase.from("cash_book").select("*");

  if (filters.type) {
    q = q.eq("type", filters.type);
  }
  if (filters.startDate) {
    q = q.gte("date", filters.startDate);
  }
  if (filters.endDate) {
    q = q.lte("date", filters.endDate);
  }
  if (filters.userRole !== "admin") {
    q = q.eq("ownerId", filters.userId);
  }

  const { data: entries } = await q
    .order("date", { ascending: false })
    .limit(30);

  const items = entries || [];
  const totalIncome = items
    .filter((e: Record<string, unknown>) => e.type === "thu")
    .reduce(
      (acc: number, e: Record<string, unknown>) =>
        acc + (Number(e.amount) || 0),
      0,
    );
  const totalExpense = items
    .filter((e: Record<string, unknown>) => e.type === "chi")
    .reduce(
      (acc: number, e: Record<string, unknown>) =>
        acc + (Number(e.amount) || 0),
      0,
    );

  return {
    totalIncome,
    totalExpense,
    netCashFlow: totalIncome - totalExpense,
    entries: items.map((e: Record<string, unknown>) => ({
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
}

async function queryWithDrizzle(filters: CashBookFilters) {
  const conditions = [];

  if (filters.type) {
    conditions.push(eq(cashBook.type, filters.type));
  }
  if (filters.startDate) {
    conditions.push(gte(cashBook.date, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(cashBook.date, filters.endDate));
  }
  if (filters.userRole !== "admin") {
    conditions.push(eq(cashBook.ownerId, filters.userId));
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
}
