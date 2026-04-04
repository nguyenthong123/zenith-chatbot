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

export const getProductLookup = (userId: string, userRole: string) =>
  tool({
    description:
      "Search for products, prices, and price lists in the local database. Use this to answer customer questions about product availability and pricing.",
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

        // Role-based data isolation
        if (userRole !== "admin") {
          conditions.push(eq(product.ownerId, userId));
          plConditions.push(eq(priceList.ownerId, userId));
        }

        // 1. Search in products table
        const products = await db
          .select()
          .from(product)
          .where(and(...conditions))
          .limit(10);

        // 2. Search in price lists table titles
        const priceLists = await db
          .select()
          .from(priceList)
          .where(and(...plConditions))
          .limit(5);

        if (products.length === 0 && priceLists.length === 0) {
          return {
            message: `No products or price lists found matching "${query}".`,
          };
        }

        return {
          products: products.map((p: Product) => ({
            name: p.name,
            sku: p.sku,
            priceSell: p.priceSell,
            priceBuy: userRole === "admin" ? p.priceBuy : undefined, // Chỉ admin xem giá nhập
            unit: p.unit,
            stock: p.stock,
            specification: p.specification,
            category: p.category,
            createdBy: p.createdBy,
            createdByEmail: p.createdByEmail,
            ownerEmail: p.ownerEmail,
            updatedBy: p.updatedBy,
            updatedAt: p.updatedAt,
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
