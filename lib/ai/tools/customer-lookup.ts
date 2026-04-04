import { tool } from "ai";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type Customer, customer } from "@/lib/db/schema";

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
        const conditions = [
          or(
            ilike(customer.name, `%${query}%`),
            ilike(customer.phone, `%${query}%`),
            ilike(customer.businessName, `%${query}%`),
          ),
        ];

        // Role-based data isolation
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
      } catch (error) {
        console.error("Customer lookup failed:", error);
        return {
          error: "Failed to search for customers.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
