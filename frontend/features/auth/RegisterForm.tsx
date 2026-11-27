"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { postLoginPath } from "@/lib/return-to";
import type { User } from "@/lib/types";
import { mapErrors, type FieldKey } from "./errors";
import { AuthCard, ErrorList, SubmitButton, TextField } from "./ui";

export default function RegisterForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [general, setGeneral] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(postLoginPath(user, returnTo));
  }, [loading, user, returnTo, router]);

  // Password rules shown live (ACC-01): 8 to 72 characters, one letter, one digit
  const rules = [
    { label: "8 to 72 characters", ok: password.length >= 8 && password.length <= 72 },
    { label: "At least one letter", ok: /[A-Za-z]/.test(password) },
    { label: "At least one digit", ok: /\d/.test(password) },
  ];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setGeneral([]);

    // Quick checks for a faster answer; the backend stays the authority
    const local: Partial<Record<FieldKey, string>> = {};
    if (!name.trim()) local.name = "Enter your name.";
    if (!email.trim()) local.email = "Enter your email.";
    if (!rules.every((r) => r.ok)) local.password = "Password does not meet the rules below.";
    if (!acceptedTerms) local.terms = "You must accept the terms.";
    setFieldErrors(local);
    if (Object.keys(local).length > 0) return;

    setSubmitting(true);
    try {
      await api.post(
        "/api/auth/register",
        { name: name.trim(), email: email.trim(), password, acceptedTerms: true },
        { skipAuthRedirect: true },
      );
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped = mapErrors(err.messages);
        setFieldErrors(mapped.fields);
        setGeneral(mapped.general);
      } else {
        setGeneral(["Something went wrong. Try again."]);
      }
      setSubmitting(false);
      return;
    }

    // Account created: log in right away
    try {
      const me = await api.post<User>(
        "/api/auth/login",
        { email: email.trim(), password },
        { skipAuthRedirect: true },
      );
      await refresh();
      router.replace(postLoginPath(me, returnTo));
    } catch {
      router.replace("/login");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <AuthCard title="Create your account">
        <p className="text-sm text-muted-foreground">Checking your session...</p>
      </AuthCard>
    );
  }

  const loginHref = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/login";

  return (
    <AuthCard
      title="Create your account"
      subtitle="Plan, book and share your trips."
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="font-semibold text-brand-maroon underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <ErrorList messages={general} />
        <TextField
          id="name"
          label="Name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <div>
          <TextField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <ul className="mt-2 space-y-1 text-xs">
            {rules.map((r) => (
              <li
                key={r.label}
                className={r.ok ? "font-semibold text-brand-coffee" : "text-muted-foreground"}
              >
                {r.ok ? "✓" : "○"} {r.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 accent-brand-maroon"
            />
            <span>I accept the terms and conditions</span>
          </label>
          {fieldErrors.terms && (
            <p className="mt-1 text-sm font-medium text-brand-maroon">{fieldErrors.terms}</p>
          )}
        </div>
        <SubmitButton pending={submitting}>Create account</SubmitButton>
      </form>
    </AuthCard>
  );
}