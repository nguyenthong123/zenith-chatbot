import { tool } from "ai";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import {
  cashBook as cashBookTable,
  customer as customerTable,
  order as orderTable,
  payment as paymentTable,
  product as productTable,
  systemConfig as systemConfigTable,
} from "@/lib/db/schema";

export const getDatabaseLookup = (
  userId: string,
  _userRole: string,
  userEmail?: string,
) =>
  tool({
    description:
      "Search for ANY information (products, customers, orders, payments, cash book, system config) in the Supabase database. This is a smart, global search tool that finds matches in a comprehensive markdown summary field. Use this for broad queries or to quickly find details across multiple tables.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The search term (name, phone, SKU, address, note, etc.)"),
      category: z
        .enum([
          "all",
          "products",
          "customers",
          "orders",
          "payments",
          "cash-book",
          "system-config",
        ])
        .default("all")
        .describe("Optional category to narrow down the search."),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(20)
        .describe("Maximum results to return."),
    }),
    execute: async ({ query, category, limit }) => {
      try {
        const normalizedQuery = `%${query.toLowerCase().trim()}%`;

        // Authorization filter
        const authFilter = (table: any) =>
          or(eq(table.ownerId, userId), eq(table.ownerEmail, userEmail ?? ""));

        const searchTasks: Promise<any[]>[] = [];

        if (category === "all" || category === "products") {
          searchTasks.push(
            db
              .select({
                id: productTable.id,
                summary: productTable.infoMarkdown,
                updatedAt: productTable.updatedAt,
              })
              .from(productTable)
              .where(
                and(
                  authFilter(productTable),
                  ilike(productTable.infoMarkdown, normalizedQuery),
                ),
              )
              .limit(limit)
              .then((rows) =>
                rows.map((r) => ({ ...r, type: "product" as const })),
              ),
          );
        }

        if (category === "all" || category === "customers") {
          searchTasks.push(
            db
              .select({
                id: customerTable.id,
                summary: customerTable.infoMarkdown,
                updatedAt: customerTable.updatedAt,
              })
              .from(customerTable)
              .where(
                and(
                  authFilter(customerTable),
                  ilike(customerTable.infoMarkdown, normalizedQuery),
                ),
              )
              .limit(limit)
              .then((rows) =>
                rows.map((r) => ({ ...r, type: "customer" as const })),
              ),
          );
        }

        if (category === "all" || category === "orders") {
          searchTasks.push(
            db
              .select({
                id: orderTable.id,
                summary: orderTable.infoMarkdown,
                updatedAt: orderTable.updatedAt,
              })
              .from(orderTable)
              .where(
                and(
                  authFilter(orderTable),
                  ilike(orderTable.infoMarkdown, normalizedQuery),
                ),
              )
              .limit(limit)
              .then((rows) =>
                rows.map((r) => ({ ...r, type: "order" as const })),
              ),
          );
        }

        if (category === "all" || category === "payments") {
          searchTasks.push(
            db
              .select({
                id: paymentTable.id,
                summary: paymentTable.infoMarkdown,
                updatedAt: paymentTable.createdAt,
              })
              .from(paymentTable)
              .where(
                and(
                  authFilter(paymentTable),
                  ilike(paymentTable.infoMarkdown, normalizedQuery),
                ),
              )
              .limit(limit)
              .then((rows) =>
                rows.map((r) => ({ ...r, type: "payment" as const })),
              ),
          );
        }

        if (category === "all" || category === "cash-book") {
          searchTasks.push(
            db
              .select({
                id: cashBookTable.id,
                summary: cashBookTable.infoMarkdown,
                updatedAt: cashBookTable.createdAt,
              })
              .from(cashBookTable)
              .where(
                and(
                  authFilter(cashBookTable),
                  ilike(cashBookTable.infoMarkdown, normalizedQuery),
                ),
              )
              .limit(limit)
              .then((rows) =>
                rows.map((r) => ({ ...r, type: "cash-book" as const })),
              ),
          );
        }

        if (category === "all" || category === "system-config") {
          searchTasks.push(
            db
              .select({
                id: systemConfigTable.id,
                summary: systemConfigTable.infoMarkdown,
                updatedAt: systemConfigTable.updatedAt,
              })
              .from(systemConfigTable)
              .where(ilike(systemConfigTable.infoMarkdown, normalizedQuery))
              .limit(5)
              .then((rows) =>
                rows.map((r) => ({ ...r, type: "system-config" as const })),
              ),
          );
        }

        const results = await Promise.all(searchTasks);
        const flatResults = results
          .flat()
          .sort(
            (a, b) =>
              new Date(b.updatedAt || 0).getTime() -
              new Date(a.updatedAt || 0).getTime(),
          )
          .slice(0, limit);

        if (flatResults.length === 0) {
          return {
            message: `No matching records found for "${query}"${category !== "all" ? ` in category ${category}` : ""}.`,
          };
        }

        return {
          resultsCount: flatResults.length,
          results: flatResults.map((res) => ({
            type: res.type,
            id: res.id,
            summary: res.summary,
          })),
        };
      } catch (error) {
        return {
          error: "Failed to perform global database lookup.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
