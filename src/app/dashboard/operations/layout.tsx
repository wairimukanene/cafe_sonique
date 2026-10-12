import Link from "next/link";

import { requireStaff } from "@/lib/auth/session";
import "./operations.css";

const staffLinks = [
  ["/dashboard/operations", "Operations"],
  ["/dashboard/sales", "Sales"],
  ["/dashboard/expenses", "Expenses"],
  ["/dashboard/loyalty", "Loyalty"],
  ["/dashboard/inventory", "Inventory"],
] as const;

export default async function OperationsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireStaff();
  const links =
    session.user.role === "owner"
      ? [
          ...staffLinks,
          ["/dashboard/mpesa", "M-Pesa"] as const,
          ["/dashboard/reports", "Reports"] as const,
        ]
      : staffLinks;

  return (
    <>
      <nav className="operations-nav" aria-label="Operations navigation">
        {links.map(([href, label]) => (
          <Link href={href} key={href}>{label}</Link>
        ))}
      </nav>
      {children}
    </>
  );
}
