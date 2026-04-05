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
import { getSupabaseClient } from "@/lib/supabase/server";

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
        // Try Supabase client first (uses REST API keys from env)
        const supabase = getSupabaseClient();
        if (supabase) {
          return await queryWithSupabase(supabase, query, userId, userRole);
        }

        // Fallback to Drizzle ORM
        return await queryWithDrizzle(query, userId, userRole);
      } catch (error) {
        return {
          error: "Failed to search for products.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

async function queryWithSupabase(
  supabase: ReturnType<typeof getSupabaseClient> & object,
  query: string,
  userId: string,
  userRole: string,
) {
  let productQuery = supabase
    .from("products")
    .select("*")
    .or(`name.ilike.%${query}%,category.ilike.%${query}%,sku.ilike.%${query}%`)
    .limit(10);

  let plQuery = supabase
    .from("price_lists")
    .select("*")
    .ilike("title", `%${query}%`)
    .limit(5);

  if (userRole !== "admin") {
    productQuery = productQuery.eq("ownerId", userId);
    plQuery = plQuery.eq("ownerId", userId);
  }

  const [{ data: products }, { data: priceLists }] = await Promise.all([
    productQuery,
    plQuery,
  ]);

  if (
    (!products || products.length === 0) &&
    (!priceLists || priceLists.length === 0)
  ) {
    return {
      message: `No products or price lists found matching "${query}".`,
    };
  }

  return {
    products: (products || []).map((p: Record<string, unknown>) => ({
      name: p.name,
      sku: p.sku,
      priceSell: p.priceSell,
      priceBuy: userRole === "admin" ? p.priceBuy : undefined,
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
    priceLists: (priceLists || []).map((pl: Record<string, unknown>) => ({
      title: pl.title,
      headers: pl.headers,
      items: Array.isArray(pl.items)
        ? (pl.items as unknown[]).slice(0, 10)
        : [],
      updatedBy: pl.updatedBy,
      updatedAt: pl.updatedAt,
      ownerEmail: pl.ownerEmail,
    })),
  };
}

async function queryWithDrizzle(
  query: string,
  userId: string,
  userRole: string,
) {
  const conditions = [
    or(
      ilike(product.name, `%${query}%`),
      ilike(product.category, `%${query}%`),
      ilike(product.sku, `%${query}%`),
    ),
  ];

  const plConditions = [ilike(priceList.title, `%${query}%`)];

  if (userRole !== "admin") {
    conditions.push(eq(product.ownerId, userId));
    plConditions.push(eq(priceList.ownerId, userId));
  }

  const products = await db
    .select()
    .from(product)
    .where(and(...conditions))
    .limit(10);

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
      priceBuy: userRole === "admin" ? p.priceBuy : undefined,
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
}
