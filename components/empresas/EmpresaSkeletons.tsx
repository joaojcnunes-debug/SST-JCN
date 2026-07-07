// Skeletons ESTRUTURAIS do módulo Empresas — espelham o layout real para a
// transição de página aterrissar na estrutura (sem "pulo" quando os dados chegam).
// Presentational puro (sem hooks) → serve tanto no loading.tsx (server) quanto
// no estado isLoading da página (client).

/** Espelha o detalhe da empresa: Voltar + cabeçalho rico + abas + KPIs + card. */
export function EmpresaDetalheSkeleton() {
  return (
    <div className="space-y-5">
      {/* Voltar */}
      <div className="skeleton-shimmer h-4 w-20" />

      {/* Cabeçalho rico */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="skeleton-shimmer size-12 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <div className="skeleton-shimmer h-7 w-56 rounded" />
              <div className="skeleton-shimmer h-4 w-40 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="skeleton-shimmer h-4 w-24 rounded-full" />
                <div className="skeleton-shimmer h-4 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="skeleton-shimmer h-7 w-28 rounded-md" />
            <div className="skeleton-shimmer h-7 w-20 rounded-md" />
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-4 border-b border-gray-200 pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-4 w-24 rounded" />
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-20 rounded-xl" />
        ))}
      </div>

      {/* Card de conteúdo */}
      <div className="skeleton-shimmer h-32 rounded-xl" />
    </div>
  );
}

/** Espelha a lista de empresas: barra de busca/filtro + grid de cards. */
export function EmpresaListaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="skeleton-shimmer h-11 max-w-md flex-1 rounded-xl" />
        <div className="skeleton-shimmer h-11 w-40 rounded-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-44 rounded-2xl" style={{ opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    </div>
  );
}
