import { requireOwner } from "@/lib/auth/session";
import { getAuditLog } from "@/lib/dal/content";

export const instant = false;

export default async function AuditPage() {
  await requireOwner();
  const entries = await getAuditLog();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow text-olive">Owner only</p>
          <h1 className="dashboard-title">Audit log</h1>
        </div>
      </header>
      <section className="dashboard-panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Staff member</th>
              <th>Action</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.createdAt.toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</td>
                <td>{entry.actor?.name ?? "System"}</td>
                <td>{entry.action.replaceAll(".", " ")}</td>
                <td>{entry.entityType} · {entry.entityId.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length ? <p className="py-10 text-center text-sm text-ink/50">No audited changes yet.</p> : null}
      </section>
    </main>
  );
}
