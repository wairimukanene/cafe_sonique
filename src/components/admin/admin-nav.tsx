"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Eye,
  Film,
  Images,
  MessageSquareText,
  PenLine,
  UtensilsCrossed,
} from "lucide-react";

const links = [
  { href: "/admin/photos", label: "Photos", icon: Images },
  { href: "/admin/videos", label: "Videos", icon: Film },
  { href: "/admin/words", label: "Words", icon: PenLine },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/thoughts", label: "Guest thoughts", icon: MessageSquareText },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="dashboard-nav" aria-label="Website editor navigation">
      {links.map(({ href, label, icon: Icon }) => (
        <Link href={href} key={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
          <Icon size={18} /> {label}
        </Link>
      ))}
      <a href="/" target="_blank" rel="noreferrer">
        <Eye size={18} /> View website
      </a>
    </nav>
  );
}
