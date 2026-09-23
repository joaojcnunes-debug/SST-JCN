"use client";

import { useMemo, useState } from "react";
import { Search, Users, KanbanSquare, Loader2 } from "lucide-react";
import { iniciais, corAvatar } from "@/lib/hooks/useGestao";
import { useColaboradores, useAbrirQuadroPessoal } from "@/lib/hooks/useGestaoAcesso";

/**
 * "Colaboradores" (GESTAO-EQUIPES-01): lista dos colaboradores que o usuário pode acompanhar —
 * gestor vê todos os membros do módulo; supervisor vê os membros das equipes que supervisiona
 * (o filtro é do servidor: RPC gestao_colaboradores_visiveis). Busca por nome/e-mail/equipe e
 * clique abre o Meu Quadro daquela pessoa (criado sob demanda pelo RPC gestao_quadro_pessoal_de).
 */
export default function ColaboradoresView({ onAbrirQuadro }: { onAbrirQuadro: (idQuadro: string, nome: string) => void }) {
  const { data: colaboradores = [], isLoading } = useColaboradores();
  const abrir = useAbrirQuadroPessoal();
  const [busca, setBusca] = useState("");
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return colaboradores.filter((c) => !q || (c.nome ?? "").toLowerCase().includes(q) || c.usuario_email.toLowerCase().includes(q) || c.equipes.some((e) => e.toLowerCase().includes(q)));
  }, [colaboradores, busca]);

  async function abrirDe(email: string, nome: string) {
    setAbrindo(email);
    try { const id = await abrir.mutateAsync(email); onAbrirQuadro(id, nome); } finally { setAbrindo(null); }
  }

  return (
    <div className="mt-4">
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar colaborador (nome, e-mail, equipe)…" className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-verde-primary focus:outline-none" />
      </div>
      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-400"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
      ) : colaboradores.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">Nenhum colaborador visível. Supervisores veem os membros das equipes que supervisionam; gestores veem todos.</div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((c) => {
            const nome = c.nome ?? c.usuario_email;
            return (
              <button key={c.usuario_email} type="button" disabled={abrindo === c.usuario_email} onClick={() => abrirDe(c.usuario_email, nome)} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-verde-primary/50 hover:shadow-md disabled:opacity-60">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: corAvatar(nome) }}>{iniciais(nome)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">{nome}</span>
                  <span className="block truncate text-[11px] text-gray-400">{c.usuario_email}</span>
                  {c.equipes.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">{c.equipes.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-verde-light px-1.5 py-0.5 text-[10px] font-medium text-verde-primary"><Users className="size-2.5" />{e}</span>)}</span>
                  )}
                </span>
                {abrindo === c.usuario_email ? <Loader2 className="size-4 animate-spin text-gray-400" /> : <KanbanSquare className="size-4 shrink-0 text-gray-300" />}
              </button>
            );
          })}
          {lista.length === 0 && <p className="text-sm text-gray-400">Ninguém com “{busca}”.</p>}
        </div>
      )}
    </div>
  );
}
