import { tool } from "ai";
import { desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { order, type Payment, payment } from "@/lib/db/schema";

export const billingLookup = tool({
  description:
    "Check for customer payments and calculate current debt. Use this to respond to questions like 'What is my current debt?' or 'Has customer X paid?'.",
  inputSchema: z.object({
    customerName: z
      .string()
      .optional()
      .describe("Filter by customer name (e.g., 'Anh Kiên')."),
    customerId: z.string().optional().describe("Filter by customer ID."),
  }),
  execute: async ({ customerName, customerId }) => {
    try {
      const filters = customerId
        ? eq(order.customerId, customerId)
        : customerName
          ? ilike(order.customerName, `%${customerName}%`)
          : null;

      if (!filters) {
        return { message: "Please provide a customer name or ID." };
      }

      // 1. Calculate total ordered amount
      const [orderStats] = await db
        .select({ total: sql<number>`sum(${order.totalAmount})` })
        .from(order)
        .where(filters);

      // 2. Calculate total paid amount
      const paymentFilters = customerId
        ? eq(payment.customerId, customerId)
        : customerName
          ? ilike(payment.customerName, `%${customerName}%`)
          : null;

      const [paymentStats] = await db
        .select({ total: sql<number>`sum(${payment.amount})` })
        .from(payment)
        .where(paymentFilters as any);

      // 3. Get recent payments
      const recentPayments = await db
        .select()
        .from(payment)
        .where(paymentFilters as any)
        .orderBy(desc(payment.date))
        .limit(5);

      const totalOrdered = Number(orderStats?.total || 0);
      const totalPaid = Number(paymentStats?.total || 0);
      const currentDebt = totalOrdered - totalPaid;

      return {
        customerName: customerName || "Customer",
        totalOrdersAmount: totalOrdered,
        totalPaymentsAmount: totalPaid,
        currentDebt,
        recentPayments: recentPayments.map((p: Payment) => ({
          amount: p.amount,
          date:
            p.date instanceof Date
              ? p.date.toISOString().split("T")[0]
              : p.date,
          method: p.paymentMethod,
          note: p.note,
        })),
      };
    } catch (error) {
      return {
        error: "Failed to fetch billing info.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
