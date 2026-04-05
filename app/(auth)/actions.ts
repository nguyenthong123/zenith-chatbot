"use server";

import { z } from "zod";

import { createUser, getUser } from "@/lib/db/queries";
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
    const { error: supabaseError } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (supabaseError) {
      return { status: "failed" };
    }

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

    return { status: "failed" };
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
        status: supabaseError.status,
      });

      // Supabase returns error for duplicate emails
      if (
        supabaseError.code === "user_already_exists" ||
        supabaseError.message?.includes("already registered")
      ) {
        return { status: "user_exists" };
      }
      return { status: "failed" };
    }

    // When "Confirm email" is disabled in Supabase project settings,
    // signing up with an existing email does not return an error.
    // Instead, Supabase returns a user object with an empty identities array.
    // See: https://supabase.com/docs/reference/javascript/auth-signup
    if (
      supabaseData?.user?.identities &&
      supabaseData.user.identities.length === 0
    ) {
      console.warn(
        "[register] User already exists (empty identities):",
        validatedData.email,
      );
      return { status: "user_exists" };
    }

    // Handle case where user exists in Auth but hasn't confirmed email:
    // supabaseData.user will exist with a valid id — treat as success and proceed
    if (supabaseData?.user) {
      console.log(
        "[register] Supabase Auth signUp succeeded for:",
        validatedData.email,
        "| user id:",
        supabaseData.user.id,
      );
    }

    // Also create user in the local database for app data
    // Wrap in try-catch so a DB failure doesn't block the sign-in flow
    try {
      const [existingUser] = await getUser(validatedData.email);
      if (!existingUser) {
        await createUser(validatedData.email, validatedData.password);
        console.log(
          "[register] Local DB user created for:",
          validatedData.email,
        );
      } else {
        console.log(
          "[register] Local DB user already exists for:",
          validatedData.email,
        );
      }
    } catch (dbError) {
      console.error(
        "[register] Failed to create local DB user (non-blocking):",
        dbError,
      );
      // Do not return failed — Auth succeeded, so we proceed to sign in
    }

    // Sign in with NextAuth to maintain app session
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    console.log(
      "[register] Registration and sign-in completed for:",
      validatedData.email,
    );
    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    console.error("[register] Unexpected error during registration:", error);
    return { status: "failed" };
  }
};
