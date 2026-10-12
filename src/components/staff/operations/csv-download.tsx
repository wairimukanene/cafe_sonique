"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";

export function CsvDownload({
  filename,
  rows,
}: {
  filename: string;
  rows: Array<Record<string, string | number | null>>;
}) {
  const href = useMemo(() => {
    if (!rows.length) return "";
    const headings = Object.keys(rows[0]);
    const escape = (value: string | number | null) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      headings.map(escape).join(","),
      ...rows.map((row) => headings.map((heading) => escape(row[heading])).join(",")),
    ].join("\n");
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [rows]);

  return (
    <a
      aria-disabled={!href}
      className="staff-secondary-button"
      download={filename}
      href={href || undefined}
    >
      <Download size={17} /> Download CSV
    </a>
  );
}
