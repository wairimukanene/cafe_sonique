import type { Metadata } from "next";
import Link from "next/link";
import { Menu } from "lucide-react";

import { BrandMark } from "@/components/marketing/brand-mark";
import { BagLink } from "@/components/shop/bag-link";

export const metadata: Metadata = {
  title: "Shop — Sonique",
  description: "Mugs, tees, keyholders, cards and stickers from Sonique. Pay with M-Pesa, collect at the bar or get it delivered in Nairobi.",
};

const navLinks = [
  { href: "/#story", label: "Our story" },
  { href: "/#events", label: "Events" },
  { href: "/#menu", label: "Menu" },
  { href: "/shop", label: "Shop" },
  { href: "/#visit", label: "Visit" },
];

export default function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-ink text-cream">
        <div className="shell flex h-20 items-center justify-between gap-4">
          <Link href="/" aria-label="Sonique home">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                href={link.href}
                key={link.href}
                className={link.href === "/shop" ? "underline underline-offset-8" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <BagLink />
            <details className="mobile-menu md:hidden">
              <summary aria-label="Open navigation">
                <Menu size={25} />
              </summary>
              <nav aria-label="Mobile navigation">
                {navLinks.map((link) => (
                  <Link href={link.href} key={link.href}>{link.label}</Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>
      <div className="paper-section flex-1">{children}</div>
      <footer className="bg-ink py-10 text-cream">
        <div className="shell flex flex-col justify-between gap-6 text-sm text-cream/60 md:flex-row">
          <p>Questions about an order? Ask at the bar on Getathuru Road, or message @cafe_sonique.</p>
          <p className="text-xs uppercase tracking-[0.14em] text-cream/35">© 2026 Sonique</p>
        </div>
      </footer>
    </div>
  );
}
