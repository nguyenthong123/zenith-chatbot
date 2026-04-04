import { tool } from "ai";
import { eq } from "drizzle-orm";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import {
  cashBook as cashBookTable,
  customer as customerTable,
  order as orderTable,
  payment as paymentTable,
  product as productTable,
  user as userTable,
} from "@/lib/db/schema";

// Initialize Firebase Admin (Singleton-ish)
if (!admin.apps.length) {
  const serviceAccountPath = path.join(
    process.cwd(),
    "config/service-account.json",
  );
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8"),
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

interface FirestoreTimestamp {
  toDate: () => Date;
}

function toTimestamp(val: unknown): Date | null {
  if (!val) return null;
  if ((val as FirestoreTimestamp).toDate)
    return (val as FirestoreTimestamp).toDate();
  if (typeof val === "string") return new Date(val);
  return new Date();
}

export const syncFirestoreToSupabase = tool({
  description:
    "Sync all data from Firestore to the optimized Supabase database. This includes customers, orders, payments, products and cash book entries. Use this when the user asks to 'migrate' or 'sync' data.",
  inputSchema: z.object({
    collections: z
      .array(z.string())
      .optional()
      .describe(
        "Optionally specify collections to sync (e.g. ['customers', 'orders']). Defaults to all.",
      ),
  }),
  execute: async ({ collections }) => {
    try {
      const results: Record<string, number> = {};
      const targetCollections = collections || [
        "users",
        "customers",
        "products",
        "orders",
        "payments",
        "cash_book",
      ];

      // 1. Get User Mapping (Firestore ID -> Supabase UUID)
      // We need this for the ownerId foreign key
      const userMappings = new Map<string, string>();
      const existingUsers = await db.select().from(userTable);
      existingUsers.forEach((u) => {
        if (u.firestoreId) userMappings.set(u.firestoreId, u.id);
      });

      // Helper to get owner UUID
      const getOwnerUuid = (firestoreId: string | undefined) => {
        if (!firestoreId) return null;
        return userMappings.get(firestoreId) || null;
      };

      for (const col of targetCollections) {
        console.log(`[Migration] Syncing collection: ${col}...`);
        const snapshot = await firestore.collection(col).get();
        const docs = snapshot.docs;
        let count = 0;

        for (const doc of docs) {
          const data = doc.data();
          const id = doc.id;

          try {
            if (col === "users") {
              const record = {
                email: data.email || "",
                name: data.displayName || data.name || "",
                displayName: data.displayName || "",
                photoUrl: data.photoURL || "",
                role: data.role || "user",
                firestoreId: id,
                createdAt: toTimestamp(data.createdAt) || new Date(),
                updatedAt: toTimestamp(data.updatedAt) || new Date(),
              };
              await db.insert(userTable).values(record).onConflictDoUpdate({
                target: userTable.email,
                set: record,
              });
              // Refresh mapping
              const [u] = await db
                .select()
                .from(userTable)
                .where(eq(userTable.email, record.email));
              if (u) userMappings.set(id, u.id);
            } else if (col === "customers") {
              const record = {
                id: id,
                name: data.name,
                businessName: data.businessName,
                phone: data.phone,
                address: data.address,
                type: data.type,
                status: data.status,
                lat: data.lat || null,
                lng: data.lng || null,
                ownerId: getOwnerUuid(data.ownerId),
                ownerEmail: data.ownerEmail,
                createdByEmail: data.createdByEmail,
                createdAt: toTimestamp(data.createdAt) || new Date(),
                updatedAt: toTimestamp(data.updatedAt) || new Date(),
              };
              await db.insert(customerTable).values(record).onConflictDoUpdate({
                target: customerTable.id,
                set: record,
              });
            } else if (col === "products") {
              const record = {
                id: id,
                name: data.name,
                sku: data.sku,
                category: data.category,
                priceBuy: Number(data.priceBuy) || 0,
                priceSell: Number(data.priceSell) || 0,
                stock: String(data.stock || "0"),
                unit: data.unit,
                specification: data.specification,
                status: data.status,
                createdAt: toTimestamp(data.createdAt) || new Date(),
                updatedAt: toTimestamp(data.updatedAt) || new Date(),
              };
              // Note: products uses UUID id, but for migration from Firestore we keep the ID as is if it's a UUID
              // If not, we might need to handle differently. For now assuming Firestore ID mapping works or we use onConflict
              await db.insert(productTable).values(record).onConflictDoUpdate({
                target: productTable.id,
                set: record,
              });
            } else if (col === "orders") {
              const record = {
                id: id,
                orderId: data.orderId,
                customerId: data.customerId,
                customerName: data.customerName,
                totalAmount: Number(data.totalAmount) || 0,
                status: data.status,
                date: toTimestamp(data.date),
                items: data.items || [],
                ownerId: getOwnerUuid(data.ownerId),
                createdByEmail: data.createdByEmail,
                createdAt: toTimestamp(data.createdAt) || new Date(),
                updatedAt: toTimestamp(data.updatedAt) || new Date(),
              };
              await db.insert(orderTable).values(record).onConflictDoUpdate({
                target: orderTable.id,
                set: record,
              });
            } else if (col === "payments") {
              const record = {
                id: id,
                amount: Number(data.amount) || 0,
                customerId: data.customerId,
                customerName: data.customerName,
                date: toTimestamp(data.date),
                paymentMethod: data.paymentMethod,
                proofImage: data.proofImage,
                note: data.note,
                ownerId: getOwnerUuid(data.ownerId),
                createdByEmail: data.createdByEmail,
                createdAt: toTimestamp(data.createdAt) || new Date(),
              };
              await db.insert(paymentTable).values(record).onConflictDoUpdate({
                target: paymentTable.id,
                set: record,
              });
            } else if (col === "cash_book") {
              const record = {
                id: id,
                amount: Number(data.amount) || 0,
                type: data.type,
                category: data.category,
                date: toTimestamp(data.date),
                bankName: data.bankName,
                note: data.note,
                interestRate: String(data.interestRate || "0"),
                loanTerm: data.loanTerm,
                ownerId: getOwnerUuid(data.ownerId),
                createdByEmail: data.createdByEmail,
                createdAt: toTimestamp(data.createdAt) || new Date(),
              };
              await db.insert(cashBookTable).values(record).onConflictDoUpdate({
                target: cashBookTable.id,
                set: record,
              });
            }
            count++;
          } catch (err) {
            // Error handling for individual records
          }
        }
        results[col] = count;
      }

      return {
        success: true,
        summary: results,
        message: "Synchronized Firestore data to Supabase successfully.",
      };
    } catch (error) {
      return {
        success: false,
        error: "Failed to synchronize data.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
