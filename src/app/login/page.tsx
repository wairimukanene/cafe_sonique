import { redirect } from "next/navigation";
import Link from "next/link";

import { getStaffSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const instant = false;

export default async function LoginPage() {
  const session = await getStaffSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="login-page">
      <Link className="brand-mark" href="/">SON<span>ː</span>QUE</Link>
      <section className="login-card">
        <p className="eyebrow text-olive">Staff workspace</p>
        <h1 className="mt-4 font-display text-6xl leading-none">Welcome back.</h1>
        <p className="mt-5 max-w-sm text-sm leading-6 text-ink/60">
          Sign in to manage the menu, events and booking requests.
        </p>
        <div className="mt-10">
          <LoginForm />
        </div>
      </section>
      <Link className="text-sm text-ink/55" href="/">← Return to the public site</Link>
    </main>
  );
}
