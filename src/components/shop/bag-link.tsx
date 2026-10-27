"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { useCartCount } from "./cart";

export function BagLink() {
  const count = useCartCount();
  return (
    <Link className="nav-pill inline-flex gap-2" href="/shop/bag" aria-label={`Bag, ${count} items`}>
      <ShoppingBag size={15} /> Bag{count ? ` (${count})` : ""}
    </Link>
  );
}
