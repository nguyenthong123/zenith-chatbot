import { tool } from "ai";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const getUserLookup = (
  _userId: string,
  userRole: string,
  userEmail?: string | null,
) =>
  tool({
    description:
      "Look up user account information from the users table in Supabase. Use this when the user asks about their personal info, profile, account details, or when you need to identify a user. For non-admin users, only their own record is returned (filtered by session email).",
    inputSchema: z.object({
      email: z
        .string()
        .optional()
        .describe(
          "Email of the user to look up. Leave empty to look up the current logged-in user. Admin only: search other users by email.",
        ),
      name: z
        .string()
        .optional()
        .describe("Search users by display name (Admin only)."),
    }),
    execute: async ({ email, name }) => {
      try {
        const supabase = createSupabaseAdminClient();

        let query = supabase
          .from("users")
          .select(
            "id, email, name, displayName, photoUrl, role, emailVerified, isAnonymous, createdAt, updatedAt",
          );

        if (userRole !== "admin") {
          // Non-admin users can ONLY see their own data using session email
          if (!userEmail) {
            return {
              error:
                "Không thể xác định email người dùng. Vui lòng đăng nhập lại.",
            };
          }
          // Always use session email for non-admin, ignore any provided email/name
          query = query.eq("email", userEmail);
        } else {
          // Admin can search by email or name
          if (email) {
            query = query.ilike("email", `%${email.replace(/[%_]/g, "")}%`);
          }
          if (name) {
            const sanitizedName = name.replace(/[%_]/g, "");
            query = query.or(
              `name.ilike.%${sanitizedName}%,displayName.ilike.%${sanitizedName}%`,
            );
          }
        }

        const { data, error } = await query.limit(10);

        if (error) {
          return {
            error: "Lỗi khi truy vấn bảng users từ Supabase.",
            message: error.message,
          };
        }

        if (!data || data.length === 0) {
          return {
            message: "Không tìm thấy người dùng nào phù hợp.",
          };
        }

        return {
          usersCount: data.length,
          users: data.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            displayName: u.displayName,
            role: u.role,
            emailVerified: u.emailVerified,
            isAnonymous: u.isAnonymous,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
          })),
        };
      } catch (error) {
        console.error("User lookup failed:", error);
        return {
          error: "Không thể truy vấn thông tin người dùng.",
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
