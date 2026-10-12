import { CalendarClock, Inbox } from "lucide-react";

import { ActionForm } from "@/components/staff/action-form";
import { getBookings } from "@/lib/dal/content";
import { updateBookingStatus } from "../actions";

export const instant = false;

export default async function BookingsPage() {
  const bookings = await getBookings();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Guest enquiries</p>
          <h1 className="dashboard-title">Bookings</h1>
        </div>
      </header>

      <div className="grid gap-4">
        {bookings.map((item) => (
          <details className="dashboard-panel" key={item.id}>
            <summary className="flex cursor-pointer items-center gap-4">
              <CalendarClock size={20} />
              <span>
                <strong>{item.name}</strong>
                <small className="mt-1 block text-ink/45">
                  {item.eventType} · {item.preferredDate.toLocaleDateString("en-KE", {
                    dateStyle: "medium",
                    timeZone: "Africa/Nairobi",
                  })}
                </small>
              </span>
              <span className="status-pill ml-auto">{item.status}</span>
            </summary>
            <div className="mt-6 grid gap-6 border-t border-ink/10 pt-6 lg:grid-cols-2">
              <div className="text-sm leading-7 text-ink/65">
                <p><strong className="text-ink">Contact:</strong> {item.contact}</p>
                <p><strong className="text-ink">Guests:</strong> {item.attendeeCount}</p>
                {item.message ? <p><strong className="text-ink">Message:</strong> {item.message}</p> : null}
              </div>
              <ActionForm action={updateBookingStatus} submitLabel="Update booking">
                <input name="id" type="hidden" value={item.id} />
                <label>
                  Status
                  <select name="status" defaultValue={item.status}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="declined">Declined</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label>
                  Staff notes
                  <textarea name="staffNotes" rows={3} defaultValue={item.staffNotes ?? undefined} />
                </label>
              </ActionForm>
            </div>
          </details>
        ))}
        {!bookings.length ? (
          <div className="dashboard-panel grid place-items-center py-16 text-center">
            <Inbox className="text-olive" size={34} />
            <p className="mt-4 font-display text-3xl">No booking enquiries yet.</p>
            <p className="mt-2 text-sm text-ink/50">New submissions from the public site will appear here.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
