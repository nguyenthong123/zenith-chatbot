import { tool } from "ai";
import { and, eq, ilike, isNotNull, or } from "drizzle-orm";
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
      "Search for products, prices, images, photos, and price lists in the Supabase database. Use this to answer customer questions about product availability, pricing, and visual appearance.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          "The name of the product or category to search for. Leave empty to list recent products.",
        ),
      hasImages: z
        .boolean()
        .optional()
        .describe("If true, only return products that have images."),
    }),
    execute: async ({ query, hasImages }) => {
      try {
        let normalizedQuery = query?.toLowerCase().trim() || "";
        if (normalizedQuery === "undefined" || normalizedQuery === "null") {
          normalizedQuery = "";
        }
        normalizedQuery = normalizedQuery.replace(/\s+ly\b/g, "mm");

        // Split into keywords to allow partial/out-of-order matches
        const keywords = normalizedQuery
          .split(/\s+/)
          .filter((k) => k.length > 0);

        // Build keyword conditions (all keywords must be present in either name, category, or sku)
        const keywordConditions = keywords.map((kw) =>
          or(
            ilike(product.name, `%${kw}%`),
            ilike(product.category, `%${kw}%`),
            ilike(product.sku, `%${kw}%`),
          ),
        );

        const conditions =
          keywordConditions.length > 0 ? [...keywordConditions] : [];
        const plConditions = keywords.map((kw) =>
          ilike(priceList.title, `%${kw}%`),
        );

        // Filter for images if requested
        if (hasImages) {
          conditions.push(isNotNull(product.imageUrls));
        }

        // Mandatory account isolation by email/ID
        conditions.push(
          or(
            eq(product.ownerId, userId),
            eq(product.ownerEmail, userEmail ?? ""),
          ),
        );
        const plOwnerCondition = or(
          eq(priceList.ownerId, userId),
          eq(priceList.ownerEmail, userEmail ?? ""),
        );
        if (plOwnerCondition) {
          plConditions.push(plOwnerCondition);
        }

        // 1. Search in products table
        const products = await db
          .select()
          .from(product)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .limit(20);

        // 2. Search in price lists table titles
        const priceLists = await db
          .select()
          .from(priceList)
          .where(plConditions.length > 0 ? and(...plConditions) : undefined)
          .limit(10);

        if (products.length === 0 && priceLists.length === 0) {
          return {
            message: `No products or price lists found matching "${query}".`,
          };
        }

        return {
          products: products.map((p: Product) => ({
            ...p,
            priceBuy: userRole === "admin" ? p.priceBuy : undefined, // Only admins see cost price
            imageUrls: p.imageUrls
              ? p.imageUrls
                  .split(",")
                  .map((url) => url.trim())
                  .filter(Boolean)
              : [],
            infoMarkdown: p.infoMarkdown,
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
        return {
          error: "Failed to search for products.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
