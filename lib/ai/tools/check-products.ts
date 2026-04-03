import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkProducts = ({ session }: { session: Session }) =>
  tool({
    description:
      "Search your created products and their current availability or price.",
    inputSchema: z.object({
      productName: z
        .string()
        .optional()
        .describe("A keyword to filter products."),
    }),
    execute: async ({ productName }) => {
      if (!db) {
        return { error: "Firebase Admin is not initialized." };
      }

      const userEmail = session.user?.email;
      if (!userEmail) {
        return { error: "User email not found in session." };
      }

      try {
        let query = db
          .collection("products")
          .where("ownerEmail", "==", userEmail);

        if (productName) {
          // Basic prefix match for products
          query = query
            .where("name", ">=", productName)
            .where("name", "<=", `${productName}\uf8ff`);
        }

        const snapshot = await query.limit(10).get();

        if (snapshot.empty) {
          return { message: "No products found." };
        }

        return {
          products: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          count: snapshot.docs.length,
        };
      } catch (error) {
        return { error: "Failed to query products.", message: String(error) };
      }
    },
  });
