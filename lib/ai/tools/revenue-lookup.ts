import { tool } from "ai";
import { and, desc, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type Order, order, user } from "@/lib/db/schema";
import { getSupabaseClient } from "@/lib/supabase/server";

export const getRevenueForUser = tool({
  description:
    'Look up revenue (doanh thu) for a specific user. Requires the user email (obtained from getUserByEmail tool), and a date range. Only counts orders with status "chốt" or "nháp". This is the SECOND step in the revenue lookup process, after finding the user by email.',
  inputSchema: z.object({
    email: z
      .string()
      .describe(
        "The email of the user whose revenue to look up (obtained from getUserByEmail).",
      ),
    userName: z
      .string()
      .optional()
      .describe(
        "The display name of the user (obtained from getUserByEmail), used for matching customerName in orders.",
      ),
    startDate: z.string().describe("Start date in YYYY-MM-DD format."),
    endDate: z.string().describe("End date in YYYY-MM-DD format."),
  }),
  execute: async ({ email, userName, startDate, endDate }) => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        return await queryWithSupabase(supabase, {
          email,
          userName,
          startDate,
          endDate,
        });
      }
      return await queryWithDrizzle({
        email,
        userName,
        startDate,
        endDate,
      });
    } catch (error) {
      return {
        error: "Failed to look up revenue.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

interface RevenueFilters {
  email: string;
  userName?: string;
  startDate: string;
  endDate: string;
}

const VALID_STATUSES = ["chốt", "nháp"];

async function queryWithSupabase(
  supabase: ReturnType<typeof getSupabaseClient> & object,
  filters: RevenueFilters,
) {
  // First, find the user by email to get their ownerId
  const { data: users } = await supabase
    .from("users")
    .select("id, name, displayName")
    .eq("email", filters.email)
    .limit(1);

  if (!users || users.length === 0) {
    return {
      error: `Không tìm thấy người dùng với email "${filters.email}".`,
      totalRevenue: 0,
      ordersCount: 0,
      orders: [],
    };
  }

  const foundUser = users[0] as Record<string, unknown>;
  const userId = foundUser.id as string;
  const userDisplayName =
    filters.userName ||
    (foundUser.displayName as string) ||
    (foundUser.name as string) ||
    "";

  // Query orders: match by ownerId OR createdByEmail OR customerName, within date range, with valid statuses
  // Sanitize values for use in PostgREST filter strings to prevent filter injection
  const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, "");
  const safeEmail = filters.email.replace(/[,()]/g, "");

  let q = supabase
    .from("orders")
    .select("*")
    .gte("date", filters.startDate)
    .lte("date", filters.endDate)
    .in("status", VALID_STATUSES);

  // Match orders belonging to this user: by ownerId or by createdByEmail
  if (userDisplayName) {
    const safeName = userDisplayName.replace(/[,()]/g, "");
    q = q.or(
      `ownerId.eq.${safeUserId},createdByEmail.eq.${safeEmail},customerName.ilike.%${safeName}%`,
    );
  } else {
    q = q.or(`ownerId.eq.${safeUserId},createdByEmail.eq.${safeEmail}`);
  }

  const { data: results } = await q
    .order("date", { ascending: false })
    .limit(100);

  const orders = results || [];
  const totalRevenue = orders.reduce(
    (acc: number, o: Record<string, unknown>) =>
      acc + (Number(o.totalAmount) || 0),
    0,
  );

  return {
    email: filters.email,
    userName: userDisplayName,
    startDate: filters.startDate,
    endDate: filters.endDate,
    ordersCount: orders.length,
    totalRevenue,
    statusFilter: VALID_STATUSES,
    orders: orders.map((o: Record<string, unknown>) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      totalAmount: o.totalAmount,
      status: o.status,
      date: o.date,
      createdBy: o.createdBy,
      createdByEmail: o.createdByEmail,
    })),
  };
}

async function queryWithDrizzle(filters: RevenueFilters) {
  // First, find the user by email
  const users = await db
    .select()
    .from(user)
    .where(eq(user.email, filters.email))
    .limit(1);

  if (users.length === 0) {
    return {
      error: `Không tìm thấy người dùng với email "${filters.email}".`,
      totalRevenue: 0,
      ordersCount: 0,
      orders: [],
    };
  }

  const foundUser = users[0];
  const userId = foundUser.id;
  const userDisplayName =
    filters.userName || foundUser.displayName || foundUser.name || "";

  // Build conditions: date range + status filter + user match
  const dateAndStatusConditions = [
    gte(order.date, filters.startDate),
    lte(order.date, filters.endDate),
    inArray(order.status, VALID_STATUSES),
  ];

  // User match: ownerId OR createdByEmail OR customerName
  const userMatchConditions = [
    eq(order.ownerId, userId),
    eq(order.createdByEmail, filters.email),
  ];

  if (userDisplayName) {
    userMatchConditions.push(ilike(order.customerName, `%${userDisplayName}%`));
  }

  const results = await db
    .select()
    .from(order)
    .where(and(...dateAndStatusConditions, or(...userMatchConditions)))
    .orderBy(desc(order.date))
    .limit(100);

  const totalRevenue = results.reduce(
    (acc, o) => acc + (o.totalAmount || 0),
    0,
  );

  return {
    email: filters.email,
    userName: userDisplayName,
    startDate: filters.startDate,
    endDate: filters.endDate,
    ordersCount: results.length,
    totalRevenue,
    statusFilter: VALID_STATUSES,
    orders: results.map((o: Order) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      totalAmount: o.totalAmount,
      status: o.status,
      date: o.date,
      createdBy: o.createdBy,
      createdByEmail: o.createdByEmail,
    })),
  };
}
