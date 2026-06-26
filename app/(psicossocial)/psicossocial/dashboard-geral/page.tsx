"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  ArrowRight,
  CircleDashed,
  Activity,
  CheckCircle2,
  Building2,
  Send,
  GripVertical,
} from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  useDrpsRelatoriosGeral,
  useDrpsSalvarRelatorio,
  type DrpsRelatorioComEmpresa,
} from "@/lib/hooks/useDrps";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { fmtData, formatCNPJ } from "@/lib/utils";
import type { StatusRelatorio } from "@/lib/drps/types";

type StatusQuadro = Extract<
  StatusRelatorio,
  "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDO" | "ENVIADO_CLIENTE"
>;

interface ColunaConfig {
  status: StatusQuadro;
  titulo: string;
  descricao: string;
  cor: string;
  bg: string;
  border: string;
  Icone: typeof CircleDashed;
}

const COLUNAS: ColunaConfig[] = [
  {
    status: "RASCUNHO",
    titulo: "Rascunhos",
    descricao: "Relatórios criados ainda sem dados",
    cor: "#6b7280",
    bg: "#f3f4f6",
    border: "#d1d5db",
    Icone: CircleDashed,
  },
  {
    status: "EM_ANDAMENTO",
    titulo: "Em andamento",
    descricao: "Coleta ou análise em curso",
    cor: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
    Icone: Activity,
  },
  {
    status: "CONCLUIDO",
    titulo: "Concluídos",
    descricao: "Análises finalizadas pelo psicólogo",
    cor: "#15803d",
    bg: "#f0fdf4",
    border: "#86efac",
    Icone: CheckCircle2,
  },
  {
    status: "ENVIADO_CLIENTE",
    titulo: "Enviados para clientes",
    descricao: "Relatórios entregues ao cliente",
    cor: "#4f46e5",
    bg: "#eef2ff",
    border: "#c7d2fe",
    Icone: Send,
  },
];

const GERAL_KEY = ["drps-relatorios-geral"] as const;

export default function DashboardGeralPage() {
  const { data: relatorios = [], isLoading } = useDrpsRelatoriosGeral();
  const canEdit = useCanEdit();
  const router = useRouter();
  const qc = useQueryClient();
  const salvar = useDrpsSalvarRelatorio();

  const [dragId, setDragId] = useState<string | null>(null);
  const [colHover, setColHover] = useState<StatusQuadro | null>(null);

  const porStatus = useMemo(() => {
    const map: Record<string, DrpsRelatorioComEmpresa[]> = {
      RASCUNHO: [],
      EM_ANDAMENTO: [],
      CONCLUIDO: [],
      ENVIADO_CLIENTE: [],
    };
    for (const r of relatorios) {
      if (map[r.status]) map[r.status].push(r);
    }
    return map;
  }, [relatorios]);

  const empresasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const r of relatorios) set.add(r.id_empresa);
    return set.size;
  }, [relatorios]);

  const mover = useCallback(
    (idRelatorio: string, novoStatus: StatusQuadro) => {
      const lista =
        qc.getQueryData<DrpsRelatorioComEmpresa[]>(GERAL_KEY) ?? relatorios;
      const alvo = lista.find((r) => r.id_relatorio === idRelatorio);
      if (!alvo || alvo.status === novoStatus) return;

      // Move otimista (feedback instantâneo, igual ao kanban da Gestão).
      qc.setQueryData<DrpsRelatorioComEmpresa[]>(GERAL_KEY, (old) =>
        (old ?? []).map((r) =>
          r.id_relatorio === idRelatorio
            ? { ...r, status: novoStatus, updated_at: new Date().toISOString() }
            : r
        )
      );

      const titulo =
        COLUNAS.find((c) => c.status === novoStatus)?.titulo ?? novoStatus;
      salvar.mutate(
        {
          id_relatorio: idRelatorio,
          id_empresa: alvo.id_empresa,
          status: novoStatus,
          _toast: `Movido para "${titulo}"`,
        },
        {
          // Reconcilia ordenação no sucesso; reverte o otimista no erro.
          onSettled: () => qc.invalidateQueries({ queryKey: GERAL_KEY }),
        }
      );
    },
    [qc, relatorios, salvar]
  );

  const soltarNaColuna = useCallback(
    (status: StatusQuadro) => {
      if (dragId) mover(dragId, status);
      setDragId(null);
      setColHover(null);
    },
    [dragId, mover]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard Geral</h1>
        <p className="text-sm text-gray-600">
          Visão consolidada do status dos relatórios DRPS por empresa.
          {!isLoading && (
            <>
              {" "}
              <strong>{relatorios.length}</strong> relatório(s) em{" "}
              <strong>{empresasUnicas}</strong> empresa(s).
            </>
          )}
          {canEdit && (
            <span className="text-gray-400">
              {" "}
              Arraste um card para mover entre os quadros.
            </span>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={5} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((c) => (
            <Coluna
              key={c.status}
              config={c}
              items={porStatus[c.status] ?? []}
              canEdit={canEdit}
              arrastando={dragId !== null}
              hover={colHover === c.status}
              onAbrir={(id) => router.push(`/psicossocial/${id}/dashboard`)}
              onCardDragStart={(id) => setDragId(id)}
              onCardDragEnd={() => {
                setDragId(null);
                setColHover(null);
              }}
              onColEnter={() => {
                if (dragId) setColHover(c.status);
              }}
              onColLeave={() =>
                setColHover((s) => (s === c.status ? null : s))
              }
              onSoltar={() => soltarNaColuna(c.status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Coluna({
  config,
  items,
  canEdit,
  arrastando,
  hover,
  onAbrir,
  onCardDragStart,
  onCardDragEnd,
  onColEnter,
  onColLeave,
  onSoltar,
}: {
  config: ColunaConfig;
  items: DrpsRelatorioComEmpresa[];
  canEdit: boolean;
  arrastando: boolean;
  hover: boolean;
  onAbrir: (idRelatorio: string) => void;
  onCardDragStart: (idRelatorio: string) => void;
  onCardDragEnd: () => void;
  onColEnter: () => void;
  onColLeave: () => void;
  onSoltar: () => void;
}) {
  const { titulo, descricao, cor, bg, border, Icone } = config;

  const dropProps = canEdit
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (arrastando) {
            e.preventDefault();
            onColEnter();
          }
        },
        onDragLeave: (e: React.DragEvent) => {
          if (
            arrastando &&
            !e.currentTarget.contains(e.relatedTarget as Node)
          ) {
            onColLeave();
          }
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          onSoltar();
        },
      }
    : {};

  return (
    <section
      {...dropProps}
      className={`flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        hover ? "ring-2 ring-verde-primary/30" : ""
      }`}
      style={{ borderColor: hover ? "var(--color-verde-primary)" : border }}
    >
      <header
        className="flex items-start justify-between gap-2 border-b px-4 py-3"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        <div className="flex items-start gap-2">
          <Icone className="mt-0.5 size-5" style={{ color: cor }} />
          <div>
            <h2
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: cor }}
            >
              {titulo}
            </h2>
            <p className="text-[10px] text-gray-600">{descricao}</p>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: cor }}
        >
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <div
          className={`flex flex-1 items-center justify-center p-6 text-center text-xs italic ${
            arrastando && canEdit
              ? "m-2 rounded-lg border-2 border-dashed border-gray-200 text-gray-400"
              : "text-gray-400"
          }`}
        >
          {arrastando && canEdit ? "Solte aqui" : "Nenhum relatório nesse status."}
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-gray-100 overflow-auto">
          {items.map((r) => (
            <li key={r.id_relatorio}>
              <div
                role="button"
                tabIndex={0}
                draggable={canEdit}
                onClick={() => onAbrir(r.id_relatorio)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAbrir(r.id_relatorio);
                  }
                }}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", r.id_relatorio);
                  e.dataTransfer.effectAllowed = "move";
                  onCardDragStart(r.id_relatorio);
                }}
                onDragEnd={onCardDragEnd}
                className={`block w-full px-4 py-3 text-left hover:bg-gray-50 ${
                  canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <Building2 className="size-3" />
                      <span className="truncate">{r.empresa_nome ?? "—"}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-mono text-gray-700">
                      {r.empresa_cnpj ? formatCNPJ(r.empresa_cnpj) : "—"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <FileText className="size-3.5 text-verde-primary" />
                      <strong className="text-verde-primary">
                        Rev. {r.revisao}
                      </strong>
                      {r.data_elaboracao && (
                        <span className="text-gray-500">
                          ·{" "}
                          {new Date(
                            r.data_elaboracao + "T00:00:00"
                          ).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                    {r.responsavel_tecnico && (
                      <p className="mt-0.5 truncate text-[11px] text-gray-600">
                        {r.responsavel_tecnico}
                        {r.crp && (
                          <span className="text-gray-400"> · CRP {r.crp}</span>
                        )}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      Atualizado em {fmtData(r.updated_at ?? r.created_at)}
                    </p>
                  </div>
                  {canEdit ? (
                    <GripVertical className="size-4 shrink-0 text-gray-300" />
                  ) : (
                    <ArrowRight className="size-4 shrink-0 text-gray-400" />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
