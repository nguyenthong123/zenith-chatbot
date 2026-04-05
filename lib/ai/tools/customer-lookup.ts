import { tool } from "ai";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type Customer, customer } from "@/lib/db/schema";
import { getSupabaseClient } from "@/lib/supabase/server";

export const getCustomerLookup = (userId: string, userRole: string) =>
  tool({
    description:
      "Search for customer information including contact details and address. Use this to identify customers by name or phone number.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("The name or phone number of the customer to search for."),
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
          error: "Failed to search for customers.",
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
  let q = supabase
    .from("customers")
    .select("*")
    .or(
      `name.ilike.%${query}%,phone.ilike.%${query}%,businessName.ilike.%${query}%`,
    )
    .limit(10);

  if (userRole !== "admin") {
    q = q.eq("ownerId", userId);
  }

  const { data: customers } = await q;

  if (!customers || customers.length === 0) {
    return {
      message: `No customers found matching "${query}".`,
    };
  }

  return {
    customers: customers.map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      businessName: c.businessName,
      type: c.type,
      status: c.status,
      ownerEmail: c.ownerEmail,
      createdBy: c.createdBy,
      createdByEmail: c.createdByEmail,
      updatedBy: c.updatedBy,
      updatedByEmail: c.updatedByEmail,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
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
      ilike(customer.name, `%${query}%`),
      ilike(customer.phone, `%${query}%`),
      ilike(customer.businessName, `%${query}%`),
    ),
  ];

  if (userRole !== "admin") {
    conditions.push(eq(customer.ownerId, userId));
  }

  const customers = await db
    .select()
    .from(customer)
    .where(and(...conditions))
    .limit(10);

  if (customers.length === 0) {
    return {
      message: `No customers found matching "${query}".`,
    };
  }

  return {
    customers: customers.map((c: Customer) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      businessName: c.businessName,
      type: c.type,
      status: c.status,
      ownerEmail: c.ownerEmail,
      createdBy: c.createdBy,
      createdByEmail: c.createdByEmail,
      updatedBy: c.updatedBy,
      updatedByEmail: c.updatedByEmail,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
}
