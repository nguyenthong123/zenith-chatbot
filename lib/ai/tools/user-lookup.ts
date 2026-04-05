import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/queries";
import { type User, user } from "@/lib/db/schema";
import { getSupabaseClient } from "@/lib/supabase/server";

export const getUserByEmail = tool({
  description:
    "Look up a user by their email address. Use this tool to find a user in the system before looking up their revenue. This is the FIRST step in the revenue lookup process.",
  inputSchema: z.object({
    email: z.string().describe("The email address of the user to look up."),
  }),
  execute: async ({ email }) => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        return await queryWithSupabase(supabase, email);
      }
      return await queryWithDrizzle(email);
    } catch (error) {
      return {
        error: "Failed to look up user by email.",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

async function queryWithSupabase(
  supabase: ReturnType<typeof getSupabaseClient> & object,
  email: string,
) {
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .limit(1);

  if (!users || users.length === 0) {
    return {
      found: false,
      message: `Không tìm thấy người dùng với email "${email}". Vui lòng kiểm tra lại email.`,
    };
  }

  const u = users[0] as Record<string, unknown>;
  return {
    found: true,
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      displayName: u.displayName,
      role: u.role,
    },
  };
}

async function queryWithDrizzle(email: string) {
  const users = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (users.length === 0) {
    return {
      found: false,
      message: `Không tìm thấy người dùng với email "${email}". Vui lòng kiểm tra lại email.`,
    };
  }

  const u: User = users[0];
  return {
    found: true,
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      displayName: u.displayName,
      role: u.role,
    },
  };
}
