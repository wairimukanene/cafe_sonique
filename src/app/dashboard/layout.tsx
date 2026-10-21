import Link from "next/link";
import { Suspense } from "react";

import { DashboardNav } from "@/components/staff/dashboard-nav";
import { LogoutButton } from "@/components/staff/logout-button";
import { BrandMark } from "@/components/marketing/brand-mark";
import { requireStaff } from "@/lib/auth/session";
import { DashboardLoading } from "./loading";

export const instant = false;

export default async function DashboardLayout({
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
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-cream/40">Staff workspace</p>
        </div>
        <DashboardNav isOwner={session.user.role === "owner"} />
        <div className="mt-auto border-t border-cream/10 pt-5">
          <p className="text-sm font-semibold text-cream">{session.user.name}</p>
          <p className="mt-1 text-xs capitalize text-cream/45">{session.user.role}</p>
          <LogoutButton />
        </div>
      </aside>
      <div className="dashboard-main">
        <Suspense fallback={<DashboardLoading />}>{children}</Suspense>
      </div>
    </div>
  );
}
