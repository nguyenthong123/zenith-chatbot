import { tool } from "ai";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type Order, order } from "@/lib/db/schema";

export const getOrderLookup = (
  userId: string,
  userRole: string,
  userEmail?: string,
) =>
  tool({
    description:
      "Search for orders or summarize sales performance in the Supabase database. Use this to find orders by customer name, dates, or status. Leave all fields empty to get the latest orders for the current user/account. Provide a specific date (YYYY-MM-DD) for 'today' or 'yesterday'.",
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
        const conditions = [];

        // Mandatory account isolation by email/ID
        conditions.push(
          or(eq(order.ownerId, userId), eq(order.ownerEmail, userEmail ?? "")),
        );

        if (userRole === "admin" && employeeEmail) {
          // Admins can filter by specific employee email
          conditions.push(eq(order.createdByEmail, employeeEmail));
        }

        if (customerName) {
          conditions.push(ilike(order.customerName, `%${customerName}%`));
        }
        if (startDate) {
          conditions.push(gte(order.date, startDate));
        }
        if (endDate) {
          conditions.push(lte(order.date, endDate));
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
            ...o,
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
