// Skeletons ESTRUTURAIS genéricos, reutilizáveis entre módulos — para a transição
// de página aterrissar na estrutura (não em barras chapadas), sem "pulo" quando os
// dados chegam. Presentational puro (sem hooks) → serve em loading.tsx e no isLoading.

/** Página de detalhe: Voltar + cabeçalho rico + abas + KPIs + bloco de conteúdo. */
export function DetalheSkeleton() {
  return (
    <div className="space-y-5">
      <div className="skeleton-shimmer h-4 w-20" />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="skeleton-shimmer size-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-shimmer h-7 w-56 rounded" />
            <div className="skeleton-shimmer h-4 w-40 rounded" />
            <div className="flex gap-2 pt-1">
              <div className="skeleton-shimmer h-4 w-24 rounded-full" />
              <div className="skeleton-shimmer h-4 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-gray-200 pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-4 w-24 rounded" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-20 rounded-xl" />
        ))}
      </div>

      <div className="skeleton-shimmer h-32 rounded-xl" />
    </div>
  );
}

/** Editor/detalhe sem abas: Voltar + cabeçalho com ações + dois blocos de conteúdo. */
export function EditorSkeleton() {
  return (
    <div className="space-y-5">
      <div className="skeleton-shimmer h-4 w-20" />
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="skeleton-shimmer h-7 w-64 rounded" />
            <div className="skeleton-shimmer h-4 w-44 rounded" />
          </div>
          <div className="flex gap-1.5">
            <div className="skeleton-shimmer h-8 w-24 rounded-md" />
            <div className="skeleton-shimmer h-8 w-24 rounded-md" />
          </div>
        </div>
      </div>
      <div className="skeleton-shimmer h-40 rounded-xl" />
      <div className="skeleton-shimmer h-64 rounded-xl" />
    </div>
  );
}

/** Lista de linhas (ícone + 2 textos) — espelha listas em <li>/cards de linha.
    `bare` remove a borda/fundo (para usar dentro de um card já existente). */
export function LinhasSkeleton({ linhas = 5, bare = false }: { linhas?: number; bare?: boolean }) {
  return (
    <div className={bare ? "divide-y divide-gray-100" : "divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white"}>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ opacity: 1 - i * 0.08 }}>
          <div className="skeleton-shimmer size-4 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton-shimmer h-3.5 w-1/2 rounded" />
            <div className="skeleton-shimmer h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tabela/lista: cabeçalho + N linhas (espelha listas em tabela). */
export function TabelaSkeleton({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="space-y-2.5">
      <div className="skeleton-shimmer h-9 w-full rounded-lg" />
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-12 w-full rounded" style={{ opacity: 1 - i * 0.06 }} />
      ))}
    </div>
  );
}

/** Dashboard: linha de KPIs + dois blocos de gráfico + tabela recente. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton-shimmer h-64 rounded-2xl lg:col-span-2" />
        <div className="skeleton-shimmer h-64 rounded-2xl" />
      </div>
      <div className="skeleton-shimmer h-56 rounded-2xl" />
    </div>
  );
}

/** Página de gráfico/relatório: cabeçalho + bloco de gráfico + tabela. */
export function GraficoPageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="skeleton-shimmer h-7 w-64 rounded" />
      <div className="skeleton-shimmer h-64 rounded-2xl" />
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <TabelaSkeleton linhas={5} />
      </div>
    </div>
  );
}

/** Página de lista completa (com barra de busca) — para loading.tsx de rotas de lista. */
export function ListaSkeleton({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="skeleton-shimmer h-11 max-w-md flex-1 rounded-xl" />
        <div className="skeleton-shimmer h-11 w-40 rounded-xl" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <TabelaSkeleton linhas={linhas} />
      </div>
    </div>
  );
}
