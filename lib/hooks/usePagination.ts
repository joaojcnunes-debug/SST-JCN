"use client";

import { useEffect, useMemo, useState } from "react";

interface UsePaginationOptions<T> {
  data: T[];
  pageSize?: number;
  resetKey?: unknown; // muda → volta pra página 1 (ex.: filtro/empresa selecionada)
}

export function usePagination<T>({
  data,
  pageSize = 20,
  resetKey,
}: UsePaginationOptions<T>) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  // Garante que `page` permaneça válido se a lista encolher.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  return {
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems: data.length,
    pageSize,
    showPagination: data.length > pageSize,
  };
}
