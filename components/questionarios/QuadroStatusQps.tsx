"use client";

// QPS — quadro de status das aplicações, na tela de Resumo.
//
// É o mesmo quadro do Dashboard Geral do DRPS (Psicossocial › Dashboard
// Geral), pedido por ele em 2026-09-10 para a área de Questionários. As cores,
// os ícones e o comportamento de arrastar são de propósito idênticos: são as
// duas telas de carteira do painel, e quem aprende uma tem de reconhecer a
// outra na hora.
//
// ⚠️ NÃO é a mesma informação que a faixa "Onde o trabalho está", logo abaixo
// dela na tela. Aqui está o status DECLARADO — alguém arrastou o cartão ou
// apertou "avançar". Lá está a etapa DEDUZIDA do que existe na aplicação
// (respondente importado, ação de plano). As duas discordam quando o trabalho
// andou e ninguém mexeu no status, e essa discordância é informação, não
// defeito. Ver `lib/qps/etapa.ts`.
//
// A coluna "Enviados para clientes" depende da migration **v206**: antes dela
// o banco recusa o valor com 23514 e o cartão volta sozinho para a coluna de
// origem. O aviso vem de `useQpsMoverStatus`, que cita a v206 pelo nome.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  MapPin,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import { useQpsMoverStatus } from "@/lib/hooks/useQuestionarios";
import type { AplicacaoResumo } from "@/lib/hooks/useQpsResumo";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useTema } from "@/lib/store";
import { fmtData, formatCNPJ } from "@/lib/utils";
import type { StatusQpsAplicacao } from "@/lib/supabase/types";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";

type StatusColuna = Extract<
  StatusQpsAplicacao,
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
  /** Só no escuro: o cabeçalho é claro por fora (bg/border) e o título/ícone
   *  precisam clarear junto, senão somem no fundo escuro. Os valores do tema
   *  claro acima ficam intocados. */
  escuro: { bg: string; border: string; texto: string };
  Icone: typeof CircleDashed;
}

const COLUNAS: ColunaConfig[] = [
  {
    status: "RASCUNHO",
    titulo: "Rascunhos",
    descricao: "Aplicações criadas ainda sem coleta",
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
    descricao: "Resultados entregues ao cliente",
    cor: "#4338ca",
    bg: "#eef2ff",
    border: "#c7d2fe",
    escuro: { bg: "#1e2036", border: "#3a3f6b", texto: "#9aa0f5" },
    Icone: Send,
  },
];

export default function QuadroStatusQps({ linhas }: { linhas: AplicacaoResumo[] }) {
  const podeEditar = useCanEdit();
  const mover = useQpsMoverStatus();

  /**
   * O arrastar é otimista: o cartão muda de coluna na hora e a gravação vai
   * atrás. Guardamos só o status por id, não uma cópia das linhas — cada linha
   * carrega a matriz inteira da aplicação, e duplicar isso a cada arrasto seria
   * caro sem necessidade.
   *
   * O `useEffect` zera os desvios quando o servidor responde: a partir daí a
   * verdade é a dele. Se a gravação falhar, o refetch traz o status antigo e o
   * cartão volta — junto com o toast que explica por quê.
   */
  const [desvio, setDesvio] = useState<Record<string, StatusQpsAplicacao>>({});
  useEffect(() => setDesvio({}), [linhas]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAlvo, setDropAlvo] = useState<StatusColuna | null>(null);

  const porStatus = useMemo(() => {
    const map: Record<StatusColuna, AplicacaoResumo[]> = {
      RASCUNHO: [],
      EM_ANDAMENTO: [],
      CONCLUIDO: [],
      ENVIADO_CLIENTE: [],
    };
    const fora: AplicacaoResumo[] = [];
    for (const a of linhas) {
      const s = desvio[a.aplicacao.id_aplicacao] ?? a.aplicacao.status;
      if (
        s === "RASCUNHO" ||
        s === "EM_ANDAMENTO" ||
        s === "CONCLUIDO" ||
        s === "ENVIADO_CLIENTE"
      ) {
        map[s].push(a);
      } else {
        // Status que nenhuma coluna representa. Não some da tela em silêncio:
        // cartão que desaparece é pior que cartão em lugar estranho.
        fora.push(a);
      }
    }
    return { map, fora };
  }, [linhas, desvio]);

  const empresasUnicas = useMemo(
    () => new Set(linhas.map((a) => a.aplicacao.id_empresa)).size,
    [linhas],
  );

  function soltar(status: StatusColuna) {
    const id = dragId;
    setDragId(null);
    setDropAlvo(null);
    if (!id) return;
    const a = linhas.find((x) => x.aplicacao.id_aplicacao === id);
    if (!a) return;
    const atual = desvio[id] ?? a.aplicacao.status;
    if (atual === status) return;
    setDesvio((d) => ({ ...d, [id]: status }));
    mover.mutate({ id, idEmpresa: a.aplicacao.id_empresa, status });
  }

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Quadro de status
        </h2>
        <p className="text-sm text-gray-500">
          <strong>{linhas.length}</strong> aplicação(ões) em{" "}
          <strong>{empresasUnicas}</strong> empresa(s).
          {podeEditar && (
            <span className="text-gray-400">
              {" "}
              · Arraste um cartão entre as colunas para mudar o status.
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUNAS.map((c) => (
          <Coluna
            key={c.status}
            config={c}
            items={porStatus.map[c.status]}
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

      {porStatus.fora.length > 0 && (
        <p className="text-xs text-amber-700">
          {porStatus.fora.length} aplicação(ões) com status fora dessas quatro
          colunas — aparecem na tabela da carteira, abaixo.
        </p>
      )}
    </section>
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
  items: AplicacaoResumo[];
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
  const bg       = noEscuro ? config.escuro.bg     : config.bg;
  const border   = noEscuro ? config.escuro.border : config.border;
  const corTexto = noEscuro ? config.escuro.texto  : cor;

  // Filtro por coluna: título da aplicação, empresa, cidade, CNPJ ou modelo.
  // O título entra primeiro de propósito — é nele que as pessoas escrevem à mão
  // a unidade do cliente (medido em 04/09: 5 aplicações e 580 respondentes numa
  // única empresa do painel, distinguidas só pelo texto do título).
  const [busca, setBusca] = useState("");
  // Busca tolerante (acento, ordem das palavras, erro de digitação); CNPJ pelos dígitos. Mantém a ordem.
  const { itens: visiveis, aproximado } = useMemo(
    () =>
      buscar(
        items,
        busca,
        (a) => [a.aplicacao.titulo, a.empresaNome, a.empresaMunicipio, a.tipoNome],
        { codigos: (a) => [a.empresaCnpj], manterOrdem: true },
      ),
    [items, busca],
  );

  return (
    <div
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
            <h3
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: corTexto }}
            >
              {titulo}
            </h3>
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
              placeholder="Filtrar aplicação, empresa, cidade ou CNPJ…"
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
            : "Nenhuma aplicação nesse status."}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs italic text-gray-400">
          Nenhuma aplicação encontrada.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-gray-100 overflow-auto">
          {aproximado && (
            <li>
              <AvisoBuscaAproximada aproximado busca={busca} total={visiveis.length} compacto />
            </li>
          )}
          {visiveis.map((a) => (
            <li key={a.aplicacao.id_aplicacao}>
              <Cartao
                a={a}
                podeEditar={podeEditar}
                onDragStart={() => onDragStartCard(a.aplicacao.id_aplicacao)}
                onDragEnd={onDragEndCard}
                onAbrir={() =>
                  router.push(
                    `/questionarios-psicossociais/${a.aplicacao.id_aplicacao}`,
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Cartao({
  a,
  podeEditar,
  onDragStart,
  onDragEnd,
  onAbrir,
}: {
  a: AplicacaoResumo;
  podeEditar: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAbrir: () => void;
}) {
  const ap = a.aplicacao;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={podeEditar}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      className={`block px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
        podeEditar ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">{a.empresaNome}</span>
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-gray-700">
            {a.empresaCnpj ? formatCNPJ(a.empresaCnpj) : "—"}
          </p>
          {a.empresaMunicipio && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">
                {[a.empresaMunicipio, a.empresaUf].filter(Boolean).join(" / ")}
              </span>
            </div>
          )}

          {/* O título é a identidade da aplicação — e onde a unidade do cliente
              costuma estar escrita à mão. Vem depois da empresa, no mesmo lugar
              em que o cartão do DRPS mostra a revisão. */}
          <p
            className="mt-1.5 truncate text-xs font-semibold text-indigo-700"
            title={ap.titulo}
          >
            {ap.titulo}
          </p>
          <p className="truncate text-[11px] text-gray-500">{a.tipoNome}</p>

          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600">
            <Users className="size-3 shrink-0 text-gray-400" />
            <span>
              {a.nRespondentes} respondente(s)
              {a.taxaParticipacao !== null && (
                <span
                  className={
                    a.taxaParticipacao < 0.5 ? "font-medium text-amber-700" : ""
                  }
                >
                  {" "}
                  · {Math.round(a.taxaParticipacao * 100)}% de {a.previstos}
                </span>
              )}
            </span>
          </div>

          <p className="mt-0.5 text-[10px] text-gray-400">
            Atualizado em {fmtData(ap.atualizado_em ?? ap.criado_em)}
            {a.etapa !== "CONCLUIDO" && a.diasParado >= 30 && (
              <span className="font-medium text-amber-700">
                {" "}
                · parada há {a.diasParado} d
              </span>
            )}
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-gray-400" />
      </div>
    </div>
  );
}
