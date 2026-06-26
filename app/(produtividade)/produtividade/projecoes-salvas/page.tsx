"use client";

import { useState } from "react";
import {
  AlertTriangle, BookMarked, Calendar, ChevronDown, ChevronUp,
  FileText, Globe, MapPin, MessageSquare, StickyNote, Trash2, Wrench,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useProdProjecoesSalvas,
  useDeleteProjecao,
  type ProdProjecaoSalva,
} from "@/lib/hooks/useProdutividade";
import { useCanDelete } from "@/lib/hooks/useUsuario";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {children}
    </span>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────

function ProjecaoCard({ p }: { p: ProdProjecaoSalva }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canDelete = useCanDelete();
  const deleteMutation = useDeleteProjecao();

  const semanas = Math.round(p.dias_uteis / 5);
  const temDeficit = (p.adms_adicionais ?? 0) > 0 || (p.tecs_adicionais ?? 0) > 0;

  async function handleDelete() {
    await deleteMutation.mutateAsync(p.id);
    toast.success("Projeção excluída.");
    setConfirmDelete(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-gray-900 truncate">{p.titulo}</h3>
            {p.tipo === "geral" ? (
              <Badge color="bg-teal-100 text-teal-700"><Globe className="size-3" /> Geral</Badge>
            ) : (
              <Badge color="bg-purple-100 text-purple-700"><MapPin className="size-3" /> {p.nome_unidade ?? "Por Unidade"}</Badge>
            )}
            {temDeficit ? (
              <Badge color="bg-red-100 text-red-700"><AlertTriangle className="size-3" /> Déficit</Badge>
            ) : (p.total_clientes ?? 0) > 0 ? (
              <Badge color="bg-green-100 text-green-700">Equipe OK</Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" /> {formatDateTime(p.criado_em)}
            </span>
            <span>{p.dias_uteis} dias úteis ≈ {semanas} semanas</span>
            <span>{p.adms_atuais} ADMs + {p.tecnicos_atuais} técnicos</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            title="Expandir"
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {canDelete && (confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                {deleteMutation.isPending ? "..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg p-2 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
              title="Excluir"
            >
              <Trash2 className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Métricas resumidas */}
      <div className="border-t border-gray-50 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-50">
        {[
          { label: "Total Clientes",   value: p.total_clientes,    color: "text-gray-800" },
          { label: "Pend. Inspeção",   value: p.pend_inspecao,     color: "text-orange-600" },
          { label: "Pend. Docs",       value: p.pend_docs,         color: "text-blue-600" },
          { label: "A Contratar",
            value: (p.adms_adicionais ?? 0) > 0 || (p.tecs_adicionais ?? 0) > 0
              ? `+${p.adms_adicionais ?? 0} ADM / +${p.tecs_adicionais ?? 0} téc.`
              : "Nenhum",
            color: temDeficit ? "text-red-600 text-sm font-bold" : "text-green-600" },
        ].map((m) => (
          <div key={m.label} className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{m.label}</p>
            <p className={`mt-0.5 text-base font-bold ${m.color}`}>{m.value ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50/50">

          {/* Parâmetros */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Parâmetros</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Dias úteis",          value: p.dias_uteis },
                { label: "ADMs atuais",          value: p.adms_atuais },
                { label: "Técnicos atuais",      value: p.tecnicos_atuais },
                { label: "Docs/ADM/dia",         value: p.docs_por_adm_dia },
                { label: "Insp./técnico/dia",    value: p.insp_por_tec_dia },
              ].map((x) => (
                <div key={x.label} className="rounded-lg bg-white px-3 py-2 ring-1 ring-black/5 text-xs">
                  <span className="text-gray-400">{x.label}:</span>{" "}
                  <span className="font-semibold text-gray-800">{x.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resultado */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Resultado</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className={`rounded-lg px-3 py-2 text-xs ${(p.adms_adicionais ?? 0) > 0 ? "bg-red-50 ring-1 ring-red-200" : "bg-green-50 ring-1 ring-green-200"}`}>
                <p className="flex items-center gap-1 text-gray-500"><FileText className="size-3 text-blue-500" /> ADMs necessários</p>
                <p className="mt-0.5 font-bold text-gray-900">{p.adms_necessarios ?? "—"} total</p>
                {(p.adms_adicionais ?? 0) > 0 && (
                  <p className="text-red-600 font-semibold">+{p.adms_adicionais} a contratar</p>
                )}
              </div>
              <div className={`rounded-lg px-3 py-2 text-xs ${(p.tecs_adicionais ?? 0) > 0 ? "bg-red-50 ring-1 ring-red-200" : "bg-green-50 ring-1 ring-green-200"}`}>
                <p className="flex items-center gap-1 text-gray-500"><Wrench className="size-3 text-orange-500" /> Técnicos necessários</p>
                <p className="mt-0.5 font-bold text-gray-900">{p.tecs_necessarios ?? "—"} total</p>
                {(p.tecs_adicionais ?? 0) > 0 && (
                  <p className="text-red-600 font-semibold">+{p.tecs_adicionais} a contratar</p>
                )}
              </div>
            </div>
          </div>

          {/* Dados por unidade */}
          {Object.keys(p.dados_unidades).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Dados por Unidade</p>
              <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-black/5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] uppercase text-gray-400">
                      <th className="px-4 py-2 text-left">Unidade ID</th>
                      <th className="px-4 py-2 text-right">Clientes</th>
                      <th className="px-4 py-2 text-right text-orange-500">Pend. Inspeção</th>
                      <th className="px-4 py-2 text-right text-blue-500">Pend. Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Object.entries(p.dados_unidades).map(([id, d]) => (
                      <tr key={id}>
                        <td className="px-4 py-2 font-mono text-gray-500 text-[10px]">{id}</td>
                        <td className="px-4 py-2 text-right">{d.totalClientes}</td>
                        <td className="px-4 py-2 text-right text-orange-600">{d.pendInspecao}</td>
                        <td className="px-4 py-2 text-right text-blue-600">{d.pendDocs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Observação e Comentários */}
          {p.observacao && (
            <div className="rounded-lg bg-yellow-50 ring-1 ring-yellow-200 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-yellow-700 mb-1.5">
                <StickyNote className="size-3.5" /> Observação
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.observacao}</p>
            </div>
          )}
          {p.comentarios && (
            <div className="rounded-lg bg-blue-50 ring-1 ring-blue-200 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-700 mb-1.5">
                <MessageSquare className="size-3.5" /> Comentários
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.comentarios}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function ProjecoesSalvasPage() {
  const { data: projecoes = [], isLoading } = useProdProjecoesSalvas();
  const [filtro, setFiltro] = useState<"todas" | "geral" | "por_unidade">("todas");

  const filtradas = projecoes.filter((p) => {
    if (filtro === "geral") return p.tipo === "geral";
    if (filtro === "por_unidade") return p.tipo === "por_unidade";
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BookMarked className="size-6 text-teal-600" /> Projeções Salvas
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Histórico de projeções de necessidade de equipe salvas
          </p>
        </div>
        <div className="flex gap-2">
          {(["todas", "geral", "por_unidade"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filtro === f ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {f === "todas" ? "Todas" : f === "geral" ? "Gerais" : "Por Unidade"}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-gray-400">Carregando...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
          <BookMarked className="mx-auto mb-3 size-10 text-gray-200" />
          <p className="font-semibold text-gray-500">Nenhuma projeção salva</p>
          <p className="mt-1 text-sm text-gray-400">
            Acesse <strong>Projeções</strong> para criar e salvar uma nova projeção.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">{filtradas.length} projeç{filtradas.length === 1 ? "ão" : "ões"} encontrada{filtradas.length === 1 ? "" : "s"}</p>
          {filtradas.map((p) => (
            <ProjecaoCard key={p.id} p={p} />
          ))}
        </div>
      )}

    </div>
  );
}
