"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
}: PaginationProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const pages = pageWindow(page, totalPages);

  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-600 sm:flex-row">
      <span>
        Mostrando <strong>{start}</strong>–<strong>{end}</strong> de{" "}
        <strong>{totalItems}</strong>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`gap-${idx}`} className="px-1.5 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                "min-w-[28px] rounded px-2 py-1 text-xs font-medium transition-colors",
                p === page
                  ? "bg-verde-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

// Janela "1 … 4 5 [6] 7 8 … 20"
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const result: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) result.push("…");
  for (let p = left; p <= right; p++) result.push(p);
  if (right < total - 1) result.push("…");
  result.push(total);
  return result;
}
