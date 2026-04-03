import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/firebase/admin";

export const checkTrainingLabs = () =>
  tool({
    description:
      "Look up app usage guides, tutorials, or training documentation.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("A keyword to filter training topics."),
    }),
    execute: async ({ query }) => {
      if (!db) {
        return { error: "Firebase Admin is not initialized." };
      }

      try {
        const collection = db.collection("training_labs");
        let queryRef: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
          collection;

        if (query) {
          // Simple case-insensitive match (approximate for Firestore)
          queryRef = queryRef
            .where("title", ">=", query)
            .where("title", "<=", `${query}\uf8ff`);
        }

        const results = await queryRef.limit(10).get();

        if (results.empty) {
          return { message: "No training guides found for your search." };
        }

        return {
          guides: results.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        };
      } catch (error) {
        return {
          error: "Failed to query training guides.",
          message: String(error),
        };
      }
    },
  });
