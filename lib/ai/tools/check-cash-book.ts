import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkCashBook = ({ session }: { session: Session }) =>
  tool({
    description:
      "Search your cash book for general income and expenditure activities.",
    inputSchema: z.object({
      startDate: z
        .string()
        .optional()
        .describe(
          "Filter cash book entries from this date (inclusive, format: YYYY-MM-DD).",
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          "Filter cash book entries until this date (inclusive, format: YYYY-MM-DD).",
        ),
      type: z
        .enum(["thu", "chi"])
        .optional()
        .describe("Filter by 'thu' (income) or 'chi' (expense)."),
    }),
    execute: async ({ startDate, endDate, type }) => {
      if (!db) {
        return { error: "Firebase Admin is not initialized." };
      }

      const userEmail = session.user?.email;
      if (!userEmail) {
        return { error: "User email not found in session." };
      }

      try {
        let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db
          .collection("cash_book")
          .where("ownerEmail", "==", userEmail);

        if (startDate) {
          query = query.where("date", ">=", startDate);
        }
        if (endDate) {
          query = query.where("date", "<=", endDate);
        }
        if (type) {
          query = query.where("type", "==", type);
        }

        const snapshot = await query.limit(20).get();

        if (snapshot.empty) {
          return { message: "No cash book entries found." };
        }

        const entries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        return {
          entries,
          count: entries.length,
        };
      } catch (error) {
        return { error: "Failed to query cash book.", message: String(error) };
      }
    },
  });
