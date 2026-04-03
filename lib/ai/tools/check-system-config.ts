import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkSystemConfig = () =>
  tool({
    description:
      "Look up system configuration information like payment/billing accounts for app subscription.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!db) {
        return { error: "Firebase Admin is not initialized." };
      }

      try {
        const configSnapshot = await db
          .collection("system_config")
          .limit(1)
          .get();

        if (configSnapshot.empty) {
          return { message: "No system configuration found." };
        }

        const data = configSnapshot.docs[0].data();
        return { id: configSnapshot.docs[0].id, ...data };
      } catch (error) {
        return {
          error: "Failed to query system configuration.",
          message: String(error),
        };
      }
    },
  });
