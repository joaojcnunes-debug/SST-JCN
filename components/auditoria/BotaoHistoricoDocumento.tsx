"use client";

// Aba "Histórico" do documento (Auditoria, Fase 3 — v259): botão que abre a
// linha do tempo de tudo que mudou no documento e nos itens dele (riscos,
// setores, ações, fotos…). O banco só entrega o que a pessoa pode ver: quem
// consegue abrir o documento vê o histórico dele.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { ACAO_CORES, DetalheEvento } from "@/components/auditoria/DetalheEvento";
import { useHistoricoDocumento, LIMITE_HISTORICO } from "@/lib/hooks/useAuditoriaEventos";
import { useUsuarios } from "@/lib/hooks/useGestao";
import { agruparPorDia, descreverEvento, ehConclusao, quemGravou } from "@/lib/auditoria/eventos";
import type { AuditoriaEvento } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/** As 13 tabelas-documento da v259 (auditoria_doc_regras). */
export type DocTabela =
  | "inspecoes"
  | "empresas"
  | "aet_relatorios"
  | "aep_relatorios"
  | "drps_relatorios"
  | "relatorios_conformidade"
  | "relatorios_nao_conformidade"
  | "apreciacoes_maquinas"
  | "analises_quimicos"
  | "qps_aplicacoes"
  | "investigacoes_acidente"
  | "equipamentos"
  | "frota_veiculos";

export default function BotaoHistoricoDocumento({
  docTabela,
  docId,
  className,
}: {
  docTabela: DocTabela;
  docId: string | null | undefined;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  if (!docId) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Quem criou, editou ou excluiu o quê neste documento"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 print:hidden",
          className,
        )}
      >
        <History className="size-4" /> Histórico
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title="Histórico do documento" size="xl">
        {aberto && <ConteudoHistorico docTabela={docTabela} docId={docId} />}
      </Modal>
    </>
  );
}

function ConteudoHistorico({ docTabela, docId }: { docTabela: DocTabela; docId: string }) {
  const { data: eventos = [], isLoading, error } = useHistoricoDocumento(docTabela, docId);
  const { data: usuarios = [] } = useUsuarios();
  const nomes = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);
  const grupos = useMemo(() => agruparPorDia(eventos), [eventos]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">Não foi possível ler o histórico: {(error as Error).message}</p>;
  }
  if (eventos.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        Nenhuma mudança registrada. A trilha começou em 14/09/2026 — o que foi feito antes disso não aparece aqui.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {eventos.length.toLocaleString("pt-BR")} mudança{eventos.length === 1 ? "" : "s"} no documento e nos itens dele, da mais recente para a mais antiga.
        A trilha começou em 14/09/2026.
        {eventos.length >= LIMITE_HISTORICO && ` Mostrando só as ${LIMITE_HISTORICO.toLocaleString("pt-BR")} mais recentes.`}
      </p>
      {grupos.map((g) => (
        <section key={g.dia}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {new Date(`${g.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </h3>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {g.eventos.map((ev) => (
              <LinhaHistorico key={ev.id} ev={ev} nomes={nomes} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LinhaHistorico({ ev, nomes }: { ev: AuditoriaEvento; nomes: ReadonlyMap<string, string> }) {
  const [aberto, setAberto] = useState(false);
  const hora = new Date(ev.ocorrido_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <li>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50"
        aria-expanded={aberto}
      >
        {aberto ? <ChevronDown className="mt-0.5 size-4 shrink-0 text-gray-400" /> : <ChevronRight className="mt-0.5 size-4 shrink-0 text-gray-400" />}
        <span className="mt-0.5 w-11 shrink-0 font-mono text-xs text-gray-500">{hora}</span>
        <span className="min-w-0 flex-1 text-sm text-gray-900">
          <span className="font-semibold">{quemGravou(ev, nomes)}</span>{" "}
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase", ACAO_CORES[ev.acao])}>{ev.acao}</span>{" "}
          {ehConclusao(ev) && (
            <span className="rounded-full bg-verde-light px-1.5 py-0.5 text-[10px] font-bold uppercase text-verde-primary">concluiu</span>
          )}{" "}
          {descreverEvento(ev).replace(/^(criou|editou|excluiu) /, "")}
        </span>
      </button>
      {aberto && <DetalheEvento ev={ev} />}
    </li>
  );
}
