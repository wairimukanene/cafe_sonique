"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { submitThought, type ThoughtFormState } from "@/app/actions/thoughts";

const initialState: ThoughtFormState = { ok: false, message: "" };

export function ThoughtForm() {
  const [state, action, pending] = useActionState(submitThought, initialState);

  return (
    <form action={action} className="staff-form">
      <label>
        Your name
        <input name="displayName" type="text" maxLength={40} placeholder="How should we sign it?" required />
      </label>
      <label>
        Your thought
        <textarea
          name="body"
          rows={4}
          minLength={8}
          maxLength={280}
          placeholder="A line for the next person who sits here"
          required
        />
      </label>
      <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {state.message ? (
        <p className={state.ok ? "form-success" : "form-error"} role="status">
          {state.message}
        </p>
      ) : null}
      <button className="staff-primary-button" disabled={pending} type="submit">
        {pending ? "Leaving…" : "Leave a thought"}
        {pending ? <LoaderCircle className="animate-spin" size={17} /> : <ArrowRight size={17} />}
      </button>
    </form>
  );
}
