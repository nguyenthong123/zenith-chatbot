import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkCustomers = ({ session }: { session: Session }) =>
  tool({
    description: "Search or list customers created by you.",
    inputSchema: z.object({
      customerName: z
        .string()
        .optional()
        .describe("A keyword to filter customers."),
      customerEmail: z
        .string()
        .optional()
        .describe("Filter by specific customer email."),
    }),
    execute: async ({ customerName, customerEmail }) => {
      if (!db) {
        return { error: "Firebase Admin is not initialized." };
      }

      const userEmail = session.user?.email;
      if (!userEmail) {
        return { error: "User email not found in session." };
      }

      try {
        let query = db
          .collection("customers")
          .where("ownerEmail", "==", userEmail);

        if (customerEmail) {
          query = query.where("email", "==", customerEmail);
        } else if (customerName) {
          query = query
            .where("name", ">=", customerName)
            .where("name", "<=", `${customerName}\uf8ff`);
        }

        const snapshot = await query.limit(10).get();

        if (snapshot.empty) {
          return { message: "No customers found." };
        }

        return {
          customers: snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })),
          count: snapshot.docs.length,
        };
      } catch (error) {
        return { error: "Failed to query customers.", message: String(error) };
      }
    },
  });
