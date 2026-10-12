"use client";

import { useActionState } from "react";
import { LoaderCircle, Save } from "lucide-react";

import type { ActionState } from "@/app/dashboard/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
};

const initialState: ActionState = { ok: false, message: "" };

export function ActionForm({
  action,
  children,
  submitLabel = "Save changes",
  className = "",
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={`dashboard-form ${className}`}>
      {children}
      {state.message ? (
        <p className={state.ok ? "form-success" : "form-error"} role="status">
          {state.message}
        </p>
      ) : null}
      <button className="staff-primary-button" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
