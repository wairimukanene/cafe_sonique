import { CalendarDays, Plus } from "lucide-react";

import { ActionForm } from "@/components/staff/action-form";
import { getStaffEvents } from "@/lib/dal/content";
import { saveEvent } from "../actions";

export const instant = false;

export default async function EventsManagementPage() {
  const events = await getStaffEvents();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Community calendar</p>
          <h1 className="dashboard-title">Events</h1>
        </div>
      </header>

      <details className="dashboard-panel mb-6">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold">
          <Plus size={18} /> Add an event
        </summary>
        <ActionForm action={saveEvent} className="mt-6" submitLabel="Create event">
          <EventFields />
        </ActionForm>
      </details>

      <div className="grid gap-4">
        {events.map((item) => (
          <details className="dashboard-panel" key={item.id}>
            <summary className="flex cursor-pointer items-center gap-4">
              <CalendarDays size={20} />
              <span>
                <strong>{item.title}</strong>
                <small className="mt-1 block text-ink/45">
                  {item.startsAt.toLocaleString("en-KE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Nairobi",
                  })}
                </small>
              </span>
              <span className="status-pill ml-auto">{item.status}</span>
            </summary>
            <ActionForm action={saveEvent} className="mt-6">
              <input name="id" type="hidden" value={item.id} />
              <EventFields item={item} />
            </ActionForm>
          </details>
        ))}
        {!events.length ? <p className="dashboard-panel text-sm text-ink/55">No events yet.</p> : null}
      </div>
    </main>
  );
}

type EventRecord = Awaited<ReturnType<typeof getStaffEvents>>[number];

function EventFields({ item }: { item?: EventRecord }) {
  return (
    <>
      <div className="dashboard-form-grid">
        <label>
          Title
          <input name="title" defaultValue={item?.title} required />
        </label>
        <label>
          URL slug
          <input name="slug" defaultValue={item?.slug} placeholder="album-listening-night" required />
        </label>
      </div>
      <label>
        Description
        <textarea name="description" rows={4} defaultValue={item?.description} required />
      </label>
      <div className="dashboard-form-grid">
        <label>
          Starts at
          <input
            name="startsAt"
            type="datetime-local"
            defaultValue={item ? item.startsAt.toISOString().slice(0, 16) : undefined}
            required
          />
        </label>
        <label>
          Capacity
          <input name="capacity" type="number" min="1" defaultValue={item?.capacity ?? undefined} />
        </label>
      </div>
      <label>
        Status
        <select name="status" defaultValue={item?.status ?? "draft"}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
    </>
  );
}
