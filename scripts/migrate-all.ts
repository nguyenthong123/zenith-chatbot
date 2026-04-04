import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as admin from "firebase-admin";
import postgres from "postgres";
import {
  cashBook as cashBookTable,
  customer as customerTable,
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
        await db.insert(table).values(records).onConflictDoUpdate({
          target: table.id,
          set: records[0], // Generic update for simplicity in script, though mapping would be better
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
  // 1. Users
  await migrateCollection(
    "users",
    (id, data) => ({
      email: data.email || "",
      name: data.displayName || data.name || "",
      displayName: data.displayName || "",
      photoUrl: data.photoURL || "",
      role: data.role || "user",
      firestoreId: id,
      createdAt: toTimestamp(data.createdAt),
      updatedAt: toTimestamp(data.updatedAt),
    }),
    userTable,
  );

  // 2. Customers
  await migrateCollection(
    "customers",
    (id, data) => ({
      id: id,
      name: data.name,
      businessName: data.businessName,
      phone: data.phone,
      address: data.address,
      type: data.type,
      status: data.status,
      lat: data.lat || null,
      lng: data.lng || null,
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail,
      createdByEmail: data.createdByEmail,
      createdAt: toTimestamp(data.createdAt),
      updatedAt: toTimestamp(data.updatedAt),
    }),
    customerTable,
  );

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
      ownerId: data.ownerId,
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
      ownerId: data.ownerId,
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
      ownerId: data.ownerId,
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
      ownerId: data.ownerId,
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
