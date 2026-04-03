import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkUsers = ({ session }: { session: Session }) =>
  tool({
    description:
      "Check your own account information, login email, and subscription status.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!db) {
        return { error: "Firebase Admin is not initialized." };
      }

      const userEmail = session.user?.email;
      if (!userEmail) {
        return { error: "User email not found in session." };
      }

      try {
        const snapshot = await db
          .collection("users")
          .where("email", "==", userEmail)
          .limit(1)
          .get();

        if (snapshot.empty) {
          return {
            message: "No user account found for your email.",
            email: userEmail,
          };
        }

        const userData = snapshot.docs[0].data();
        return {
          id: snapshot.docs[0].id,
          ...userData,
        };
      } catch (error) {
        return { error: "Failed to query user data.", message: String(error) };
      }
    },
  });
