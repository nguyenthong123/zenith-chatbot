import { tool } from "ai";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import {
  type PriceList,
  type Product,
  priceList,
  product,
} from "@/lib/db/schema";

export const getProductLookup = (
  userId: string,
  userRole: string,
  userEmail?: string,
) =>
  tool({
    description:
      "Search for products, prices, and price lists in the Supabase database. Use this to answer customer questions about product availability and pricing.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The name of the product or category to search for."),
    }),
    execute: async ({ query }) => {
      try {
        const conditions = [
          or(
            ilike(product.name, `%${query}%`),
            ilike(product.category, `%${query}%`),
            ilike(product.sku, `%${query}%`),
          ),
        ];

        const plConditions = [ilike(priceList.title, `%${query}%`)];

        // Mandatory account isolation by email/ID
        conditions.push(
          or(
            eq(product.ownerId, userId),
            eq(product.ownerEmail, userEmail ?? ""),
          ),
        );
        plConditions.push(
          or(
            eq(priceList.ownerId, userId),
            eq(priceList.ownerEmail, userEmail ?? ""),
          )!,
        );

        // 1. Search in products table
        const products = await db
          .select()
          .from(product)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .limit(10);

        // 2. Search in price lists table titles
        const priceLists = await db
          .select()
          .from(priceList)
          .where(plConditions.length > 0 ? and(...plConditions) : undefined)
          .limit(5);

        if (products.length === 0 && priceLists.length === 0) {
          return {
            message: `No products or price lists found matching "${query}".`,
          };
        }

        return {
          products: products.map((p: Product) => ({
            ...p,
            priceBuy: userRole === "admin" ? p.priceBuy : undefined, // Only admins see cost price
          })),
          priceLists: priceLists.map((pl: PriceList) => ({
            title: pl.title,
            headers: pl.headers,
            items: Array.isArray(pl.items) ? pl.items.slice(0, 10) : [],
            updatedBy: pl.updatedBy,
            updatedAt: pl.updatedAt,
            ownerEmail: pl.ownerEmail,
          })),
        };
      } catch (error) {
        console.error("Product lookup failed:", error);
        return {
          error: "Failed to search for products.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
