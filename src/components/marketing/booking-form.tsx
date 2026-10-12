"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import {
  submitBooking,
  type BookingFormState,
} from "@/app/actions/bookings";

const initialState: BookingFormState = { ok: false, message: "" };

export function BookingForm() {
  const [state, action, pending] = useActionState(submitBooking, initialState);

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <label>
        Your name
        <input name="name" type="text" placeholder="Name" required />
      </label>
      <label>
        Phone or email
        <input name="contact" type="text" placeholder="How can we reach you?" required />
      </label>
      <label>
        Event type
        <select name="eventType" defaultValue="" required>
          <option value="" disabled>Choose one</option>
          <option>Listening session</option>
          <option>Community gathering</option>
          <option>Private event</option>
          <option>Something else</option>
        </select>
      </label>
      <label>
        Preferred date
        <input name="preferredDate" type="date" required />
      </label>
      <label>
        Number of guests
        <input name="attendeeCount" type="number" min="1" max="100" defaultValue="1" required />
      </label>
      <label>
        A short note
        <input name="message" type="text" placeholder="Tell us what you have in mind" />
      </label>
      <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {state.message ? (
        <p className={`sm:col-span-2 ${state.ok ? "booking-success" : "booking-error"}`} role="status">
          {state.message}
        </p>
      ) : null}
      <button className="submit-button sm:col-span-2" disabled={pending} type="submit">
        {pending ? "Sending…" : "Send booking enquiry"}
        {pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}
      </button>
    </form>
  );
}
