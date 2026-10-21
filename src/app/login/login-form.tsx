"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL: "/admin",
    });

    setPending(false);

    if (result.error) {
      setError("The email or password is incorrect.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form className="staff-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="staff-primary-button" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <>Sign in <ArrowRight size={18} /></>}
      </button>
    </form>
  );
}
