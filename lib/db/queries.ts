// import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { ChatbotError } from "../errors";
import { generateStableUUID, generateUUID, isValidUUID } from "../utils";
import {
  cashBook,
  chat,
  customer,
  type DBMessage,
  document,
  knowledgeBase,
  message,
  order,
  payment,
  product,
  type Suggestion,
  stream,
  suggestion,
  systemConfig,
  type User,
  user,
  userMemory,
  vote,
  zaloConfig,
} from "./schema";
import { generateHashedPassword } from "./utils";

const globalForPostgres = globalThis as unknown as {
  postgres: ReturnType<typeof postgres> | undefined;
};

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error("CRITICAL: No database URL found in environment!");
} else {
  console.log(
    "Database Initializing with URL (masked):",
    dbUrl.replace(/:[^:@]+@/, ":***@"),
  );
}
const client =
  globalForPostgres.postgres ??
  postgres(dbUrl ?? "", { prepare: false, ssl: "require" });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.postgres = client;
}

export const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    return [];
  }
}

export async function getUserById(id: string): Promise<User[]> {
  const userUUID = isValidUUID(id) ? id : generateStableUUID(id);
  try {
    return await db.select().from(user).where(eq(user.id, userUUID));
  } catch (_error) {
    return [];
  }
}

export async function getUserByEmail(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    return [];
  }
}

export async function createUser(email: string, password: string, id?: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db
      .insert(user)
      .values({ id, email, password: hashedPassword });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser(id?: string) {
  const userUUID = id
    ? isValidUUID(id)
      ? id
      : generateStableUUID(id)
    : generateUUID();
  const email = `guest-${userUUID}@example.com`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db
      .insert(user)
      .values({
        id: userUUID,
        email,
        password,
        isAnonymous: true,
      })
      .returning({
        id: user.id,
        email: user.email,
      });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create guest user",
    );
  }
}

export async function getOrCreateUser({
  id,
  email,
  name,
}: {
  id: string;
  email?: string;
  name?: string;
}) {
  const userUUID = isValidUUID(id) ? id : generateStableUUID(id);

  try {
    // 1. Try by UUID
    const [existingById] = await db
      .select()
      .from(user)
      .where(eq(user.id, userUUID));
    if (existingById) return existingById;

    // 2. Try by Email if available
    if (email) {
      const [existingByEmail] = await db
        .select()
        .from(user)
        .where(eq(user.email, email));
      if (existingByEmail) return existingByEmail;
    }

    // 3. Create new
    const password = generateHashedPassword(generateUUID());
    const [newUser] = await db
      .insert(user)
      .values({
        id: userUUID,
        email: email || `user-${userUUID}@example.com`,
        name: name || null,
        password,
      })
      .returning();

    return newUser;
  } catch (error: any) {
    console.error("Database Error in getOrCreateUser:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      query: error.query,
      params: error.params,
    });
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to sync user",
    );
  }
}

export async function updateUserPassword(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db
      .update(user)
      .set({ password: hashedPassword })
      .where(eq(user.email, email));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update password");
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  const chatUUID = isValidUUID(id) ? id : generateStableUUID(id);
  const userUUID = isValidUUID(userId) ? userId : generateStableUUID(userId);

  try {
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userUUID));
    if (!existingUser) {
      console.warn(
        `[DB Warning: saveChat]: User ${userUUID} not found. Creating a guest entry if needed.`,
      );
      // Optional: Auto-create guest user if missing?
      // For now, let's just proceed and let the DB fail if not found,
      // but we add a clearer error message.
    }

    return await db
      .insert(chat)
      .values({
        id: chatUUID,
        createdAt: new Date(),
        userId: userUUID,
        title,
        visibility,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("[DB Error: saveChat]:", error);
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to save chat",
    );
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:api",
      error instanceof Error
        ? `${error.message}\n${error.stack}`
        : String(error),
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id",
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
}) {
  const userUUID = isValidUUID(id) ? id : generateStableUUID(id);
  try {
    const extendedLimit = limit + 1;

    // Base filters
    const filters: SQL[] = [eq(chat.userId, userUUID)];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (selectedChat) {
        filters.push(gt(chat.createdAt, selectedChat.createdAt));
      }
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (selectedChat) {
        filters.push(lt(chat.createdAt, selectedChat.createdAt));
      }
    }

    const filteredChats = await db
      .select()
      .from(chat)
      .where(and(...filters))
      .orderBy(desc(chat.createdAt))
      .limit(extendedLimit);

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    return { chats: [], hasMore: false };
  }
}

export async function getChatById({ id }: { id: string }) {
  const chatUUID = isValidUUID(id) ? id : generateStableUUID(id);

  try {
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(eq(chat.id, chatUUID));
    return selectedChat || null;
  } catch (_error) {
    return null;
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(
      messages.map((m) => ({
        ...m,
        id: isValidUUID(m.id) ? m.id : generateStableUUID(m.id),
        chatId: isValidUUID(m.chatId) ? m.chatId : generateStableUUID(m.chatId),
        createdAt: new Date(),
      })),
    );
  } catch (error) {
    console.error("[DB Error: saveMessages]:", error);
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to save messages",
    );
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  const chatUUID = isValidUUID(id) ? id : generateStableUUID(id);

  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatUUID))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    return [];
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id",
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save document");
  }
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  try {
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt))
      .limit(1);

    const latest = docs[0];
    if (!latest) {
      throw new ChatbotError("not_found:database", "Document not found");
    }

    return await db
      .update(document)
      .set({ content })
      .where(and(eq(document.id, id), eq(document.createdAt, latest.createdAt)))
      .returning();
  } catch (_error) {
    if (_error instanceof ChatbotError) {
      throw _error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update document content",
    );
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get documents by id",
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get document by id",
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp",
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save suggestions",
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get suggestions by document id",
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id",
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id,
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp",
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id",
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user"),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id",
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id",
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id",
    );
  }
}

export async function getUserMemories(userId: string) {
  try {
    return await db
      .select()
      .from(userMemory)
      .where(eq(userMemory.userId, userId))
      .orderBy(desc(userMemory.createdAt))
      .limit(20);
  } catch (_error) {
    return [];
  }
}

export async function saveUserMemory(userId: string, content: string) {
  try {
    return await db.insert(userMemory).values({
      userId,
      content,
    });
  } catch (_error) {}
}

export async function searchKnowledgeBase(query?: string) {
  try {
    const keywords = query
      ? query
          .split(/\s+/)
          .filter((k) => k.length > 2)
          .map((k) => `%${k}%`)
      : [];

    // 1. Search in knowledgeBase table
    let kbResults = [];
    if (keywords.length === 0) {
      kbResults = await db.select().from(knowledgeBase).limit(10);
    } else {
      // Create parallel conditions for better matching
      const conditions = keywords.map((k) => ilike(knowledgeBase.content, k));
      kbResults = await db
        .select()
        .from(knowledgeBase)
        .where(or(...conditions)) // Or for broader reach, let the AI rank
        .limit(10);
    }

    // 2. Search in Documents table (technical guides/artifacts)
    let docResults = [];
    if (keywords.length === 0) {
      docResults = await db
        .select()
        .from(document)
        .where(eq(document.kind, "text"))
        .orderBy(desc(document.createdAt))
        .limit(10);
    } else {
      const titleConditions = keywords.map((k) => ilike(document.title, k));
      const contentConditions = keywords.map((k) => ilike(document.content, k));
      docResults = await db
        .select()
        .from(document)
        .where(
          and(
            eq(document.kind, "text"),
            or(...titleConditions, ...contentConditions),
          ),
        )
        .orderBy(desc(document.createdAt))
        .limit(10);
    }

    // Combine results
    const combined = [
      ...kbResults.map((r) => ({
        content: r.content,
        title:
          (r.metadata as Record<string, string> | null)?.title ||
          "General Knowledge",
        source: "knowledge_base",
        createdAt: r.createdAt,
      })),
      ...docResults.map((r) => ({
        content: r.content,
        title: r.title,
        source: "document",
        createdAt: r.createdAt,
      })),
    ];

    return combined.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  } catch (_error) {
    return [];
  }
}

export async function saveKnowledgeBaseItem({
  content,
  userId,
  metadata,
}: {
  content: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await db
      .insert(knowledgeBase)
      .values({
        content,
        userId,
        metadata,
      })
      .returning();
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save knowledge base item",
    );
  }
}

export async function getSystemConfig() {
  try {
    const [config] = await db.select().from(systemConfig).limit(1);
    return config || null;
  } catch (_error) {
    return null;
  }
}

export async function getPayments({
  userId,
  userRole,
  customerName,
  startDate,
  endDate,
}: {
  userId: string;
  userRole: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
}) {
  try {
    const conditions = [];

    if (customerName) {
      conditions.push(ilike(payment.customerName, `%${customerName}%`));
    }
    if (startDate) {
      conditions.push(gte(payment.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(payment.date, endDate));
    }
    if (userRole !== "admin") {
      conditions.push(eq(payment.ownerId, userId));
    }

    return await db
      .select()
      .from(payment)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(payment.date))
      .limit(50);
  } catch (_error) {
    return [];
  }
}

export async function searchMessages({
  userId,
  query,
}: {
  userId: string;
  query: string;
}) {
  try {
    const keywords = query
      .split(/\s+/)
      .filter((k) => k.length > 2)
      .map((k) => `%${k}%`);

    if (keywords.length === 0) return [];

    const conditions = keywords.map(
      (k) => sql`CAST(${message.parts} AS TEXT) ILIKE ${k}`,
    );

    return await db
      .select({
        messageId: message.id,
        chatId: message.chatId,
        role: message.role,
        parts: message.parts,
        createdAt: message.createdAt,
        chatTitle: chat.title,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(and(eq(chat.userId, userId), or(...conditions)))
      .orderBy(desc(message.createdAt))
      .limit(20);
  } catch (_error) {
    return [];
  }
}

export async function upsertProduct(data: {
  id: string;
  name: string;
  sku?: string;
  note?: string;
  imageUrls?: string;
  category?: string;
  ownerId: string;
  ownerEmail?: string;
}) {
  // Try to find by SKU first if provided, then by Name
  let existing: (typeof product.$inferSelect)[] = [];
  if (data.sku) {
    existing = await db
      .select()
      .from(product)
      .where(and(eq(product.sku, data.sku), eq(product.ownerId, data.ownerId)))
      .limit(1);
  }

  if (existing.length === 0) {
    existing = await db
      .select()
      .from(product)
      .where(
        and(eq(product.name, data.name), eq(product.ownerId, data.ownerId)),
      )
      .limit(1);
  }

  if (existing.length > 0) {
    const p = existing[0];
    const oldImages =
      p.imageUrls
        ?.split(",")
        .map((i: string) => i.trim())
        .filter(Boolean) || [];

    const newImages =
      data.imageUrls
        ?.split(",")
        .map((i: string) => i.trim())
        .filter((i: string) => i.startsWith("http")) || [];

    // In the current context of this AI agent, providing new images usually means 
    // replacing the old ones or setting the definitive list.
    const allImages = newImages.length > 0 
      ? newImages.join(", ") 
      : p.imageUrls;

    const result = await db
      .update(product)
      .set({
        imageUrls: allImages,
        note: data.note || p.note,
        sku: data.sku || p.sku,
        category: data.category || p.category,
        updatedAt: new Date(),
      })
      .where(eq(product.id, p.id))
      .returning();
    return result;
  }

  const insertResult = await db
    .insert(product)
    .values({
      id: data.id,
      name: data.name,
      sku: data.sku,
      category: data.category,
      note: data.note,
      imageUrls: data.imageUrls,
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return insertResult;
}

export async function getProductsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(product)
      .where(eq(product.ownerId, userId))
      .orderBy(desc(product.updatedAt));
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return [];
  }
}

export async function getProductsByNameAndUser({
  name,
  userId,
}: {
  name: string;
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(product)
      .where(
        and(ilike(product.name, `%${name}%`), eq(product.ownerId, userId)),
      );
  } catch (error) {
    console.error("Failed to fetch product by name:", error);
    return [];
  }
}

export async function getOrdersByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(order)
      .where(eq(order.ownerId, userId))
      .orderBy(desc(order.createdAt));
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return [];
  }
}

export async function getTotalPaymentsByUserId({
  userId,
}: {
  userId: string;
}): Promise<number> {
  try {
    const result = await db
      .select({ total: sql<number>`sum(${payment.amount})` })
      .from(payment)
      .where(eq(payment.ownerId, userId));
    return Number(result[0]?.total || 0);
  } catch (error) {
    console.error("Failed to fetch total payments:", error);
    return 0;
  }
}

export async function getAllProductsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(product)
      .where(eq(product.ownerId, userId))
      .orderBy(desc(product.createdAt));
  } catch (_error) {
    return [];
  }
}

export async function getCustomersByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(customer)
      .where(eq(customer.ownerId, userId))
      .orderBy(desc(customer.createdAt));
  } catch (_error) {
    return [];
  }
}

export async function getCashBookByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(cashBook)
      .where(eq(cashBook.ownerId, userId))
      .orderBy(desc(cashBook.createdAt));
  } catch (_error) {
    return [];
  }
}

export async function getZaloConfig() {
  try {
    const [config] = await db
      .select()
      .from(zaloConfig)
      .where(eq(zaloConfig.id, "default"));
    return config || null;
  } catch (_error) {
    return null;
  }
}

export async function upsertZaloConfig(data: {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}) {
  try {
    return await db
      .insert(zaloConfig)
      .values({
        id: "default",
        ...data,
      })
      .onConflictDoUpdate({
        target: zaloConfig.id,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();
  } catch (error) {
    console.error("Failed to upsert Zalo config:", error);
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save Zalo configuration",
    );
  }
}
export async function upsertPayment(data: {
  id: string;
  amount: number;
  customerId?: string;
  customerName?: string;
  date?: string;
  paymentMethod?: string;
  proofImage?: string;
  note?: string;
  ownerId: string;
  ownerEmail?: string;
}) {
  try {
    const existing = await db
      .select()
      .from(payment)
      .where(eq(payment.id, data.id))
      .limit(1);

    if (existing.length > 0) {
      return await db
        .update(payment)
        .set({
          ...data,
          amount: data.amount, // Ensure it's treated as number/bigint per schema
        })
        .where(eq(payment.id, data.id))
        .returning();
    }

    return await db
      .insert(payment)
      .values({
        ...data,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    console.error("Failed to upsert payment:", error);
    throw new ChatbotError("bad_request:database", "Failed to save payment");
  }
}
