import { tool } from "ai";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { order, type Payment, payment } from "@/lib/db/schema";

export const getBillingLookup = (userId: string, userRole: string) =>
  tool({
    description:
      "Check for customer payments and calculate current debt. Use this to respond to questions like 'What is my current debt?' or 'Has customer X paid?'. Leave all fields empty to get a total debt summary for current account.",
    inputSchema: z.object({
      customerName: z
        .string()
        .optional()
        .describe("Filter by customer name (e.g., 'Anh Kiên')."),
      customerId: z.string().optional().describe("Filter by customer ID."),
    }),
    execute: async ({ customerName, customerId }) => {
      try {
        const orderConditions = [];
        const paymentConditions = [];

        if (customerId) {
          orderConditions.push(eq(order.customerId, customerId));
          paymentConditions.push(eq(payment.customerId, customerId));
        } else if (customerName) {
          orderConditions.push(ilike(order.customerName, `%${customerName}%`));
          paymentConditions.push(
            ilike(payment.customerName, `%${customerName}%`),
          );
        }

        // Role-based data isolation
        if (userRole !== "admin") {
          orderConditions.push(eq(order.ownerId, userId));
          paymentConditions.push(eq(payment.ownerId, userId));
        }

        // 1. Calculate total ordered amount
        const [orderStats] = await db
          .select({ total: sql<number>`sum(${order.totalAmount})` })
          .from(order)
          .where(
            orderConditions.length > 0 ? and(...orderConditions) : undefined,
          );

        // 2. Calculate total paid amount
        const [paymentStats] = await db
          .select({ total: sql<number>`sum(${payment.amount})` })
          .from(payment)
          .where(
            paymentConditions.length > 0
              ? and(...paymentConditions)
              : undefined,
          );

        // 3. Get recent payments
        const recentPayments = await db
          .select()
          .from(payment)
          .where(
            paymentConditions.length > 0
              ? and(...paymentConditions)
              : undefined,
          )
          .orderBy(desc(payment.date))
          .limit(10);

        const totalOrdered = Number(orderStats?.total || 0);
        const totalPaid = Number(paymentStats?.total || 0);
        const currentDebt = totalOrdered - totalPaid;

        return {
          customerName: customerName || "Customer",
          totalOrdersAmount: totalOrdered,
          totalPaymentsAmount: totalPaid,
          currentDebt,
          recentPayments: recentPayments.map((p: Payment) => ({
            id: p.id,
            amount: p.amount,
            date: p.date,
            method: p.paymentMethod,
            note: p.note,
            createdBy: p.createdBy,
            createdByEmail: p.createdByEmail,
            ownerEmail: p.ownerEmail,
            createdAt: p.createdAt,
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
