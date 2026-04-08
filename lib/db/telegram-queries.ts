import { compare } from "bcrypt-ts";
import { and, eq } from "drizzle-orm";
import { db } from "./queries";
import { telegramUser, user } from "./schema";

export async function getActiveTelegramUser(telegramId: string) {
  const result = await db
    .select({
      user: user,
      telegramMap: telegramUser,
    })
    .from(telegramUser)
    .innerJoin(user, eq(telegramUser.userId, user.id))
    .where(
      and(
        eq(telegramUser.telegramId, telegramId),
        eq(telegramUser.isActive, true),
      ),
    )
    .limit(1);

  return result[0];
}

export async function createTelegramGuest(
  telegramId: string,
  chatId: string,
  name: string,
) {
  const email = `tg_guest_${telegramId}@telegram.local`;

  // 1. Check if user already exists
  let [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (!existingUser) {
    [existingUser] = await db
      .insert(user)
      .values({
        email,
        name: name || `Guest ${telegramId}`,
        isAnonymous: true,
        role: "user",
      })
      .returning();
  }

  // 2. Link it in telegram_users if not already active
  const [existingLink] = await db
    .select()
    .from(telegramUser)
    .where(eq(telegramUser.telegramId, telegramId))
    .limit(1);

  if (!existingLink) {
    await db.insert(telegramUser).values({
      telegramId,
      chatId,
      userId: existingUser.id,
      isActive: true,
    });
  } else {
    // Update existing link to active and update chatId just in case
    await db
      .update(telegramUser)
      .set({ isActive: true, chatId, userId: existingUser.id })
      .where(eq(telegramUser.telegramId, telegramId));
  }

  return existingUser;
}

export async function linkTelegramAccount(
  telegramId: string,
  chatId: string,
  email: string,
  password?: string,
) {
  // 1. Find user by email
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!existingUser)
    return { success: false, message: "Không tìm thấy người dùng." };

  // 2. Verify password if provided
  if (password && existingUser.password) {
    const isMatch = await compare(password, existingUser.password);
    if (!isMatch) return { success: false, message: "Sai mật khẩu." };
  }

  // 3. Deactivate old active links for this telegramId
  await db
    .update(telegramUser)
    .set({ isActive: false })
    .where(eq(telegramUser.telegramId, telegramId));

  // 4. Check if this specific link already exists
  const [existingLink] = await db
    .select()
    .from(telegramUser)
    .where(
      and(
        eq(telegramUser.telegramId, telegramId),
        eq(telegramUser.userId, existingUser.id),
      ),
    )
    .limit(1);

  if (existingLink) {
    await db
      .update(telegramUser)
      .set({ isActive: true })
      .where(eq(telegramUser.id, existingLink.id));
  } else {
    await db.insert(telegramUser).values({
      telegramId,
      chatId,
      userId: existingUser.id,
      isActive: true,
    });
  }

  return { success: true, user: existingUser };
}

export async function switchTelegramIdentity(
  telegramId: string,
  toGuest: boolean,
) {
  // This is a simple implementation:
  // If toGuest is true, find the isAnonymous user linked to this telegramId and set it active.
  // Otherwise, find the non-anonymous one.

  const links = await db
    .select({
      linkId: telegramUser.id,
      isAnonymous: user.isAnonymous,
    })
    .from(telegramUser)
    .innerJoin(user, eq(telegramUser.userId, user.id))
    .where(eq(telegramUser.telegramId, telegramId));

  const targetLink = links.find((l) => l.isAnonymous === toGuest);
  if (!targetLink)
    return { success: false, message: "Không tìm thấy định danh phù hợp." };

  await db
    .update(telegramUser)
    .set({ isActive: false })
    .where(eq(telegramUser.telegramId, telegramId));
  await db
    .update(telegramUser)
    .set({ isActive: true })
    .where(eq(telegramUser.id, targetLink.linkId));

  return { success: true };
}

export async function unlinkTelegramAccount(telegramId: string) {
  // 1. Deactivate all links for this telegramId
  await db
    .update(telegramUser)
    .set({ isActive: false })
    .where(eq(telegramUser.telegramId, telegramId));

  // 2. Find and reactivate the guest account
  const guestUserEmail = `tg_guest_${telegramId}@telegram.local`;
  const [guestUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, guestUserEmail))
    .limit(1);

  if (guestUser) {
    await db
      .update(telegramUser)
      .set({ isActive: true })
      .where(
        and(
          eq(telegramUser.telegramId, telegramId),
          eq(telegramUser.userId, guestUser.id),
        ),
      );
  }

  return { success: true, message: "Đã đăng xuất và hủy liên kết tài khoản." };
}
