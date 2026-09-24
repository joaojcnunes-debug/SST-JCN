"use client";

import { Fragment, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileText,
  Fingerprint,
  HandCoins,
  ListOrdered,
  Loader2,
  PackagePlus,
  PenLine,
  Search,
  Settings2,
  SlidersHorizontal,
  Square,
  Undo2,
  X,
} from "lucide-react";
import {
  useEquipamentosMovimentacoes,
  type EquipamentoCatalogo,
} from "@/lib/hooks/useEquipamentosEstoque";
import {
  useColaboradores,
  useDevolucoes,
  useDevolucoesItensTodos,
  useEntregas,
  useEntregasItensTodos,
  urlTermo,
} from "@/lib/hooks/useEquipamentosEntregas";
import { useCancelarTransferencia, useTransferencias } from "@/lib/hooks/useTransferencias";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import {
  CLASSE_TIPO,
  ROTULO_TIPO,
  TIPOS_REGISTRO,
  codigosDoRegistro,
  contarPorTipo,
  filtrarRegistro,
  montarRegistro,
  textosDoRegistro,
  type RegistroMov,
  type TipoRegistro,
} from "@/lib/equipamentos/registro";
import { cn } from "@/lib/utils";
import AssinaturaBiometricaModal from "./AssinaturaBiometricaModal";
import RetiradaGerenciarModal from "./RetiradaGerenciarModal";
import BotaoExportarEquipamentosXlsx from "./BotaoExportarEquipamentosXlsx";

/**
 * O REGISTRO — a lista única de movimentação de equipamentos.
 *
 * ELA SUBSTITUI TRÊS BLOCOS que a área tinha um embaixo do outro: o Extrato,
 * o histórico de Transferências entre bases e o de Retiradas e devoluções.
 * Pedido dele em 22/09/2026: "juntar as 3 partes de registro que mostra nessa
 * área em uma só com suas determinadas especificações".
 *
 * "COM SUAS DETERMINADAS ESPECIFICAÇÕES" É O QUE IMPEDE A FUSÃO DE VIRAR PERDA.
 * Cada tipo de registro carrega o que só ele tem, e nada disso ficou pelo
 * caminho: a transferência mantém "de → para", a situação do aceite, a
 * assinatura, o termo e o Cancelar de quem criou; a retirada mantém o
 * colaborador, o rascunho, o Gerenciar, o Assinar por biometria e o termo; o
 * lançamento de estoque mantém o sinal, o motivo e quem lançou. O que some é a
 * REPETIÇÃO — nunca a informação. A gaveta de cada linha (o ▸) abre o detalhe
 * item a item.
 *
 * A REGRA DA FUSÃO mora em `lib/equipamentos/registro.ts`, com teste: uma linha
 * por ATO, e o lançamento de saldo que reflete um ato é absorvido por ele. Sem
 * isso, a mesma retirada apareceria três vezes na lista nova.
 *
 * A BUSCA é a tolerante da casa (`lib/busca/texto.ts`, a mesma das 28 caixas do
 * painel): ignora acento e caixa, aceita as palavras fora de ordem, perdoa erro
 * de digitação e compara plaqueta/série só pelos dígitos. E procura DENTRO dos
 * itens do documento — "teclado" acha a retirada que entregou o teclado, não só
 * a entrada de estoque que tem essa palavra no título.
 */

const ICONE_TIPO: Record<TipoRegistro, typeof PackagePlus> = {
  manual: PackagePlus,
  nf: FileText,
  ajuste: SlidersHorizontal,
  transferencia: ArrowLeftRight,
  entrega: HandCoins,
  devolucao: Undo2,
};

const ESTADO_RETORNO: Record<string, string> = {
  integro: "íntegro",
  avariado: "avariado",
  inservivel: "inservível",
};

function fmtDia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fmtDia(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PAGINA = 50;

export default function RegistroMovimentacoes({
  bases,
  baseFiltro,
  onBaseFiltro,
  catalogo,
  saldo,
}: {
  bases: { id_unidade: string; nome: string }[];
  baseFiltro: string;
  onBaseFiltro: (v: string) => void;
  catalogo: EquipamentoCatalogo[];
  /** `${id_unidade}|${id_catalogo}` → saldo. Só passa adiante para a planilha. */
  saldo: Map<string, number> | undefined;
}) {
  const qc = useQueryClient();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const cancelar = useCancelarTransferencia();

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("TODOS");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [teto, setTeto] = useState(PAGINA);
  const [aberta, setAberta] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [assinarAlvo, setAssinarAlvo] = useState<{ id: string; nome: string } | null>(null);
  const [gerenciarAlvo, setGerenciarAlvo] = useState<{ id: string; nome: string } | null>(null);

  // A base recorta no servidor o que é caro (retiradas, devoluções e seus itens)
  // e no cliente o resto — o extrato e as transferências já vêm inteiros porque
  // são as listas que a área inteira usa.
  const base = baseFiltro === "TODAS" ? null : baseFiltro;
  const { data: movs = [], isLoading: carregandoMovs } = useEquipamentosMovimentacoes();
  const { data: transferencias = [], isLoading: carregandoTransf } = useTransferencias();
  const { data: entregas = [] } = useEntregas(base);
  const { data: devolucoes = [] } = useDevolucoes(base);
  const { data: entregaItens = [] } = useEntregasItensTodos(base);
  const { data: devolucaoItens = [] } = useDevolucoesItensTodos(base);
  const { data: colaboradores = [] } = useColaboradores(base, false);

  const carregando = carregandoMovs || carregandoTransf;

  const nomeBase = useMemo(
    () => new Map(bases.map((b) => [b.id_unidade, b.nome])),
    [bases],
  );
  const nomeItem = useMemo(
    () => new Map(catalogo.map((c) => [c.id_catalogo, c.nome])),
    [catalogo],
  );
  const nomeColab = useMemo(
    () => new Map(colaboradores.map((c) => [c.id_colaborador, c.nome])),
    [colaboradores],
  );

  const todas = useMemo(
    () =>
      montarRegistro({
        movimentacoes: movs,
        transferencias,
        entregas,
        devolucoes,
        entregaItens,
        devolucaoItens,
        nomeItem: (id) => nomeItem.get(id) ?? "—",
        nomeBase: (id) => (id ? (nomeBase.get(id) ?? id) : "—"),
        nomeColaborador: (id) => nomeColab.get(id) ?? "—",
      }),
    [movs, transferencias, entregas, devolucoes, entregaItens, devolucaoItens, nomeItem, nomeBase, nomeColab],
  );

  /** Recorte SEM o filtro de tipo: é sobre ele que as pílulas contam, senão a
   *  pílula "Retirada" mostraria zero depois de a pessoa clicar em outra. */
  const noRecorte = useMemo(
    () => filtrarRegistro(todas, { base: baseFiltro, tipo: "TODOS", de, ate }),
    [todas, baseFiltro, de, ate],
  );
  const contagem = useMemo(() => contarPorTipo(noRecorte), [noRecorte]);

  const filtradas = useMemo(
    () => filtrarRegistro(noRecorte, { base: "TODAS", tipo: tipoFiltro }),
    [noRecorte, tipoFiltro],
  );

  const resultado = useMemo(
    () =>
      buscar(filtradas, busca, textosDoRegistro, {
        codigos: codigosDoRegistro,
        // A tabela já está ordenada por data; reordenar por semelhança tiraria
        // o sentido da linha do tempo.
        manterOrdem: true,
        limiteAproximados: 100,
      }),
    [filtradas, busca],
  );

  const linhas = resultado.itens;
  const visiveis = linhas.slice(0, teto);

  const transferenciasMarcadas = useMemo(
    () => linhas.filter((l) => l.tipo === "transferencia" && selecionadas.has(l.id)),
    [linhas, selecionadas],
  );

  function alternarSelecao(id: string) {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function gerarTermosEmLote() {
    if (transferenciasMarcadas.length === 0) return;
    const ids = transferenciasMarcadas.map((t) => t.idOriginal).join(",");
    window.open(`/api/pdf/transferencias?ids=${encodeURIComponent(ids)}`, "_blank");
  }

  const meuEmail = (user?.email ?? "").toLowerCase();
  const podeCancelar = (l: RegistroMov) =>
    l.cancelavel && (isAdmin || (l.emailCriador ?? "").toLowerCase() === meuEmail);

  const limpar = () => {
    setBusca("");
    setTipoFiltro("TODOS");
    setDe("");
    setAte("");
    setTeto(PAGINA);
  };
  const temFiltro = !!busca || tipoFiltro !== "TODOS" || !!de || !!ate || baseFiltro !== "TODAS";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Registro de movimentação</h2>
        <span className="text-xs text-gray-500">
          {linhas.length === todas.length
            ? `${linhas.length} ${linhas.length === 1 ? "registro" : "registros"}`
            : `${linhas.length} de ${todas.length}`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {transferenciasMarcadas.length > 0 && (
            <button
              type="button"
              onClick={gerarTermosEmLote}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              <FileDown className="size-4" />
              Termo de {transferenciasMarcadas.length}
            </button>
          )}
          {/* A exportação mora ao lado da lista que ela copia: a planilha sai com
              ESTE recorte — busca, base, tipo e período — e a aba "Sobre" escreve
              qual foi. */}
          <BotaoExportarEquipamentosXlsx
            catalogo={catalogo}
            saldo={saldo}
            bases={bases}
            baseFiltro={baseFiltro}
            tipoFiltro={tipoFiltro}
            registro={linhas}
            filtroBusca={busca}
            periodo={{ de, ate }}
          />
        </div>
      </div>

      {/* ── Procurar ──────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setTeto(PAGINA);
              }}
              placeholder="Procurar por item, plaqueta, colaborador, base, motivo…"
              className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-8 text-sm focus:border-blue-500 focus:outline-none"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <select
            value={baseFiltro}
            onChange={(e) => {
              onBaseFiltro(e.target.value);
              setTeto(PAGINA);
            }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="TODAS">Todas as bases</option>
            {bases.map((u) => (
              <option key={u.id_unidade} value={u.id_unidade}>
                {u.nome}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            de
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            até
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            />
          </label>
          {temFiltro && (
            <button
              type="button"
              onClick={limpar}
              className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
            >
              limpar
            </button>
          )}
        </div>

        {/* Pílulas com a CONTAGEM: dizem o que existe antes de a pessoa clicar —
            uma pílula zerada responde "não tem", em vez de abrir uma lista vazia. */}
        <div className="flex flex-wrap gap-1.5">
          <Pilula
            ativo={tipoFiltro === "TODOS"}
            onClick={() => setTipoFiltro("TODOS")}
            rotulo="Tudo"
            total={noRecorte.length}
          />
          {TIPOS_REGISTRO.map((t) => (
            <Pilula
              key={t}
              ativo={tipoFiltro === t}
              onClick={() => {
                setTipoFiltro(tipoFiltro === t ? "TODOS" : t);
                setTeto(PAGINA);
              }}
              rotulo={ROTULO_TIPO[t]}
              total={contagem[t] ?? 0}
              icone={ICONE_TIPO[t]}
            />
          ))}
        </div>
      </div>

      <AvisoBuscaAproximada aproximado={resultado.aproximado} busca={busca} total={linhas.length} />

      {/* ── A lista ───────────────────────────────────────── */}
      {carregando ? (
        <p className="py-10 text-center text-sm text-gray-500">Carregando…</p>
      ) : linhas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-12 text-center">
          <ListOrdered className="mx-auto size-7 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            {todas.length === 0 ? "Nenhuma movimentação ainda" : "Nada encontrado com estes filtros"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {todas.length === 0
              ? "Comece dando entrada em material, no botão acima."
              : "Tente outra palavra, ou limpe os filtros."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Registro</th>
                  <th className="px-3 py-2">O quê</th>
                  <th className="px-3 py-2">Onde</th>
                  <th className="px-3 py-2 text-right">Qtd.</th>
                  <th className="px-3 py-2">Quem</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visiveis.map((l) => {
                  const Icone = ICONE_TIPO[l.tipo];
                  const abertaEsta = aberta === l.id;
                  const marcada = selecionadas.has(l.id);
                  return (
                    <Fragment key={l.id}>
                      <tr
                        className={cn(
                          "align-top hover:bg-gray-50/70",
                          marcada && "bg-blue-50",
                          l.cancelado && "opacity-60",
                        )}
                      >
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => setAberta(abertaEsta ? null : l.id)}
                            aria-label={abertaEsta ? "Fechar detalhe" : "Abrir detalhe"}
                            className="text-gray-400 hover:text-gray-700"
                          >
                            {abertaEsta ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                          {fmtDia(l.quando)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
                              CLASSE_TIPO[l.tipo],
                            )}
                          >
                            <Icone className="size-3.5" />
                            {ROTULO_TIPO[l.tipo]}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-900">
                            {l.itens[0]?.nome ?? "—"}
                            {l.itens.length > 1 && (
                              <span className="ml-1 text-xs font-normal text-gray-500">
                                +{l.itens.length - 1}
                              </span>
                            )}
                          </p>
                          {l.itens[0]?.numeroPatrimonio && (
                            <p className="text-xs text-gray-500">
                              plaqueta {l.itens[0].numeroPatrimonio}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {l.baseDestino ? (
                            <>
                              <span className="text-gray-400">{l.base}</span>
                              <span className="mx-1 text-violet-500">→</span>
                              <span className="font-medium text-gray-800">{l.baseDestino}</span>
                            </>
                          ) : (
                            l.base
                          )}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-3 py-2 text-right font-mono font-semibold tabular-nums",
                            !l.quantidade
                              ? "text-gray-300"
                              : l.sinal === "+"
                                ? "text-emerald-600"
                                : l.sinal === "-"
                                  ? "text-red-600"
                                  : "text-gray-500",
                          )}
                        >
                          {/* Sem quantidade é traço, não "−0": a retirada cancelada
                              cujos itens foram todos removidos ficava mostrando
                              "−0" em vermelho, que se lê como se algo tivesse saído. */}
                          {l.quantidade ? `${l.sinal ?? ""}${l.quantidade}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {l.pessoa ?? l.responsavel ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {l.situacao && (
                            <span
                              className={cn(
                                "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                l.situacao.classe,
                              )}
                            >
                              {l.situacao.rotulo}
                            </span>
                          )}
                          {l.assinado && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
                              <PenLine className="size-3" /> assinada
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <Acoes
                            l={l}
                            podeCancelar={podeCancelar(l)}
                            cancelando={cancelar.isPending}
                            marcada={marcada}
                            onMarcar={() => alternarSelecao(l.id)}
                            onCancelar={(motivo) =>
                              cancelar.mutate({ id: l.idOriginal, motivo })
                            }
                            onGerenciar={() =>
                              setGerenciarAlvo({ id: l.idOriginal, nome: l.pessoa ?? "—" })
                            }
                            onAssinar={() =>
                              setAssinarAlvo({ id: l.idOriginal, nome: l.pessoa ?? "—" })
                            }
                          />
                        </td>
                      </tr>
                      {abertaEsta && (
                        <tr className="bg-gray-50/80">
                          <td />
                          <td colSpan={8} className="px-3 pb-3 pt-1">
                            <Detalhe l={l} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {linhas.length > visiveis.length && (
            <button
              type="button"
              onClick={() => setTeto((t) => t + PAGINA)}
              className="w-full rounded-lg border border-dashed border-gray-300 bg-white py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Mostrar mais {Math.min(PAGINA, linhas.length - visiveis.length)} — faltam{" "}
              {linhas.length - visiveis.length}
            </button>
          )}

          <p className="text-xs text-gray-400">
            Uma linha por <strong>acontecimento</strong>. Uma transferência entre bases
            aparece <strong>uma vez</strong>, com origem e destino — no extrato bruto ela
            vira dois lançamentos (saída lá, entrada cá) e o total da JCN Consultoria não muda. O ▸
            de cada linha abre os itens e quem lançou.
          </p>
        </>
      )}

      {gerenciarAlvo ? (
        <RetiradaGerenciarModal
          open
          onClose={() => setGerenciarAlvo(null)}
          idEntrega={gerenciarAlvo.id}
          nomeColaborador={gerenciarAlvo.nome}
          onMudou={() => {
            void qc.invalidateQueries({ queryKey: ["equipamentos-entregas"] });
          }}
        />
      ) : null}

      {assinarAlvo ? (
        <AssinaturaBiometricaModal
          open
          onClose={() => setAssinarAlvo(null)}
          idEntrega={assinarAlvo.id}
          nomeRecebedor={assinarAlvo.nome}
        />
      ) : null}
    </div>
  );
}

function Pilula({
  ativo,
  onClick,
  rotulo,
  total,
  icone: Icone,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  total: number;
  icone?: typeof PackagePlus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={total === 0 && !ativo}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition",
        ativo
          ? "bg-gray-900 text-white"
          : total === 0
            ? "bg-gray-50 text-gray-300"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
    >
      {Icone && <Icone className="size-3.5" />}
      {rotulo}
      <span className={cn("tabular-nums", ativo ? "text-white/70" : "text-gray-400")}>
        {total}
      </span>
    </button>
  );
}

/**
 * As ações de cada tipo. Todas vieram dos blocos antigos — nenhuma se perdeu na
 * fusão, e é por isso que elas moram numa função só: some daqui, some da tela.
 */
function Acoes({
  l,
  podeCancelar,
  cancelando,
  marcada,
  onMarcar,
  onCancelar,
  onGerenciar,
  onAssinar,
}: {
  l: RegistroMov;
  podeCancelar: boolean;
  cancelando: boolean;
  marcada: boolean;
  onMarcar: () => void;
  onCancelar: (motivo: string | undefined) => void;
  onGerenciar: () => void;
  onAssinar: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {l.tipo === "entrega" && (
        <button
          type="button"
          onClick={onGerenciar}
          title="Gerenciar a retirada (itens, emissão, cancelamento)"
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
        >
          <Settings2 className="size-3.5" /> Gerenciar
        </button>
      )}
      {l.tipo === "entrega" && !l.rascunho && !l.cancelado && (
        <button
          type="button"
          onClick={onAssinar}
          title="Assinar por biometria"
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
        >
          <Fingerprint className="size-3.5" /> Assinar
        </button>
      )}
      {podeCancelar && (
        <button
          type="button"
          onClick={() => {
            const motivo = window.prompt(
              "Cancelar esta transferência? O material volta para a base de origem.",
            );
            if (motivo === null) return;
            onCancelar(motivo.trim() || undefined);
          }}
          disabled={cancelando}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {cancelando && <Loader2 className="size-3 animate-spin" />}
          Cancelar
        </button>
      )}
      {/* O termo sai para qualquer situação, inclusive pendente: é o papel que
          viaja junto com o material. Reemitir lê o snapshot do ato. */}
      {l.termo && (
        <a
          href={urlTermo(l.termo.tipo, l.termo.id)}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir o termo em PDF"
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
        >
          <FileText className="size-3.5" /> Termo
        </a>
      )}
      {/* A seleção em lote é só das transferências: o /api/pdf/transferencias
          junta várias num arquivo, e não existe equivalente para retirada. */}
      {l.tipo === "transferencia" && (
        <button
          type="button"
          onClick={onMarcar}
          aria-label="Selecionar para o termo em lote"
          title="Selecionar para gerar vários termos num arquivo"
          className="text-gray-400 hover:text-blue-600"
        >
          {marcada ? <CheckSquare className="size-4 text-blue-600" /> : <Square className="size-4" />}
        </button>
      )}
    </div>
  );
}

/** A gaveta: o que é específico do tipo e não cabe numa linha de tabela. */
function Detalhe({ l }: { l: RegistroMov }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wider text-gray-500">
            {l.itens.length === 1 ? "Item" : `Itens (${l.itens.length})`}
          </p>
          <ul className="space-y-1">
            {l.itens.map((i, n) => (
              <li key={`${l.id}-item-${n}`} className="flex items-baseline justify-between gap-2">
                <span className="text-gray-800">
                  {i.nome}
                  {(i.numeroPatrimonio || i.numeroSerie || i.estado) && (
                    <span className="ml-1 text-gray-500">
                      (
                      {[
                        i.numeroPatrimonio && `plaqueta ${i.numeroPatrimonio}`,
                        i.numeroSerie && `série ${i.numeroSerie}`,
                        i.estado && (ESTADO_RETORNO[i.estado] ?? i.estado),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      )
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-gray-600">
                  {i.quantidade ?? 1}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <dl className="space-y-1 text-gray-600">
          <Campo rotulo="Registrado em" valor={fmtDataHora(l.registradoEm)} />
          <Campo rotulo="Lançado por" valor={l.emailCriador} />
          <Campo rotulo="Responsável" valor={l.responsavel} />
          <Campo rotulo="Motivo" valor={l.motivo} />
          <Campo rotulo="Observação" valor={l.observacao} />
          <Campo rotulo="Código" valor={l.idOriginal} />
          {/* Diz por que a linha some do extrato bruto: ela É o extrato, aqui. */}
          <Campo
            rotulo="No saldo"
            valor={
              l.lancamentos === 0
                ? "não mexe no saldo (aparelho com ficha própria)"
                : `${l.lancamentos} ${l.lancamentos === 1 ? "lançamento" : "lançamentos"} de estoque`
            }
          />
        </dl>
      </div>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 font-semibold text-gray-500">{rotulo}:</dt>
      <dd className="min-w-0 break-words">{valor}</dd>
    </div>
  );
}
