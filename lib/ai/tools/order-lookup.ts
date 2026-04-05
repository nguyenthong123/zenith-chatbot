import { tool } from "ai";
import { and, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type Order, order } from "@/lib/db/schema";
import { getSupabaseClient } from "@/lib/supabase/server";

export const getOrderLookup = (userId: string, userRole: string) =>
  tool({
    description:
      "Search for orders or summarize sales performance. Use this to find orders by customer name, dates, or status. Leave all fields empty to get the latest orders for the current user/account. Provide a specific date (YYYY-MM-DD) for 'today' or 'yesterday'.",
    inputSchema: z.object({
      customerName: z
        .string()
        .optional()
        .describe("Filter orders by customer name."),
      employeeEmail: z
        .string()
        .optional()
        .describe("Filter orders by employee email (Admin only)."),
      startDate: z
        .string()
        .optional()
        .describe("Start date in YYYY-MM-DD format."),
      endDate: z.string().optional().describe("End date in YYYY-MM-DD format."),
      status: z.string().optional().describe("Filter by order status."),
    }),
    execute: async ({
      customerName,
      employeeEmail,
      startDate,
      endDate,
      status,
    }) => {
      try {
        // Try Supabase client first
        const supabase = getSupabaseClient();
        if (supabase) {
          return await queryWithSupabase(supabase, {
            userId,
            userRole,
            customerName,
            employeeEmail,
            startDate,
            endDate,
            status,
          });
        }

        // Fallback to Drizzle ORM
        return await queryWithDrizzle({
          userId,
          userRole,
          customerName,
          employeeEmail,
          startDate,
          endDate,
          status,
        });
      } catch (error) {
        return {
          error: "Failed to search for orders.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

interface OrderFilters {
  userId: string;
  userRole: string;
  customerName?: string;
  employeeEmail?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

async function queryWithSupabase(
  supabase: ReturnType<typeof getSupabaseClient> & object,
  filters: OrderFilters,
) {
  let q = supabase.from("orders").select("*");

  if (filters.userRole !== "admin") {
    q = q.eq("ownerId", filters.userId);
  } else if (filters.employeeEmail) {
    q = q.eq("createdByEmail", filters.employeeEmail);
  }

  if (filters.customerName) {
    q = q.ilike("customerName", `%${filters.customerName}%`);
  }
  if (filters.startDate) {
    q = q.gte("date", filters.startDate);
  }
  if (filters.endDate) {
    q = q.lte("date", filters.endDate);
  }
  if (filters.status) {
    q = q.eq("status", filters.status);
  }

  const { data: results } = await q
    .order("date", { ascending: false })
    .limit(20);

  const orders = results || [];
  const totalRevenue = orders.reduce(
    (acc: number, o: Record<string, unknown>) =>
      acc + (Number(o.totalAmount) || 0),
    0,
  );

  return {
    ordersCount: orders.length,
    totalRevenue,
    orders: orders.map((o: Record<string, unknown>) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      totalAmount: o.totalAmount,
      status: o.status,
      date: o.date,
      createdBy: o.createdBy,
      createdByEmail: o.createdByEmail,
      ownerEmail: o.ownerEmail,
      updatedBy: o.updatedBy,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
  };
}

async function queryWithDrizzle(filters: OrderFilters) {
  const conditions = [];

  if (filters.userRole !== "admin") {
    conditions.push(eq(order.ownerId, filters.userId));
  } else if (filters.employeeEmail) {
    conditions.push(eq(order.createdByEmail, filters.employeeEmail));
  }

  if (filters.customerName) {
    conditions.push(ilike(order.customerName, `%${filters.customerName}%`));
  }
  if (filters.startDate) {
    conditions.push(gte(order.date, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(order.date, filters.endDate));
  }
  if (filters.status) {
    conditions.push(eq(order.status, filters.status));
  }

  const results = await db
    .select()
    .from(order)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(order.date))
    .limit(20);

  const totalRevenue = results.reduce(
    (acc, o) => acc + (o.totalAmount || 0),
    0,
  );

  return {
    ordersCount: results.length,
    totalRevenue,
    orders: results.map((o: Order) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      totalAmount: o.totalAmount,
      status: o.status,
      date: o.date,
      createdBy: o.createdBy,
      createdByEmail: o.createdByEmail,
      ownerEmail: o.ownerEmail,
      updatedBy: o.updatedBy,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
  };
}
