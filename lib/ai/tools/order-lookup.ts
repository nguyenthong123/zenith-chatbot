import { tool } from "ai";
import { and, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type Order, order } from "@/lib/db/schema";

export const orderLookup = tool({
  description:
    "Search for orders or summarize sales performance. Use this to find orders by customer name or date range. Provide a specific date (YYYY-MM-DD) to answer questions about 'today'.",
  inputSchema: z.object({
    customerName: z
      .string()
      .optional()
      .describe("Filter orders by customer name."),
    startDate: z
      .string()
      .optional()
      .describe("Start date in YYYY-MM-DD format."),
    endDate: z.string().optional().describe("End date in YYYY-MM-DD format."),
    status: z.string().optional().describe("Filter by order status."),
  }),
  execute: async ({ customerName, startDate, endDate, status }) => {
    try {
      const conditions = [];

      if (customerName) {
        conditions.push(ilike(order.customerName, `%${customerName}%`));
      }
      if (startDate) {
        conditions.push(gte(order.date, new Date(startDate)));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(order.date, end));
      }
      if (status) {
        conditions.push(eq(order.status, status));
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
          date:
            o.date instanceof Date
              ? o.date.toISOString().split("T")[0]
              : o.date,
          createdAt: o.createdAt,
        })),
      };
    } catch (error) {
      return {
        error: "Failed to search for orders.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
