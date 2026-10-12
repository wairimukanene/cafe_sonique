import { MessageSquareText } from "lucide-react";

import { ActionForm } from "@/components/staff/action-form";
import { getStaffThoughts } from "@/lib/dal/content";
import { updateThoughtVisibility } from "../actions";

export const instant = false;

export default async function ThoughtsPage() {
  const thoughts = await getStaffThoughts();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">From the room</p>
          <h1 className="dashboard-title">Thoughts</h1>
        </div>
      </header>
      <p className="mb-8 max-w-2xl text-sm leading-6 text-ink/60">
        Published thoughts appear on the public site. Hide a note to remove it
        from the wall while keeping it here.
      </p>
      <div className="grid gap-4">
        {thoughts.map((thought) => (
          <article className="dashboard-panel" key={thought.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-display text-3xl">{thought.displayName}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink/40">
                  {thought.createdAt.toLocaleString("en-KE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Africa/Nairobi",
                  })}
                </p>
              </div>
              <span className="status-pill">{thought.status}</span>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-ink/70">{thought.body}</p>
            <ActionForm
              action={updateThoughtVisibility}
              className="mt-6 max-w-sm"
              submitLabel={thought.status === "published" ? "Hide from public" : "Show on public wall"}
            >
              <input name="id" type="hidden" value={thought.id} />
              <input
                name="status"
                type="hidden"
                value={thought.status === "published" ? "hidden" : "published"}
              />
            </ActionForm>
          </article>
        ))}
        {!thoughts.length ? (
          <div className="dashboard-panel grid place-items-center py-16 text-center">
            <MessageSquareText className="text-olive" size={34} />
            <p className="mt-4 font-display text-3xl">No thoughts yet.</p>
            <p className="mt-2 text-sm text-ink/50">
              Notes left on the public site will appear here.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
