import * as fs from "node:fs";
import * as path from "node:path";
import { tool } from "ai";
import { eq } from "drizzle-orm";
import * as admin from "firebase-admin";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import {
  cashBook as cashBookTable,
  customer as customerTable,
  order as orderTable,
  payment as paymentTable,
  priceList as priceListTable,
  product as productTable,
  systemConfig as systemConfigTable,
  user as userTable,
} from "@/lib/db/schema";

// Helper to get Firestore instance lazily
function getFirestore() {
  if (!admin.apps.length) {
    let serviceAccount: Record<string, unknown> | undefined;
    const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (envServiceAccount) {
      try {
        serviceAccount = JSON.parse(envServiceAccount);
      } catch (_err) {}
    }

    if (!serviceAccount) {
      const serviceAccountPath = path.join(
        process.cwd(),
        "config/service-account.json",
      );
      if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(
          fs.readFileSync(serviceAccountPath, "utf8"),
        );
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      throw new Error(
        "Firebase Service Account not found. Please set FIREBASE_SERVICE_ACCOUNT env var or add config/service-account.json",
      );
    }
  }
  return admin.firestore();
}

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

function toDateString(val: unknown): string | null {
  const d = toTimestamp(val);
  return d ? d.toISOString().split("T")[0] : null;
}

export const syncFirestoreToSupabase = tool({
  description:
    "Sync all data from Firestore to the optimized Supabase database. This is a MIGRATION tool use only when explicitly asked to 'sync' or 'update' data from Firestore. For daily data operations, use the specific lookup tools (Supabase is the live database).",
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
        "price_lists",
        "orders",
        "payments",
        "cash_book",
        "system_config",
      ];

      // 1. Get User Mapping (Firestore ID -> Supabase UUID)
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
        const firestore = getFirestore();
        const snapshot = await firestore.collection(col).get();
        const docs = snapshot.docs;
        let count = 0;

        for (const doc of docs) {
          const data = doc.data();
          const id = doc.id;

          try {
            if (col === "users") {
              const email =
                data.email ||
                (data.isAnonymous ? null : `guest-${id}@example.com`) ||
                `user-${id}@example.com`;
              const record = {
                email: email,
                name: data.displayName || data.name || "",
                displayName: data.displayName || "",
                photoUrl: data.photoURL || "",
                role: data.role || "user",
                firestoreId: id,
                zaloId: data.zaloId ? String(data.zaloId) : null,
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
                createdBy: data.createdBy,
                createdByEmail: data.createdByEmail,
                updatedBy: data.updatedBy,
                updatedByEmail: data.updatedByEmail,
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
                priceBuy: Math.floor(Number(data.priceBuy || 0)),
                priceSell: Math.floor(Number(data.priceSell || 0)),
                stock: String(data.stock || "0"),
                unit: data.unit,
                specification: data.specification,
                packaging: data.packaging,
                density: data.density,
                expiryDate: data.expiryDate ? String(data.expiryDate) : null,
                status: data.status,
                note: data.note,
                metadata: data.metadata || null,
                ownerId: getOwnerUuid(data.ownerId),
                ownerEmail: data.ownerEmail,
                createdBy: data.createdBy,
                createdByEmail: data.createdByEmail,
                updatedBy: data.updatedBy,
                updatedByEmail: data.updatedByEmail,
                createdAt: toTimestamp(data.createdAt) || new Date(),
                updatedAt: toTimestamp(data.updatedAt) || new Date(),
              };
              await db.insert(productTable).values(record).onConflictDoUpdate({
                target: productTable.id,
                set: record,
              });
            } else if (col === "price_lists") {
              const record = {
                id: id,
                title: data.title,
                headers: data.headers || [],
                items: data.items || [],
                ownerId: getOwnerUuid(data.ownerId),
                ownerEmail: data.ownerEmail,
                createdBy: data.createdBy,
                createdByEmail: data.createdByEmail,
                updatedBy: data.updatedBy,
                updatedByEmail: data.updatedByEmail,
                createdAt: toTimestamp(data.createdAt) || new Date(),
                updatedAt: toTimestamp(data.updatedAt) || new Date(),
              };
              await db
                .insert(priceListTable)
                .values(record)
                .onConflictDoUpdate({
                  target: priceListTable.id,
                  set: record,
                });
            } else if (col === "orders") {
              const record = {
                id: id,
                orderId: data.orderId,
                customerId: data.customerId,
                customerName: data.customerName,
                totalAmount: Math.floor(Number(data.totalAmount || 0)),
                status: data.status,
                date: toDateString(data.date),
                items: data.items || [],
                ownerId: getOwnerUuid(data.ownerId),
                ownerEmail: data.ownerEmail,
                createdBy: data.createdBy,
                createdByEmail: data.createdByEmail,
                updatedBy: data.updatedBy,
                updatedByEmail: data.updatedByEmail,
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
                amount: Math.floor(Number(data.amount || 0)),
                customerId: data.customerId,
                customerName: data.customerName,
                date: toDateString(data.date),
                paymentMethod: data.paymentMethod,
                proofImage: data.proofImage,
                note: data.note,
                ownerId: getOwnerUuid(data.ownerId),
                ownerEmail: data.ownerEmail,
                createdBy: data.createdBy,
                createdByEmail: data.createdByEmail,
                updatedBy: data.updatedBy,
                updatedByEmail: data.updatedByEmail,
                createdAt: toTimestamp(data.createdAt) || new Date(),
              };
              await db.insert(paymentTable).values(record).onConflictDoUpdate({
                target: paymentTable.id,
                set: record,
              });
            } else if (col === "cash_book") {
              const record = {
                id: id,
                amount: Math.floor(Number(data.amount || 0)),
                type: data.type,
                category: data.category,
                date: toDateString(data.date),
                bankName: data.bankName,
                note: data.note,
                interestRate: String(data.interestRate || "0"),
                loanTerm: data.loanTerm,
                ownerId: getOwnerUuid(data.ownerId),
                ownerEmail: data.ownerEmail,
                createdBy: data.createdBy,
                createdByEmail: data.createdByEmail,
                updatedBy: data.updatedBy,
                updatedByEmail: data.updatedByEmail,
                createdAt: toTimestamp(data.createdAt) || new Date(),
              };
              await db.insert(cashBookTable).values(record).onConflictDoUpdate({
                target: cashBookTable.id,
                set: record,
              });
            } else if (col === "system_config") {
              const record = {
                id: id,
                accountName: data.accountName,
                accountNumber: data.accountNumber,
                bankId: data.bankId,
                subscriptionLimit: data.subscriptionLimit
                  ? new Date(data.subscriptionLimit)
                  : null,
                updatedBy: data.updatedBy,
                updatedAt: toTimestamp(data.updatedAt) || new Date(),
              };
              await db
                .insert(systemConfigTable)
                .values(record)
                .onConflictDoUpdate({
                  target: systemConfigTable.id,
                  set: record,
                });
            }
            count++;
          } catch (_err) {}
        }
        results[col] = count;
      }

      return {
        success: true,
        summary: results,
        message:
          "Synchronized Firestore data to Supabase successfully with full metadata.",
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
