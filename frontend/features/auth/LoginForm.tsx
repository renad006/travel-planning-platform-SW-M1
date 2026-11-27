"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { postLoginPath } from "@/lib/return-to";
import type { User } from "@/lib/types";
import { AuthCard, ErrorList, SubmitButton, TextField } from "./ui";

export default function LoginForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // AuthProvider already restored the session silently (/auth/me + refresh): skip the form
  useEffect(() => {
    if (!loading && user) router.replace(postLoginPath(user, returnTo));
  }, [loading, user, returnTo, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors([]);
    if (!email.trim() || !password) {
      setErrors(["Enter your email and password."]);
      return;
    }
    setSubmitting(true);
    try {
      const me = await api.post<User>(
        "/api/auth/login",
        { email: email.trim(), password },
        { skipAuthRedirect: true },
      );
      await refresh();
      router.replace(postLoginPath(me, returnTo));
    } catch (err) {
      setErrors(
        err instanceof ApiError ? err.messages : ["Something went wrong. Try again."],
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <AuthCard title="Log in">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </AuthCard>
    );
  }

  const registerHref = returnTo
    ? `/register?returnTo=${encodeURIComponent(returnTo)}`
    : "/register";

  return (
    <AuthCard
      title="Log in"
      subtitle="Welcome back. Log in to manage your trips."
      footer={
        <>
          New here?{" "}
          <Link href={registerHref} className="font-medium text-foreground underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <ErrorList messages={errors} />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton pending={submitting}>Log in</SubmitButton>
      </form>
    </AuthCard>
  );
}