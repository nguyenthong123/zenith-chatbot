import { tool } from "ai";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const getOrderSupabaseLookup = (
  userId: string,
  userRole: string,
  userEmail?: string | null,
) =>
  tool({
    description:
      "Query orders directly from Supabase to look up revenue, sales data, and order history. Use this tool when users ask about revenue (doanh thu), sales performance, order totals, or order details. For non-admin users, results are automatically filtered by their session email.",
    inputSchema: z.object({
      customerName: z
        .string()
        .optional()
        .describe("Filter orders by customer name."),
      employeeEmail: z
        .string()
        .optional()
        .describe(
          "Filter orders by employee email (Admin only). Leave empty for current user.",
        ),
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
        const supabase = createSupabaseAdminClient();

        let queryBuilder = supabase
          .from("orders")
          .select(
            "id, orderId, customerId, customerName, totalAmount, status, date, items, ownerId, ownerEmail, createdBy, createdByEmail, updatedBy, createdAt, updatedAt",
            { count: "exact" },
          )
          .order("date", { ascending: false });

        // Role-based data isolation
        if (userRole !== "admin") {
          const isolationClauses = [];
          if (userEmail) isolationClauses.push(`ownerEmail.eq.${userEmail}`);
          if (userId) isolationClauses.push(`ownerId.eq.${userId}`);

          if (isolationClauses.length > 0) {
            queryBuilder = queryBuilder.or(isolationClauses.join(","));
          } else {
            return {
              error: "Không thể xác định người dùng. Vui lòng đăng nhập lại.",
              ordersCount: 0,
              totalCount: 0,
              totalRevenue: 0,
            };
          }
        } else if (employeeEmail) {
          queryBuilder = queryBuilder.eq(
            "createdByEmail",
            employeeEmail.replace(/[%_]/g, ""),
          );
        }

        if (customerName) {
          queryBuilder = queryBuilder.ilike(
            "customerName",
            `%${customerName.replace(/[%_]/g, "")}%`,
          );
        }
        if (startDate) {
          queryBuilder = queryBuilder.gte("date", startDate);
        }
        if (endDate) {
          queryBuilder = queryBuilder.lte("date", endDate);
        }
        if (status) {
          queryBuilder = queryBuilder.eq("status", status);
        }

        const {
          data: allMatching,
          error: statsError,
          count,
        } = await queryBuilder;

        if (statsError) {
          throw statsError;
        }

        const totalRevenue =
          allMatching?.reduce((acc, o) => acc + (o.totalAmount || 0), 0) || 0;

        const results = allMatching?.slice(0, 20) || [];

        return {
          ordersCount: results.length,
          totalCount: count || 0,
          totalRevenue,
          orders: results.map((o) => ({
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
      } catch (error) {
        console.error("Order Supabase lookup failed:", error);
        return {
          error: "Không thể truy vấn đơn hàng từ Supabase.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
