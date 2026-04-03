import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkOrders = ({ session }: { session: Session }) =>
  tool({
    description:
      "Search orders created by you. Supports filtering by date range and owner context.",
    inputSchema: z.object({
      startDate: z
        .string()
        .optional()
        .describe(
          "Filter orders from this date (inclusive, format: YYYY-MM-DD).",
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          "Filter orders until this date (inclusive, format: YYYY-MM-DD).",
        ),
      customerName: z.string().optional().describe("Filter by customer name."),
    }),
    execute: async ({ startDate, endDate, customerName }) => {
      if (!db) {
        return { error: "Firebase Admin is not initialized." };
      }

      const userEmail = session.user?.email;
      if (!userEmail) {
        return { error: "User email not found in session." };
      }

      try {
        let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db
          .collection("orders")
          .where("ownerEmail", "==", userEmail);

        if (startDate) {
          query = query.where("orderDate", ">=", startDate);
        }
        if (endDate) {
          query = query.where("orderDate", "<=", endDate);
        }

        const snapshot = await query.limit(20).get();

        if (snapshot.empty) {
          return { message: "No orders found for the specified criteria." };
        }

        const orders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        let filteredOrders = orders;

        if (customerName) {
          const lowerName = customerName.toLowerCase();
          filteredOrders = orders.filter((o) => {
            const order = o as { customerName?: string };
            return order.customerName?.toLowerCase().includes(lowerName);
          });
        }

        return {
          orders: filteredOrders,
          count: filteredOrders.length,
        };
      } catch (error) {
        return { error: "Failed to query orders.", message: String(error) };
      }
    },
  });
