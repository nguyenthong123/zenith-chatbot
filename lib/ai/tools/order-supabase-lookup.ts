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

        let query = supabase
          .from("orders")
          .select(
            "id, orderId, customerId, customerName, totalAmount, status, date, items, ownerId, ownerEmail, createdBy, createdByEmail, updatedBy, createdAt, updatedAt",
          )
          .order("date", { ascending: false })
          .limit(20);

        // Role-based data isolation
        if (userRole !== "admin") {
          // Non-admin: filter by ownerEmail (session email) for data isolation
          if (userEmail) {
            query = query.eq("ownerEmail", userEmail);
          } else if (userId) {
            query = query.eq("ownerId", userId);
          } else {
            return {
              error: "Không thể xác định người dùng. Vui lòng đăng nhập lại.",
              ordersCount: 0,
              totalRevenue: 0,
            };
          }
        } else if (employeeEmail) {
          // Admin can filter by specific employee
          query = query.eq(
            "createdByEmail",
            employeeEmail.replace(/[%_]/g, ""),
          );
        }

        if (customerName) {
          query = query.ilike(
            "customerName",
            `%${customerName.replace(/[%_]/g, "")}%`,
          );
        }
        if (startDate) {
          query = query.gte("date", startDate);
        }
        if (endDate) {
          query = query.lte("date", endDate);
        }
        if (status) {
          query = query.eq("status", status);
        }

        const { data, error } = await query;

        if (error) {
          return {
            error: "Lỗi khi truy vấn bảng orders từ Supabase.",
            message: error.message,
          };
        }

        if (!data || data.length === 0) {
          return {
            ordersCount: 0,
            totalRevenue: 0,
            message: "Không tìm thấy đơn hàng nào phù hợp.",
          };
        }

        const totalRevenue = data.reduce(
          (acc, o) => acc + (o.totalAmount || 0),
          0,
        );

        return {
          ordersCount: data.length,
          totalRevenue,
          orders: data.map((o) => ({
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
        // biome-ignore lint/suspicious/noConsole: error logging in tool execution
        console.error("Order Supabase lookup failed:", error);
        return {
          error: "Không thể truy vấn đơn hàng từ Supabase.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
