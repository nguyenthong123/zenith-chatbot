"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    { status: "idle" },
  );

  const { update: updateSession } = useSession();

  const errorMessage =
    state.status === "failed"
      ? "Email hoặc mật khẩu không đúng!"
      : state.status === "invalid_data"
        ? "Dữ liệu không hợp lệ!"
        : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "success") {
      setIsSuccessful(true);
      updateSession();
      router.push("/");
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-sm text-muted-foreground">
        Sign in to your account to continue
      </p>
      <AuthForm action={handleSubmit} defaultEmail={email}>
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
        <SubmitButton isSuccessful={isSuccessful}>Sign in</SubmitButton>
        <p className="text-center text-[13px] text-muted-foreground flex flex-col gap-2">
          <span>
            {"No account? "}
            <Link
              className="text-foreground underline-offset-4 hover:underline"
              href="/register"
            >
              Sign up
            </Link>
          </span>
          <span className="w-full flex items-center gap-2 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border my-2">
            OR
          </span>
          <Link
            className="text-foreground underline-offset-4 hover:underline text-sm font-medium"
            href="/api/auth/guest"
          >
            Continue as Guest
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
