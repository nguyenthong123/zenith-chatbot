import { tool } from "ai";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { order, type Payment, payment } from "@/lib/db/schema";
import { getSupabaseClient } from "@/lib/supabase/server";

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
        // Try Supabase client first
        const supabase = getSupabaseClient();
        if (supabase) {
          return await queryWithSupabase(supabase, {
            userId,
            userRole,
            customerName,
            customerId,
          });
        }

        // Fallback to Drizzle ORM
        return await queryWithDrizzle({
          userId,
          userRole,
          customerName,
          customerId,
        });
      } catch (error) {
        return {
          error: "Failed to fetch billing info.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

interface BillingFilters {
  userId: string;
  userRole: string;
  customerName?: string;
  customerId?: string;
}

async function queryWithSupabase(
  supabase: ReturnType<typeof getSupabaseClient> & object,
  filters: BillingFilters,
) {
  let orderQuery = supabase.from("orders").select("totalAmount");
  let paymentQuery = supabase.from("payments").select("*");

  if (filters.customerId) {
    orderQuery = orderQuery.eq("customerId", filters.customerId);
    paymentQuery = paymentQuery.eq("customerId", filters.customerId);
  } else if (filters.customerName) {
    orderQuery = orderQuery.ilike("customerName", `%${filters.customerName}%`);
    paymentQuery = paymentQuery.ilike(
      "customerName",
      `%${filters.customerName}%`,
    );
  }

  if (filters.userRole !== "admin") {
    orderQuery = orderQuery.eq("ownerId", filters.userId);
    paymentQuery = paymentQuery.eq("ownerId", filters.userId);
  }

  const [{ data: orderData }, { data: paymentData }] = await Promise.all([
    orderQuery,
    paymentQuery.order("date", { ascending: false }).limit(10),
  ]);

  const totalOrdered = (orderData || []).reduce(
    (acc: number, o: Record<string, unknown>) =>
      acc + (Number(o.totalAmount) || 0),
    0,
  );
  const totalPaid = (paymentData || []).reduce(
    (acc: number, p: Record<string, unknown>) => acc + (Number(p.amount) || 0),
    0,
  );
  const currentDebt = totalOrdered - totalPaid;

  return {
    customerName: filters.customerName || "Customer",
    totalOrdersAmount: totalOrdered,
    totalPaymentsAmount: totalPaid,
    currentDebt,
    recentPayments: (paymentData || [])
      .slice(0, 10)
      .map((p: Record<string, unknown>) => ({
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
}

async function queryWithDrizzle(filters: BillingFilters) {
  const orderConditions = [];
  const paymentConditions = [];

  if (filters.customerId) {
    orderConditions.push(eq(order.customerId, filters.customerId));
    paymentConditions.push(eq(payment.customerId, filters.customerId));
  } else if (filters.customerName) {
    orderConditions.push(
      ilike(order.customerName, `%${filters.customerName}%`),
    );
    paymentConditions.push(
      ilike(payment.customerName, `%${filters.customerName}%`),
    );
  }

  if (filters.userRole !== "admin") {
    orderConditions.push(eq(order.ownerId, filters.userId));
    paymentConditions.push(eq(payment.ownerId, filters.userId));
  }

  const [orderStats] = await db
    .select({ total: sql<number>`sum(${order.totalAmount})` })
    .from(order)
    .where(orderConditions.length > 0 ? and(...orderConditions) : undefined);

  const [paymentStats] = await db
    .select({ total: sql<number>`sum(${payment.amount})` })
    .from(payment)
    .where(
      paymentConditions.length > 0 ? and(...paymentConditions) : undefined,
    );

  const recentPayments = await db
    .select()
    .from(payment)
    .where(paymentConditions.length > 0 ? and(...paymentConditions) : undefined)
    .orderBy(desc(payment.date))
    .limit(10);

  const totalOrdered = Number(orderStats?.total || 0);
  const totalPaid = Number(paymentStats?.total || 0);
  const currentDebt = totalOrdered - totalPaid;

  return {
    customerName: filters.customerName || "Customer",
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
}
