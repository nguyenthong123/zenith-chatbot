import * as fs from "node:fs";
import * as path from "node:path";
import { tool } from "ai";
import * as admin from "firebase-admin";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase/server";

// Helper to get Firestore instance lazily
function getFirestore() {
  if (!admin.apps.length) {
    let serviceAccount: admin.ServiceAccount | undefined;
    const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (envServiceAccount) {
      try {
        serviceAccount = JSON.parse(envServiceAccount);
      } catch (err) {
        console.error(
          "Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:",
          err,
        );
      }
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

function toISOString(val: unknown): string | null {
  const d = toTimestamp(val);
  return d ? d.toISOString() : null;
}

// Table name mapping from collection name to Supabase table name
const COLLECTION_TABLE_MAP: Record<string, string> = {
  users: "users",
  customers: "customers",
  products: "products",
  price_lists: "price_lists",
  orders: "orders",
  payments: "payments",
  cash_book: "cash_book",
  system_config: "system_config",
};

export const syncFirestoreToSupabase = tool({
  description:
    "Sync data from Firestore to the Supabase database. Performs incremental sync - only new or updated records are synced. Use this when the user asks to 'migrate' or 'sync' data.",
  inputSchema: z.object({
    collections: z
      .array(z.string())
      .optional()
      .describe(
        "Optionally specify collections to sync (e.g. ['customers', 'orders']). Defaults to all.",
      ),
    fullSync: z
      .boolean()
      .optional()
      .describe(
        "Force a full sync of all records, ignoring timestamps. Default is false (incremental sync).",
      ),
  }),
  execute: async ({ collections, fullSync = false }) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return {
          success: false,
          error:
            "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
        };
      }

      const results: Record<
        string,
        { total: number; synced: number; skipped: number }
      > = {};
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

      // Build user mapping (firestoreId -> supabase UUID) from existing users
      const userMappings = new Map<string, string>();
      const { data: existingUsers } = (await supabase
        .from("users")
        .select("id, firestoreId")) as {
        data: Array<{ id: string; firestoreId: string | null }> | null;
      };
      if (existingUsers) {
        for (const u of existingUsers) {
          if (u.firestoreId) userMappings.set(u.firestoreId, u.id);
        }
      }

      const getOwnerUuid = (firestoreId: string | undefined) => {
        if (!firestoreId) return null;
        return userMappings.get(firestoreId) || null;
      };

      for (const col of targetCollections) {
        const tableName = COLLECTION_TABLE_MAP[col];
        if (!tableName) {
          results[col] = { total: 0, synced: 0, skipped: 0 };
          continue;
        }

        const firestore = getFirestore();

        // --- Incremental sync: get existing record IDs and their updatedAt ---
        const existingMap = new Map<string, string | null>();
        if (!fullSync) {
          const { data: existing } = (await supabase
            .from(tableName)
            .select("id, updatedAt")) as {
            data: Array<{ id: string; updatedAt: string | null }> | null;
          };
          if (existing) {
            for (const row of existing) {
              existingMap.set(row.id, row.updatedAt || null);
            }
          }
        }

        const snapshot = await firestore.collection(col).get();
        const docs = snapshot.docs;
        let synced = 0;
        let skipped = 0;

        for (const doc of docs) {
          const data = doc.data();
          const id = doc.id;

          try {
            // --- Incremental check: skip if record exists and hasn't been updated ---
            if (!fullSync && existingMap.has(id)) {
              const firestoreUpdatedAt = toTimestamp(
                data.updatedAt || data.createdAt,
              );
              const dbUpdatedAt = existingMap.get(id);

              if (firestoreUpdatedAt && dbUpdatedAt) {
                const firestoreTime = firestoreUpdatedAt.getTime();
                const dbTime = new Date(dbUpdatedAt).getTime();
                // Skip if Firestore record hasn't been updated since last sync
                if (firestoreTime <= dbTime) {
                  skipped++;
                  continue;
                }
              }
            }

            const record = buildRecord(col, id, data, getOwnerUuid);
            if (!record) {
              skipped++;
              continue;
            }

            const { error } = await (supabase.from(tableName) as any).upsert(
              record,
              { onConflict: "id" },
            );

            if (error) {
              console.error(
                `[Sync] Failed to upsert ${id} in ${col}:`,
                error.message,
              );
            } else {
              synced++;
            }

            // For users, refresh the mapping after upsert
            if (col === "users" && !error) {
              const { data: upserted } = (await supabase
                .from("users")
                .select("id, firestoreId")
                .eq("firestoreId", id)
                .limit(1)
                .single()) as {
                data: { id: string; firestoreId: string } | null;
              };
              if (upserted) {
                userMappings.set(id, upserted.id);
              }
            }
          } catch (err) {
            console.error(
              `[Sync] Failed to sync record ${id} in ${col}:`,
              err,
            );
          }
        }
        results[col] = { total: docs.length, synced, skipped };
      }

      return {
        success: true,
        mode: fullSync ? "full" : "incremental",
        summary: results,
        message: fullSync
          ? "Full sync completed successfully."
          : "Incremental sync completed. Only new/updated records were synced.",
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

function buildRecord(
  col: string,
  id: string,
  data: FirebaseFirestore.DocumentData,
  getOwnerUuid: (firestoreId: string | undefined) => string | null,
): Record<string, unknown> | null {
  if (col === "users") {
    const email =
      data.email ||
      (data.isAnonymous ? null : `guest-${id}@example.com`) ||
      `user-${id}@example.com`;
    return {
      email: email,
      name: data.displayName || data.name || "",
      displayName: data.displayName || "",
      photoUrl: data.photoURL || "",
      role: data.role || "user",
      firestoreId: id,
      zaloId: data.zaloId ? String(data.zaloId) : null,
      createdAt: toISOString(data.createdAt) || new Date().toISOString(),
      updatedAt: toISOString(data.updatedAt) || new Date().toISOString(),
    };
  }

  if (col === "customers") {
    return {
      id,
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
      createdAt: toISOString(data.createdAt) || new Date().toISOString(),
      updatedAt: toISOString(data.updatedAt) || new Date().toISOString(),
    };
  }

  if (col === "products") {
    return {
      id,
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
      createdAt: toISOString(data.createdAt) || new Date().toISOString(),
      updatedAt: toISOString(data.updatedAt) || new Date().toISOString(),
    };
  }

  if (col === "price_lists") {
    return {
      id,
      title: data.title,
      headers: data.headers || [],
      items: data.items || [],
      ownerId: getOwnerUuid(data.ownerId),
      ownerEmail: data.ownerEmail,
      createdBy: data.createdBy,
      createdByEmail: data.createdByEmail,
      updatedBy: data.updatedBy,
      updatedByEmail: data.updatedByEmail,
      createdAt: toISOString(data.createdAt) || new Date().toISOString(),
      updatedAt: toISOString(data.updatedAt) || new Date().toISOString(),
    };
  }

  if (col === "orders") {
    return {
      id,
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
      createdAt: toISOString(data.createdAt) || new Date().toISOString(),
      updatedAt: toISOString(data.updatedAt) || new Date().toISOString(),
    };
  }

  if (col === "payments") {
    return {
      id,
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
      createdAt: toISOString(data.createdAt) || new Date().toISOString(),
    };
  }

  if (col === "cash_book") {
    return {
      id,
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
      createdAt: toISOString(data.createdAt) || new Date().toISOString(),
    };
  }

  if (col === "system_config") {
    return {
      id,
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      bankId: data.bankId,
      subscriptionLimit: data.subscriptionLimit
        ? new Date(data.subscriptionLimit).toISOString()
        : null,
      updatedBy: data.updatedBy,
      updatedAt: toISOString(data.updatedAt) || new Date().toISOString(),
    };
  }

  return null;
}
