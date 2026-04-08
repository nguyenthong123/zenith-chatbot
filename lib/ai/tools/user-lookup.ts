import { tool } from "ai";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { user } from "@/lib/db/schema";

export const getUserLookup = (
  _userId: string,
  userRole: string,
  userEmail?: string | null,
) =>
  tool({
    description:
      "Look up user account information. Use this when the user asks about their personal info, profile, or identity. For non-admin (Guest/Regular), only their own record is returned.",
    inputSchema: z.object({
      email: z
        .string()
        .optional()
        .describe(
          "Email to look up. Leave empty for the current user. Admin only: search others.",
        ),
      name: z
        .string()
        .optional()
        .describe("Search users by name (Admin only)."),
    }),
    execute: async ({ email, name }) => {
      try {
        const conditions = [];

        if (userRole !== "admin") {
          if (!userEmail) {
            return {
              error: "Bạn chưa đăng nhập hoặc không xác định được danh tính.",
            };
          }
          conditions.push(eq(user.email, userEmail));
        } else {
          if (email) {
            conditions.push(ilike(user.email, `%${email}%`));
          }
          if (name) {
            conditions.push(
              or(
                ilike(user.name, `%${name}%`),
                ilike(user.displayName, `%${name}%`),
              ),
            );
          }
        }

        const results = await db
          .select({
            id: user.id,
            email: user.email,
            name: user.name,
            displayName: user.displayName,
            role: user.role,
            isAnonymous: user.isAnonymous,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          })
          .from(user)
          .where(
            conditions.length > 0 ? and(...(conditions as any[])) : undefined,
          )
          .limit(10);

        if (results.length === 0) {
          return { message: "Không tìm thấy thông tin phù hợp." };
        }

        return {
          usersCount: results.length,
          users: results,
        };
      } catch (error) {
        console.error("User lookup failed:", error);
        return { error: "Lỗi hệ thống khi tìm kiếm người dùng." };
      }
    },
  });
