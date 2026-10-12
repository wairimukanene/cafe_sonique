"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardList,
  Heart,
  History,
  LayoutDashboard,
  MessageSquareText,
  ReceiptText,
  ShoppingCart,
  PackageOpen,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";

type DashboardNavProps = {
  isOwner: boolean;
};

export function DashboardNav({ isOwner }: DashboardNavProps) {
  const pathname = usePathname();
  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/operations", label: "Operations", icon: ShoppingCart },
    { href: "/dashboard/sales/new", label: "New sale", icon: ReceiptText },
    { href: "/dashboard/expenses", label: "Expenses", icon: CircleDollarSign },
    { href: "/dashboard/loyalty", label: "Loyalty", icon: Heart },
    { href: "/dashboard/inventory", label: "Inventory", icon: PackageOpen },
    { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
    { href: "/dashboard/events", label: "Events", icon: CalendarDays },
    { href: "/dashboard/bookings", label: "Bookings", icon: ClipboardList },
    { href: "/dashboard/thoughts", label: "Thoughts", icon: MessageSquareText },
    ...(isOwner
      ? [
          { href: "/dashboard/reports", label: "Reports", icon: ChartNoAxesCombined },
          { href: "/dashboard/mpesa", label: "M-Pesa", icon: WalletCards },
          { href: "/dashboard/audit", label: "Audit log", icon: History },
        ]
      : []),
  ];

  return (
    <nav className="dashboard-nav" aria-label="Staff navigation">
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link href={href} key={href} aria-current={active ? "page" : undefined}>
            <Icon size={18} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
