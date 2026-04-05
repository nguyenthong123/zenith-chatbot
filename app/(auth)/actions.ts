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
      // Supabase returns error for duplicate emails
      if (
        supabaseError.code === "user_already_exists" ||
        supabaseError.message?.includes("already registered")
      ) {
        return { status: "user_exists" };
      }
      return { status: "failed" };
    }

    // When "Confirm email" is disabled and the email already exists,
    // Supabase may return a fake user with no identities instead of an error
    if (
      supabaseData?.user?.identities &&
      supabaseData.user.identities.length === 0
    ) {
      return { status: "user_exists" };
    }

    // Also create user in the local database for app data
    const [existingUser] = await getUser(validatedData.email);
    if (!existingUser) {
      await createUser(validatedData.email, validatedData.password);
    }

    // Sign in with NextAuth to maintain app session
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
