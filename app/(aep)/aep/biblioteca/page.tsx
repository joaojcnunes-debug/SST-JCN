"use client";

// Biblioteca psicossocial (v272): os 13 fatores com descrição do risco, danos
// à saúde, fontes geradoras, meio de propagação, situação/tempo de exposição,
// sugestões iniciais e ações. Todos leem; só o Admin edita (decisão de
// 2026-10-06 — o RT pede a alteração). Única para o sistema: a AEP usa hoje,
// o DRPS/QPS podem usar depois. Lida pelo editor, laudo, PDF, inventário e IA.

import { useState } from "react";
import { BookMarked, ChevronDown, Loader2, Save } from "lucide-react";
import { useBibliotecaPsi, useSalvarFatorBiblioteca } from "@/lib/hooks/useBibliotecaPsi";
import { useIsAdmin } from "@/lib/hooks/useUsuario";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import type { FatorBiblioteca, FonteGeradora } from "@/lib/aep/biblioteca";
import { cn, fmtData } from "@/lib/utils";

const linhas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

/** "1.3 — Texto" por linha ↔ fontes. Linha sem código ganha o próximo número. */
function fontesDeTexto(t: string, ordem: number): FonteGeradora[] {
  let n = 0;
  return linhas(t).map((l) => {
    const m = l.match(/^(\d+\.\d+)\s*[—–-]\s*(.+)$/);
    n += 1;
    return m ? { codigo: m[1], texto: m[2].trim() } : { codigo: `${ordem}.${n}`, texto: l };
  });
}

function EditorFator({ f, podeEditar }: { f: FatorBiblioteca; podeEditar: boolean }) {
  const salvar = useSalvarFatorBiblioteca();
  const [v, setV] = useState({
    descricao_risco: f.descricao_risco,
    danos_saude: f.danos_saude,
    meio_propagacao: f.meio_propagacao,
    situacao_padrao: f.situacao_padrao,
    tempo_exposicao_padrao: f.tempo_exposicao_padrao,
    medidas_controle_verificar: f.medidas_controle_verificar,
    fontes: f.fontes_geradoras.map((x) => `${x.codigo} — ${x.texto}`).join("\n"),
    sugestoes: f.sugestoes_iniciais.join("\n"),
    acoes: f.acoes.join("\n"),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));
  const cls =
    "w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50";
  const campo = (label: string, k: keyof typeof v, rows = 2, dica?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label} {dica && <span className="font-normal text-gray-400">({dica})</span>}
      </span>
      {rows === 1 ? (
        <input disabled={!podeEditar} value={v[k]} onChange={set(k)} className={cls} />
      ) : (
        <textarea disabled={!podeEditar} rows={rows} value={v[k]} onChange={set(k)} className={cls} />
      )}
    </label>
  );
  return (
    <div className="space-y-3 border-t border-gray-100 p-4">
      {campo("Descrição do risco", "descricao_risco", 3)}
      {campo("Danos à saúde", "danos_saude", 3)}
      <div className="grid gap-3 sm:grid-cols-3">
        {campo("Meio de propagação", "meio_propagacao", 1)}
        {campo("Situação padrão", "situacao_padrao", 1)}
        {campo("Tempo de exposição padrão", "tempo_exposicao_padrao", 1)}
      </div>
      {campo("Medidas de controle a verificar em campo", "medidas_controle_verificar", 2)}
      {campo("Fontes geradoras", "fontes", 7, "uma por linha: código — texto")}
      <div className="grid gap-3 lg:grid-cols-2">
        {campo("Sugestões iniciais", "sugestoes", 5, "uma por linha")}
        {campo("Ações", "acoes", 5, "uma por linha")}
      </div>
      {podeEditar && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={salvar.isPending}
            onClick={() =>
              salvar.mutate({
                ...f,
                descricao_risco: v.descricao_risco.trim(),
                danos_saude: v.danos_saude.trim(),
                meio_propagacao: v.meio_propagacao.trim(),
                situacao_padrao: v.situacao_padrao.trim(),
                tempo_exposicao_padrao: v.tempo_exposicao_padrao.trim(),
                medidas_controle_verificar: v.medidas_controle_verificar.trim(),
                fontes_geradoras: fontesDeTexto(v.fontes, f.ordem),
                sugestoes_iniciais: linhas(v.sugestoes),
                acoes: linhas(v.acoes),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar fator
          </button>
        </div>
      )}
    </div>
  );
}

export default function BibliotecaPsiPage() {
  const { data: bib, isLoading } = useBibliotecaPsi();
  const isAdmin = useIsAdmin();
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BookMarked className="size-5 text-emerald-600" /> Biblioteca psicossocial
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Conteúdo técnico dos 13 fatores organizacionais, usado no detalhamento do laudo da AEP, no inventário
          psicossocial (SGG) e pela IA, que escolhe as ações desta lista.{" "}
          {isAdmin ? "Edite com cuidado: vale para todas as análises." : "Somente o perfil Admin pode editar."}
        </p>
      </div>
      {isLoading && <div className="h-40 animate-pulse rounded-xl bg-gray-100" />}
      {ITENS_ORGANIZACIONAL.map(({ key, label }) => {
        const f = bib?.[key];
        if (!f) return null;
        const open = aberto === key;
        return (
          <div key={key} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setAberto(open ? null : key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {f.ordem}. {label}
                </p>
                <p className="text-xs text-gray-500">
                  {f.fontes_geradoras.length} fontes geradoras · {f.acoes.length} ações
                  {f.atualizado_por && ` · editado por ${f.atualizado_por} em ${fmtData(f.atualizado_em)}`}
                </p>
              </div>
              <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition", open && "rotate-180")} />
            </button>
            {open && <EditorFator key={f.atualizado_em ?? key} f={f} podeEditar={isAdmin} />}
          </div>
        );
      })}
    </div>
  );
}
