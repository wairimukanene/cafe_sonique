import Link from "next/link";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { BrandMark } from "@/components/marketing/brand-mark";
import { LogoutButton } from "@/components/staff/logout-button";
import { requireStaff } from "@/lib/auth/session";
import { DashboardLoading } from "../dashboard/loading";

export const instant = false;

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireStaff();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div>
          <Link href="/" aria-label="Sonique home">
            <BrandMark />
          </Link>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-cream/40">Website editor</p>
        </div>
        <AdminNav />
        <div className="mt-auto border-t border-cream/10 pt-5">
          <p className="text-sm font-semibold text-cream">{session.user.name}</p>
          <LogoutButton />
        </div>
      </aside>
      <div className="dashboard-main">
        <Suspense fallback={<DashboardLoading />}>{children}</Suspense>
      </div>
    </div>
  );
}
