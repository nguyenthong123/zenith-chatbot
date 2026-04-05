import {
  bigint,
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  json,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    password: varchar("password", { length: 255 }),
    name: text("name"),
    displayName: text("displayName"),
    photoUrl: text("photoUrl"),
    role: varchar("role", { length: 50 }).notNull().default("user"),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    isAnonymous: boolean("isAnonymous").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    firestoreId: varchar("firestoreId", { length: 255 }),
    zaloId: varchar("zaloId", { length: 255 }),
  },
  (table) => ({
    emailIndex: uniqueIndex("email_idx").on(table.email),
    firestoreIdIndex: uniqueIndex("firestore_id_idx").on(table.firestoreId),
    zaloIdIndex: uniqueIndex("zalo_id_idx").on(table.zaloId),
  }),
);

export type User = typeof user.$inferSelect;

export const guestUser = pgTable("guest_users", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 255 }),
  name: text("name"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  firestoreId: varchar("firestoreId", { length: 255 }),
});

export type GuestUser = typeof guestUser.$inferSelect;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = typeof chat.$inferSelect;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = typeof message.$inferSelect;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  }),
);

export type Vote = typeof vote.$inferSelect;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    content: text("content"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  }),
);

export type Document = typeof document.$inferSelect;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isCurrent: boolean("isCurrent").notNull().default(true),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = typeof suggestion.$inferSelect;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  }),
);

export type Stream = typeof stream.$inferSelect;

export const userMemory = pgTable("user_memories", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type UserMemory = typeof userMemory.$inferSelect;

export const knowledgeBase = pgTable("knowledge_base", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  content: text("content").notNull(),
  metadata: json("metadata"),
  userId: uuid("userId").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;

export const product = pgTable("products", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  sku: varchar("sku", { length: 255 }),
  category: text("category"),
  priceBuy: bigint("priceBuy", { mode: "number" }),
  priceSell: bigint("priceSell", { mode: "number" }),
  stock: numeric("stock").default("0"),
  unit: varchar("unit", { length: 100 }),
  specification: text("specification"),
  packaging: text("packaging"),
  density: text("density"),
  status: varchar("status", { length: 50 }),
  note: text("note"),
  expiryDate: text("expiryDate"),
  metadata: json("metadata"),
  ownerId: uuid("ownerId").references(() => user.id),
  ownerEmail: text("ownerEmail"),
  createdBy: text("createdBy"),
  createdByEmail: text("createdByEmail"),
  updatedBy: text("updatedBy"),
  updatedByEmail: text("updatedByEmail"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Product = typeof product.$inferSelect;

export const priceList = pgTable("price_lists", {
  id: text("id").primaryKey().notNull(),
  title: text("title").notNull(),
  headers: json("headers"),
  items: json("items"),
  ownerId: uuid("ownerId").references(() => user.id),
  ownerEmail: text("ownerEmail"),
  createdBy: text("createdBy"),
  createdByEmail: text("createdByEmail"),
  updatedBy: text("updatedBy"),
  updatedByEmail: text("updatedByEmail"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type PriceList = typeof priceList.$inferSelect;

export const systemConfig = pgTable("system_config", {
  id: text("id").primaryKey().notNull(),
  accountName: text("accountName"),
  accountNumber: text("accountNumber"),
  bankId: text("bankId"),
  subscriptionLimit: timestamp("subscriptionLimit"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  updatedBy: text("updatedBy"),
});

export type SystemConfig = typeof systemConfig.$inferSelect;

export const zaloConfig = pgTable("zalo_config", {
  id: text("id").primaryKey().notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type ZaloConfig = typeof zaloConfig.$inferSelect;

export const customer = pgTable(
  "customers",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name"),
    businessName: text("businessName"),
    phone: varchar("phone", { length: 50 }),
    address: text("address"),
    type: varchar("type", { length: 100 }),
    status: varchar("status", { length: 50 }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    ownerId: uuid("ownerId").references(() => user.id),
    ownerEmail: text("ownerEmail"),
    createdBy: text("createdBy"),
    createdByEmail: text("createdByEmail"),
    updatedBy: text("updatedBy"),
    updatedByEmail: text("updatedByEmail"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: uniqueIndex("customer_owner_idx").on(table.ownerId, table.id),
    nameIdx: index("customer_name_idx").on(table.name),
  }),
);

export type Customer = typeof customer.$inferSelect;

export const order = pgTable(
  "orders",
  {
    id: text("id").primaryKey().notNull(),
    orderId: varchar("orderId", { length: 100 }),
    customerId: text("customerId"),
    customerName: text("customerName"),
    totalAmount: bigint("totalAmount", { mode: "number" }),
    status: varchar("status", { length: 50 }),
    date: varchar("date", { length: 255 }),
    items: json("items"),
    ownerId: uuid("ownerId").references(() => user.id),
    ownerEmail: text("ownerEmail"),
    createdBy: text("createdBy"),
    createdByEmail: text("createdByEmail"),
    updatedBy: text("updatedBy"),
    updatedByEmail: text("updatedByEmail"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    dateIdx: index("order_date_idx").on(table.date),
    ownerIdx: index("order_owner_idx").on(table.ownerId),
  }),
);

export type Order = typeof order.$inferSelect;

export const cashBook = pgTable(
  "cash_book",
  {
    id: text("id").primaryKey().notNull(),
    amount: bigint("amount", { mode: "number" }),
    type: varchar("type", { length: 50 }),
    category: text("category"),
    date: varchar("date", { length: 255 }),
    bankName: text("bankName"),
    note: text("note"),
    interestRate: numeric("interestRate"),
    loanTerm: text("loanTerm"),
    ownerId: uuid("ownerId").references(() => user.id),
    ownerEmail: text("ownerEmail"),
    createdBy: text("createdBy"),
    createdByEmail: text("createdByEmail"),
    updatedBy: text("updatedBy"),
    updatedByEmail: text("updatedByEmail"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    dateIdx: index("cash_date_idx").on(table.date),
    ownerIdx: index("cash_owner_idx").on(table.ownerId),
  }),
);

export type CashBook = typeof cashBook.$inferSelect;

export const payment = pgTable(
  "payments",
  {
    id: text("id").primaryKey().notNull(),
    amount: bigint("amount", { mode: "number" }),
    customerId: text("customerId"),
    customerName: text("customerName"),
    date: varchar("date", { length: 255 }),
    paymentMethod: varchar("paymentMethod", { length: 100 }),
    proofImage: text("proofImage"),
    note: text("note"),
    ownerId: uuid("ownerId").references(() => user.id),
    ownerEmail: text("ownerEmail"),
    createdBy: text("createdBy"),
    createdByEmail: text("createdByEmail"),
    updatedBy: text("updatedBy"),
    updatedByEmail: text("updatedByEmail"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    dateIdx: index("payment_date_idx").on(table.date),
    ownerIdx: index("payment_owner_idx").on(table.ownerId),
  }),
);

export type Payment = typeof payment.$inferSelect;
