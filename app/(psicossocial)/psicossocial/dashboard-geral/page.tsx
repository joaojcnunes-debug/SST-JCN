"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ArrowRight,
  CircleDashed,
  Activity,
  CheckCircle2,
  Send,
  Building2,
  MapPin,
  Search,
  X,
} from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  useDrpsRelatoriosGeral,
  useDrpsMoverStatus,
  type DrpsRelatorioComEmpresa,
} from "@/lib/hooks/useDrps";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useTema } from "@/lib/store";
import { fmtData, formatCNPJ } from "@/lib/utils";
import type { StatusRelatorio } from "@/lib/drps/types";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";

type StatusColuna = Extract<
  StatusRelatorio,
  "RASCUNHO" | "EM_ANDAMENTO" | "CONCLUIDO" | "ENVIADO_CLIENTE"
>;

interface ColunaConfig {
  status: StatusColuna;
  titulo: string;
  descricao: string;
  /** Cor forte. Vale nos DOIS temas: é o fundo da pílula de contagem, que
   *  leva texto branco — clareá-la no escuro quebraria essa leitura. */
  cor: string;
  bg: string;
  border: string;
  /** Só no escuro: o cabeçalho da coluna é claro por fora (bg/border) e o
   *  título/ícone precisam clarear junto, senão somem no fundo escuro.
   *  Os valores do tema claro acima ficam intocados. */
  escuro: { bg: string; border: string; texto: string };
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
    escuro: { bg: "#212d26", border: "#33403a", texto: "#a3b1aa" },
    Icone: CircleDashed,
  },
  {
    status: "EM_ANDAMENTO",
    titulo: "Em andamento",
    descricao: "Coleta ou análise em curso",
    cor: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
    escuro: { bg: "#2e2617", border: "#5c4a1e", texto: "#f0b45f" },
    Icone: Activity,
  },
  {
    status: "CONCLUIDO",
    titulo: "Concluídos",
    descricao: "Análises finalizadas pelo psicólogo",
    cor: "#15803d",
    bg: "#f0fdf4",
    border: "#86efac",
    escuro: { bg: "#16301f", border: "#2c5c3c", texto: "#63d18f" },
    Icone: CheckCircle2,
  },
  {
    status: "ENVIADO_CLIENTE",
    titulo: "Enviados para clientes",
    descricao: "Relatórios entregues ao cliente",
    cor: "#4338ca",
    bg: "#eef2ff",
    border: "#c7d2fe",
    escuro: { bg: "#1e2036", border: "#3a3f6b", texto: "#9aa0f5" },
    Icone: Send,
  },
];

export default function DashboardGeralPage() {
  const { data: relatorios = [], isLoading } = useDrpsRelatoriosGeral();
  const podeEditar = useCanEdit();
  const mover = useDrpsMoverStatus();

  // Cópia local para mover de forma otimista (sincronizada com o servidor).
  const [items, setItems] = useState<DrpsRelatorioComEmpresa[]>(relatorios);
  useEffect(() => setItems(relatorios), [relatorios]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAlvo, setDropAlvo] = useState<StatusColuna | null>(null);

  const porStatus = useMemo(() => {
    const map: Record<string, DrpsRelatorioComEmpresa[]> = {
      RASCUNHO: [],
      EM_ANDAMENTO: [],
      CONCLUIDO: [],
      ENVIADO_CLIENTE: [],
    };
    for (const r of items) {
      if (map[r.status]) map[r.status].push(r);
    }
    return map;
  }, [items]);

  const empresasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const r of items) set.add(r.id_empresa);
    return set.size;
  }, [items]);

  function soltar(status: StatusColuna) {
    const id = dragId;
    setDragId(null);
    setDropAlvo(null);
    if (!id) return;
    const r = items.find((x) => x.id_relatorio === id);
    if (!r || r.status === status) return;
    setItems((arr) =>
      arr.map((x) => (x.id_relatorio === id ? { ...x, status } : x))
    );
    mover.mutate({ id_relatorio: id, status });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard Geral</h1>
        <p className="text-sm text-gray-600">
          Visão consolidada do status dos relatórios DRPS por empresa.
          {!isLoading && (
            <>
              {" "}
              <strong>{items.length}</strong> relatório(s) em{" "}
              <strong>{empresasUnicas}</strong> empresa(s).
            </>
          )}
          {podeEditar && (
            <span className="text-gray-400">
              {" "}
              · Arraste um cartão entre as colunas para mudar o status.
            </span>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <LoadingSkeleton rows={5} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((c) => (
            <Coluna
              key={c.status}
              config={c}
              items={porStatus[c.status] ?? []}
              podeEditar={podeEditar}
              arrastando={dragId !== null}
              ativo={dropAlvo === c.status}
              onDragStartCard={(id) => setDragId(id)}
              onDragEndCard={() => {
                setDragId(null);
                setDropAlvo(null);
              }}
              onDragOverColuna={() => setDropAlvo(c.status)}
              onDropColuna={() => soltar(c.status)}
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
  podeEditar,
  arrastando,
  ativo,
  onDragStartCard,
  onDragEndCard,
  onDragOverColuna,
  onDropColuna,
}: {
  config: ColunaConfig;
  items: DrpsRelatorioComEmpresa[];
  podeEditar: boolean;
  arrastando: boolean;
  ativo: boolean;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onDragOverColuna: () => void;
  onDropColuna: () => void;
}) {
  const router = useRouter();
  const { titulo, descricao, cor, Icone } = config;
  const noEscuro = useTema((s) => s.tema) === "dark";
  const bg     = noEscuro ? config.escuro.bg     : config.bg;
  const border = noEscuro ? config.escuro.border : config.border;
  const corTexto = noEscuro ? config.escuro.texto : cor;

  // Filtro de busca por coluna (empresa, cidade, CNPJ ou responsável).
  const [busca, setBusca] = useState("");
  // Busca tolerante (acento, ordem das palavras, erro de digitação); CNPJ pelos dígitos. Mantém a ordem.
  const { itens: visiveis, aproximado } = useMemo(
    () =>
      buscar(items, busca, (r) => [r.empresa_nome, r.responsavel_tecnico, r.empresa_municipio], {
        codigos: (r) => [r.empresa_cnpj],
        manterOrdem: true,
      }),
    [items, busca],
  );

  return (
    <section
      className="flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow"
      style={{
        borderColor: ativo ? cor : border,
        boxShadow: ativo ? `0 0 0 2px ${cor}` : undefined,
      }}
      onDragOver={
        podeEditar
          ? (e) => {
              e.preventDefault();
              onDragOverColuna();
            }
          : undefined
      }
      onDrop={
        podeEditar
          ? (e) => {
              e.preventDefault();
              onDropColuna();
            }
          : undefined
      }
    >
      <header
        className="flex items-start justify-between gap-2 border-b px-4 py-3"
        style={{ backgroundColor: bg, borderColor: border }}
      >
        <div className="flex items-start gap-2">
          <Icone className="mt-0.5 size-5" style={{ color: corTexto }} />
          <div>
            <h2
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: corTexto }}
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
          {busca.trim() ? `${visiveis.length}/${items.length}` : items.length}
        </span>
      </header>

      {items.length > 0 && (
        <div className="border-b border-gray-100 px-2 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar empresa, cidade, CNPJ ou responsável…"
              aria-label={`Filtrar ${titulo}`}
              className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-7 text-xs focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar filtro"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div
          className={`flex flex-1 items-center justify-center p-6 text-center text-xs italic ${
            ativo ? "text-gray-500" : "text-gray-400"
          }`}
        >
          {arrastando && podeEditar
            ? "Solte aqui"
            : "Nenhum relatório nesse status."}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs italic text-gray-400">
          Nenhuma empresa encontrada.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-gray-100 overflow-auto">
          {aproximado && (
            <li>
              <AvisoBuscaAproximada aproximado busca={busca} total={visiveis.length} compacto />
            </li>
          )}
          {visiveis.map((r) => (
            <li key={r.id_relatorio}>
              <div
                role="button"
                tabIndex={0}
                draggable={podeEditar}
                onDragStart={() => onDragStartCard(r.id_relatorio)}
                onDragEnd={onDragEndCard}
                onClick={() =>
                  router.push(`/psicossocial/${r.id_relatorio}/dashboard`)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/psicossocial/${r.id_relatorio}/dashboard`);
                  }
                }}
                className={`block px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                  podeEditar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
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
                    {r.empresa_municipio && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">
                          {[r.empresa_municipio, r.empresa_uf]
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      </div>
                    )}
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
                  <ArrowRight className="size-4 shrink-0 text-gray-400" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
