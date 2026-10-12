"use client";

import { useActionState } from "react";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";

export type OperationActionState = {
  ok: boolean;
  message: string;
};

type Props = {
  action: (formData: FormData) => Promise<OperationActionState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
  encType?: "multipart/form-data";
};

const initialState: OperationActionState = { ok: false, message: "" };

export function OperationForm({
  action,
  children,
  submitLabel,
  className = "",
  encType,
}: Props) {
  const [state, formAction, pending] = useActionState(
    async (_state: OperationActionState, formData: FormData) => action(formData),
    initialState,
  );

  return (
    <form
      action={formAction}
      className={`dashboard-form operations-form ${className}`}
      encType={encType}
    >
      {children}
      {state.message ? (
        <p
          aria-live="polite"
          className={state.ok ? "form-success" : "form-error"}
          role="status"
        >
          {state.ok ? <CheckCircle2 aria-hidden size={16} /> : null}
          {state.message}
        </p>
      ) : null}
      <button className="staff-primary-button" disabled={pending} type="submit">
        {pending ? (
          <LoaderCircle aria-hidden className="animate-spin" size={17} />
        ) : (
          <Save aria-hidden size={17} />
        )}
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
