"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { createUser, getUser, updateUserPassword } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    // Authenticate with Supabase Auth
    const supabase = await createSupabaseServerClient();
    const { data: supabaseData, error: supabaseError } =
      await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

    if (supabaseError || !supabaseData?.user) {
      return { status: "failed" };
    }

    // Ensure local DB is in sync
    await ensureLocalUserSync(
      validatedData.email,
      validatedData.password,
      supabaseData.user.id,
    );

    // Also sign in with NextAuth to maintain app session
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    if (error instanceof AuthError) {
      return { status: "failed" };
    }

    // Re-throw redirect errors and other non-handled errors
    throw error;
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
};

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    // Sign up with Supabase Auth
    const supabase = await createSupabaseServerClient();
    const { data: supabaseData, error: supabaseError } =
      await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
      });

    if (supabaseError) {
      console.error("[register] Supabase Auth signUp error:", {
        code: supabaseError.code,
        message: supabaseError.message,
      });

      // If user already exists, we might still fail if we don't have a local record
      if (
        supabaseError.code === "user_already_exists" ||
        supabaseError.message?.includes("already registered")
      ) {
        // Since we can't easily get the ID without admin key here,
        // we'll try to just sign person in. If that fails, then return user_exists.
        try {
          await signIn("credentials", {
            email: validatedData.email,
            password: validatedData.password,
            redirect: false,
          });
          return { status: "success" };
        } catch (e) {
          return { status: "user_exists" };
        }
      }
      return { status: "failed" };
    }

    // When "Confirm email" is disabled, Supabase might return user with empty identities if they exist
    const isExistingUser =
      supabaseData?.user?.identities &&
      supabaseData.user.identities.length === 0;

    if (supabaseData?.user) {
      console.log(
        `[register] Supabase Auth status: ${isExistingUser ? "Existing" : "New"} | user id:`,
        supabaseData.user.id,
      );

      // Ensure local DB is in sync
      await ensureLocalUserSync(
        validatedData.email,
        validatedData.password,
        supabaseData.user.id,
      );
    }

    // Sign in with NextAuth to maintain app session
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    console.log("[register] Registration and sign-in completed successfully");
    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    if (error instanceof AuthError) {
      console.error(
        "[register] Auth error during registration:",
        error.type,
        error.message,
      );
      return { status: "failed" };
    }

    // Re-throw redirect errors and other non-handled errors
    throw error;
  }
};

async function ensureLocalUserSync(
  email: string,
  password: string,
  id: string,
) {
  try {
    const [existingUser] = await getUser(email);
    if (!existingUser) {
      console.log(`[register] Syncing local user for ${email} with ID ${id}`);
      await createUser(email, password, id);
    } else {
      console.log(`[register] Local DB user already exists for ${email}`);
      // If user exists but has no password (e.g. from social login), update it
      if (!existingUser.password) {
        console.log(
          `[register] Existing user ${email} from social login found. Updating with password.`,
        );
        await updateUserPassword(email, password);
      }
    }
  } catch (dbError) {
    console.error(
      "[register] CRITICAL: Failed to sync local DB user:",
      dbError instanceof Error ? dbError.message : String(dbError),
    );
  }
}
