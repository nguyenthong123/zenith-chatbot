import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as admin from "firebase-admin";
import postgres from "postgres";
import {
  cashBook as cashBookTable,
  customer as customerTable,
  guestUser as guestUserTable,
  order as orderTable,
  payment as paymentTable,
  product as productTable,
  systemConfig as systemConfigTable,
  user as userTable,
} from "../lib/db/schema";

dotenv.config();

const client = postgres(process.env.DATABASE_URL ?? "", { prepare: false });
const db = drizzle(client);

// Initialize Firebase
const serviceAccount = require("/Users/zomby/Desktop/dunvex-89461-firebase-adminsdk-fbsvc-0dcb46d9a3.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();
const userMap = new Map<string, string>(); // firestoreId -> supabaseId (uuid)

function isGuest(email?: string): boolean {
  if (!email) return true;
  const e = email.toLowerCase();
  return e.startsWith("guest-") || e.endsWith("@example.com");
}

async function migrateCollection(
  collectionName: string,
  transform: (id: string, data: any) => any,
  table: any,
) {
  console.log(`Migrating ${collectionName}...`);
  const snapshot = await firestore.collection(collectionName).get();
  console.log(`Found ${snapshot.size} documents in ${collectionName}`);

  const batchSize = 100;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const records = chunk.map((doc) => transform(doc.id, doc.data()));

    try {
      if (records.length > 0) {
        await db
          .insert(table)
          .values(records)
          .onConflictDoUpdate({
            target: table.id || table.email || table.firestoreId,
            set: Object.keys(records[0]).reduce((acc: any, key) => {
              // Proper identifier quoting for PG
              acc[key] = sql.raw(`excluded."${key}"`);
              return acc;
            }, {}),
          });
      }
    } catch (err) {
      console.error(`Error migrating chunk of ${collectionName}:`, err);
    }
  }
}

function toTimestamp(val: any) {
  if (!val) return new Date();
  if (val.toDate) return val.toDate();
  if (typeof val === "string") return new Date(val);
  return new Date();
}

async function startMigration() {
  // 1. All Users (Admins + Customers as Users)
  console.log("Migrating all users...");
  const userSnapshot = await firestore.collection("users").get();
  const customerSnapshot = await firestore.collection("customers").get();

  const allUsersMap = new Map<string, any>();
  const guests: any[] = [];

  // From users collection
  for (const doc of userSnapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    let email = data.email || data.ownerEmail || data.createdByEmail || "";

    if (!email) {
      email = `no-email-${id}@dunvex.com`;
    }

    const record = {
      email,
      name: data.displayName || data.name || "",
      displayName: data.displayName || "",
      photoUrl: data.photoURL || "",
      role: data.role || "admin",
      firestoreId: id,
      createdAt: toTimestamp(data.createdAt),
      updatedAt: toTimestamp(data.updatedAt),
    };

    allUsersMap.set(email, record);
    // Also map guest-like users to allUsersMap instead of a separate table if possible
  }

  // From customers collection (sync roles)
  for (const doc of customerSnapshot.docs) {
    const data = doc.data();
    const email = data.email || data.ownerEmail || data.createdByEmail || "";
    if (email) {
      if (!allUsersMap.has(email)) {
        allUsersMap.set(email, {
          email,
          name: data.name || "",
          displayName: data.name || "",
          role: "user",
          firestoreId: doc.id,
          createdAt: toTimestamp(data.createdAt),
          updatedAt: toTimestamp(data.updatedAt),
        });
      }
    }
  }

  const userRecords = Array.from(allUsersMap.values());
  if (userRecords.length > 0) {
    console.log(`Syncing ${userRecords.length} users to users table...`);
    for (let i = 0; i < userRecords.length; i += 100) {
      const chunk = userRecords.slice(i, i + 100);
      const inserted = await db
        .insert(userTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: userTable.email,
          set: {
            name: sql`excluded.name`,
            displayName: sql`excluded."displayName"`,
            role: sql`excluded.role`,
            firestoreId: sql`excluded."firestoreId"`,
            updatedAt: sql`excluded."updatedAt"`,
          },
        })
        .returning({ id: userTable.id, firestoreId: userTable.firestoreId });

      for (const row of inserted) {
        if (row.firestoreId) userMap.set(row.firestoreId, row.id);
      }
    }
  }

  if (guests.length > 0) {
    console.log(`Inserting ${guests.length} guests into guest_users...`);
    await db
      .insert(guestUserTable)
      .values(guests.map((g) => ({ ...g, id: undefined })))
      .onConflictDoNothing();
  }

  // 2. Customers
  console.log("Migrating customers collection...");
  const realCustomers: any[] = [];

  for (const doc of customerSnapshot.docs) {
    const data = doc.data();

    realCustomers.push({
      id: doc.id,
      name: data.name || "",
      businessName: data.businessName || "",
      phone: data.phone || "",
      address: data.address || "",
      type: data.type || "",
      status: data.status || "",
      lat: data.lat || null,
      lng: data.lng || null,
      ownerId: userMap.get(data.ownerId), // Map to UUID
      ownerEmail: data.ownerEmail || "",
      createdByEmail: data.createdByEmail || "",
      createdAt: toTimestamp(data.createdAt),
      updatedAt: toTimestamp(data.updatedAt),
    });
  }

  if (realCustomers.length > 0) {
    console.log(
      `Syncing ${realCustomers.length} customers to customers table...`,
    );
    for (let i = 0; i < realCustomers.length; i += 100) {
      const chunk = realCustomers.slice(i, i + 100);
      await db
        .insert(customerTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: customerTable.id,
          set: {
            name: sql`excluded.name`,
            businessName: sql`excluded."businessName"`,
            phone: sql`excluded.phone`,
            address: sql`excluded.address`,
            status: sql`excluded.status`,
            ownerId: sql`excluded."ownerId"`,
            updatedAt: sql`excluded."updatedAt"`,
          },
        });
    }
  }

  // 3. Products (Re-migration with upsert)
  await migrateCollection(
    "products",
    (id, data) => ({
      id: id,
      name: data.name,
      sku: data.sku,
      category: data.category,
      priceBuy: Number(data.priceBuy) || 0,
      priceSell: Number(data.priceSell) || 0,
      stock: Number(data.stock) || 0,
      unit: data.unit,
      imageUrl: data.imageUrl,
      status: data.status,
      specification: data.specification,
      ownerId: userMap.get(data.ownerId),
      createdAt: toTimestamp(data.createdAt),
      updatedAt: toTimestamp(data.updatedAt),
    }),
    productTable,
  );

  // 4. Orders
  await migrateCollection(
    "orders",
    (id, data) => ({
      id: id,
      orderId: data.orderId,
      customerId: data.customerId,
      customerName: data.customerName,
      totalAmount: Number(data.totalAmount) || 0,
      status: data.status,
      date: data.date,
      items: data.items || [],
      ownerId: userMap.get(data.ownerId),
      createdByEmail: data.createdByEmail,
      createdAt: toTimestamp(data.createdAt),
      updatedAt: toTimestamp(data.updatedAt),
    }),
    orderTable,
  );

  // 5. Cash Book
  await migrateCollection(
    "cash_book",
    (id, data) => ({
      id: id,
      amount: Number(data.amount) || 0,
      type: data.type,
      category: data.category,
      date: data.date,
      bankName: data.bankName,
      note: data.note,
      interestRate: String(data.interestRate || "0"),
      loanTerm: data.loanTerm,
      ownerId: userMap.get(data.ownerId),
      createdByEmail: data.createdByEmail,
      createdAt: toTimestamp(data.createdAt),
    }),
    cashBookTable,
  );

  // 6. Payments
  await migrateCollection(
    "payments",
    (id, data) => ({
      id: id,
      amount: Number(data.amount) || 0,
      customerId: data.customerId,
      customerName: data.customerName,
      date: data.date,
      paymentMethod: data.paymentMethod,
      proofImage: data.proofImage,
      note: data.note,
      ownerId: userMap.get(data.ownerId),
      createdByEmail: data.createdByEmail,
      createdAt: toTimestamp(data.createdAt),
    }),
    paymentTable,
  );

  // 7. System Config
  await migrateCollection(
    "system_config",
    (id, data) => ({
      id: id,
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      bankId: data.bankId,
      updatedAt: toTimestamp(data.updatedAt),
      updatedBy: data.updatedBy,
    }),
    systemConfigTable,
  );

  console.log("Migration finished!");
  process.exit(0);
}

startMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
