export function DashboardLoading() {
  return (
    <main className="dashboard-page" aria-busy="true" aria-label="Loading dashboard">
      <div className="dashboard-loading dashboard-loading-label" />
      <div className="dashboard-loading dashboard-loading-title" />
      <div className="mt-10 grid gap-4">
        <div className="dashboard-loading h-36" />
        <div className="dashboard-loading h-36" />
        <div className="dashboard-loading h-36" />
      </div>
    </main>
  );
}

export default DashboardLoading;
