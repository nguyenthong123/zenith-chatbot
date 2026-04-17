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
const serviceAccount = require("../config/service-account.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();
const userMap = new Map<string, string>(); // firestoreId -> supabaseId (uuid)

function _isGuest(email?: string): boolean {
  if (!email) return true;
  const e = email.toLowerCase();
  return e.startsWith("guest-") || e.endsWith("@example.com");
}

async function migrateCollection(
  collectionName: string,
  transform: (
    id: string,
    data: Record<string, unknown>,
  ) => Record<string, unknown>,
  table: any,
  onConflictTarget?: any,
) {
  const snapshot = await firestore.collection(collectionName).get();

  const batchSize = 100;
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const records = chunk.map((doc) => transform(doc.id, doc.data()));

    // De-duplicate within the chunk to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueRecords: any[] = [];
    const seen = new Set<string>();

    // We iterate backwards to keep the latest if duplicates exist in the same chunk
    for (let j = records.length - 1; j >= 0; j--) {
      const rec = records[j];
      let key = "";
      if (Array.isArray(onConflictTarget)) {
        key = onConflictTarget
          .map((col) => String(rec[col.name] || ""))
          .join("|");
      } else {
        const targetCol =
          onConflictTarget || table.id || table.email || table.firestoreId;
        key = String(rec[targetCol.name] || "");
      }

      if (!seen.has(key)) {
        seen.add(key);
        uniqueRecords.push(rec);
      }
    }

    try {
      if (uniqueRecords.length > 0) {
        await db
          .insert(table)
          .values(uniqueRecords as any)
          .onConflictDoUpdate({
            target:
              onConflictTarget || table.id || table.email || table.firestoreId,
            set: Object.keys(records[0]).reduce(
              (acc: Record<string, unknown>, key) => {
                // Proper identifier quoting for PG
                acc[key] = sql.raw(`excluded."${key}"`);
                return acc;
              },
              {},
            ),
          });
        console.log(`Migrated ${records.length} records to ${collectionName}`);
      }
    } catch (err) {
      console.error(`Error migrating chunk for ${collectionName}:`, err);
    }
  }
}

function toTimestamp(val: unknown) {
  if (!val) return new Date();
  if (typeof val === "object" && val !== null && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === "string") return new Date(val);
  return new Date();
}

async function startMigration() {
  const userSnapshot = await firestore.collection("users").get();
  const customerSnapshot = await firestore.collection("customers").get();

  const allUsersMap = new Map<string, Record<string, unknown>>();
  const guests: Record<string, unknown>[] = [];

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
    for (let i = 0; i < userRecords.length; i += 100) {
      const chunk = userRecords.slice(i, i + 100);
      const inserted = await db
        .insert(userTable)
        .values(chunk as any)
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
    await db
      .insert(guestUserTable)
      .values(guests.map((g) => ({ ...g, id: undefined })))
      .onConflictDoNothing();
  }
  const realCustomers: Record<string, unknown>[] = [];

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
      infoMarkdown: `**Khách hàng:** ${data.name || data.businessName || "Không tên"}\n**SĐT:** ${data.phone || "Không có"}\n**Địa chỉ:** ${data.address || "Không rõ"}\n**Loại:** ${data.type || "Chưa phân loại"}\n**Trạng thái:** ${data.status || ""}`,
    });
  }

  if (realCustomers.length > 0) {
    for (let i = 0; i < realCustomers.length; i += 100) {
      const chunk = realCustomers.slice(i, i + 100);
      await db
        .insert(customerTable)
        .values(chunk as any)
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
            infoMarkdown: sql`excluded."infoMarkdown"`,
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
      ownerId: userMap.get(data.ownerId as string),
      createdAt: toTimestamp(data.createdAt),
      updatedAt: toTimestamp(data.updatedAt),
      infoMarkdown: `**Sản phẩm:** ${data.name || ""}\n**Mã SKU:** ${data.sku || ""}\n**Phân loại:** ${data.category || ""}\n**Giá nhập:** ${data.priceBuy || 0}\n**Giá bán:** ${data.priceSell || 0}\n**Tồn kho:** ${data.stock || 0} ${data.unit || ""}\n**Mô tả:** ${data.specification || ""}\n**Trạng thái:** ${data.status || ""}`,
    }),
    productTable,
    [productTable.name, productTable.ownerId],
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
      ownerId: userMap.get(data.ownerId as string),
      createdByEmail: data.createdByEmail,
      createdAt: toTimestamp(data.createdAt),
      updatedAt: toTimestamp(data.updatedAt),
      infoMarkdown: `**Đơn hàng:** ${data.orderId || ""}\n**Khách hàng:** ${data.customerName || data.customerId || ""}\n**Tổng tiền:** ${data.totalAmount || 0}\n**Ngày:** ${data.date || ""}\n**Trạng thái:** ${data.status || ""}\n**Sản phẩm:** ${(Array.isArray(data.items) ? data.items : []).map((i: any) => i.name || "").join(", ")}`,
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
      ownerId: userMap.get(data.ownerId as string),
      createdByEmail: data.createdByEmail,
      createdAt: toTimestamp(data.createdAt),
      infoMarkdown: `**Giao dịch Sổ quỹ:** ${data.type || ""} ${data.amount || 0}\n**Hạng mục:** ${data.category || ""}\n**Ngày:** ${data.date || ""}\n**Ngân hàng:** ${data.bankName || ""}\n**Ghi chú:** ${data.note || ""}`,
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
      ownerId: userMap.get(data.ownerId as string),
      createdByEmail: data.createdByEmail,
      createdAt: toTimestamp(data.createdAt),
      infoMarkdown: `**Thanh toán:** ${data.amount || 0}\n**Khách hàng:** ${data.customerName || data.customerId || ""}\n**Ngày:** ${data.date || ""}\n**Phương thức:** ${data.paymentMethod || ""}\n**Ghi chú:** ${data.note || ""}`,
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
      infoMarkdown: `**Cấu hình hệ thống:** Tên TK: ${data.accountName || ""} - Số TK: ${data.accountNumber || ""} - Ngân hàng: ${data.bankId || ""}`,
    }),
    systemConfigTable,
  );
  process.exit(0);
}

startMigration().catch((_err) => {
  process.exit(1);
});
