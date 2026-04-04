import { tool } from "ai";
import { ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import {
  type PriceList,
  type Product,
  priceList,
  product,
} from "@/lib/db/schema";

export const productLookup = tool({
  description:
    "Search for products, prices, and price lists in the local database. Use this to answer customer questions about product availability and pricing.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The name of the product or category to search for."),
  }),
  execute: async ({ query }) => {
    try {
      // 1. Search in products table
      const products = await db
        .select()
        .from(product)
        .where(
          or(
            ilike(product.name, `%${query}%`),
            ilike(product.category, `%${query}%`),
            ilike(product.sku, `%${query}%`),
          ),
        )
        .limit(10);

      // 2. Search in price lists table titles
      const priceLists = await db
        .select()
        .from(priceList)
        .where(ilike(priceList.title, `%${query}%`))
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
          unit: p.unit,
          stock: p.stock,
          specification: p.specification,
          category: p.category,
        })),
        priceLists: priceLists.map((pl: PriceList) => ({
          title: pl.title,
          headers: pl.headers,
          items: Array.isArray(pl.items) ? pl.items.slice(0, 10) : [],
          updatedAt: pl.updatedAt,
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
