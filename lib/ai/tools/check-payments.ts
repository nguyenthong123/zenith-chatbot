import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkPayments = ({ session }: { session: Session }) =>
  tool({
    description:
      "Check liabilities and payment status for orders created by you.",
    inputSchema: z.object({
      startDate: z
        .string()
        .optional()
        .describe(
          "Filter payments from this date (inclusive, format: YYYY-MM-DD).",
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          "Filter payments until this date (inclusive, format: YYYY-MM-DD).",
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
          .collection("payments")
          .where("ownerEmail", "==", userEmail);

        if (startDate) {
          query = query.where("date", ">=", startDate);
        }
        if (endDate) {
          query = query.where("date", "<=", endDate);
        }

        const snapshot = await query.limit(20).get();

        if (snapshot.empty) {
          return { message: "No payments found for the specified criteria." };
        }

        const payments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        let filteredPayments = payments;

        if (customerName) {
          const lowerName = customerName.toLowerCase();
          filteredPayments = payments.filter((p) => {
            const payment = p as { customerName?: string };
            return payment.customerName?.toLowerCase().includes(lowerName);
          });
        }

        return {
          payments: filteredPayments,
          count: filteredPayments.length,
        };
      } catch (error) {
        return { error: "Failed to query payments.", message: String(error) };
      }
    },
  });
