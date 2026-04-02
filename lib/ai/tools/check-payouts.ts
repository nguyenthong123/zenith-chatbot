import { tool } from "ai";
import type { Query } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkPayouts = tool({
  description:
    "Check affiliate payouts and sales data from Firestore for a specific user or affiliate.",
  inputSchema: z.object({
    affiliateName: z
      .string()
      .optional()
      .describe("The name of the affiliate to look up."),
    affiliateEmail: z
      .string()
      .optional()
      .describe("The email of the affiliate to look up."),
  }),
  execute: async ({ affiliateName, affiliateEmail }) => {
    if (!db) {
      return {
        error:
          "Firebase Admin is not initialized. Please check your credentials.",
      };
    }

    try {
      let query: Query = db.collection("affiliate_payouts");

      if (affiliateEmail) {
        query = query.where("affiliateEmail", "==", affiliateEmail);
      } else if (affiliateName) {
        // Simple equality check for name (Firestore doesn't support substring search naturally without extra indexing)
        query = query.where("affiliateName", "==", affiliateName);
      }

      // Sort results after fetching to avoid requiring a composite index immediately
      const snapshot = await query.limit(10).get();

      if (snapshot.empty) {
        return {
          message: "No payout records found for the specified criteria.",
          criteria: { affiliateName, affiliateEmail },
        };
      }

      const results = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => {
          const dateA = new Date((a as any).date || 0).getTime();
          const dateB = new Date((b as any).date || 0).getTime();
          return dateB - dateA;
        });

      return {
        results,
        count: results.length,
      };
    } catch (error) {
      console.error("Firestore Query Error:", error);
      return {
        error: "Failed to query payout data from Firestore.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
