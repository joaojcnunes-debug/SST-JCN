"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  FileText,
  PackagePlus,
  HandCoins,
  Undo2,
  Users,
  AlertTriangle,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  useEquipamentosCatalogo,
  useEquipamentosSaldo,
} from "@/lib/hooks/useEquipamentosEstoque";
import { useUnidades } from "@/lib/hooks/useUnidades";
import MovimentacaoEntrada from "@/components/equipamentos/MovimentacaoEntrada";
import MovimentacaoTransferir from "@/components/equipamentos/MovimentacaoTransferir";
import MovimentacaoEntrega from "@/components/equipamentos/MovimentacaoEntrega";
import MovimentacaoDevolucao from "@/components/equipamentos/MovimentacaoDevolucao";
import ColaboradoresChabra from "@/components/equipamentos/ColaboradoresChabra";
import ErroContido from "@/components/ui/ErroContido";
import TransferenciasPendentes from "@/components/equipamentos/TransferenciasPendentes";
import RegistroMovimentacoes from "@/components/equipamentos/RegistroMovimentacoes";
import { cn } from "@/lib/utils";

/**
 * Área de Movimentação — Transferências e Entrada de Material num lugar só.
 *
 * POR QUE UMA ÁREA E NÃO DUAS TELAS. Quando o banco do módulo foi escrito, a
 * razão de estoque nasceu com `origem in ('manual','nf','entrega','devolucao',
 * 'transferencia','ajuste')`. Transferência JÁ É um tipo de movimentação, igual
 * à entrada por nota. A área é um REGISTRO ÚNICO com portas de entrada
 * diferentes — não duas telas coladas por conveniência.
 *
 * O LAYOUT É O "PADRÃO C", escolhido pelo operador em 2026-08-11 entre quatro
 * alternativas. A ideia: o registro fica SEMPRE VISÍVEL e as ações abrem por
 * cima. A queixa que originou o módulo era não conseguir enxergar o patrimônio;
 * quem dá entrada em 10 fones vê a linha aparecer sem trocar de tela.
 *
 * Duas exceções ficam em tela cheia, de propósito: a importação de NF-e lista
 * item por item e pede espaço, e o catálogo é uma lista de administração, não
 * uma ação rápida. Espremer os dois numa janela sobreposta seria pior.
 *
 * ── 22/09/2026: OS TRÊS REGISTROS VIRARAM UM ──────────────────────────────
 * A área mostrava o mesmo assunto em três blocos empilhados — Extrato,
 * Transferências entre bases e Retiradas e devoluções — cada um com filtro,
 * contagem e jeito de ler próprios. Pedido dele: "juntar as 3 partes de
 * registro que mostra nessa área em uma só com suas determinadas
 * especificações". Agora existe `<RegistroMovimentacoes>`: uma linha por
 * ACONTECIMENTO, com busca tolerante, filtro por tipo, por base e por período,
 * e a gaveta de cada linha abrindo o detalhe que só aquele tipo tem.
 *
 * ⚠️ E ISSO CONSERTOU UMA CONTAGEM ERRADA DE GRAÇA: retirada, devolução e
 * transferência de material por quantidade JÁ LANÇAM no extrato. Os três blocos
 * antigos mostravam o mesmo ato duas vezes, um como ato e outro como
 * lançamento. A regra da fusão (`lib/equipamentos/registro.ts`, com teste)
 * absorve o lançamento no ato a que ele pertence.
 *
 * O que NÃO mudou: as pendências continuam acima do registro, porque material
 * em trânsito é o que precisa de ação, e o saldo por base continua sendo a
 * resposta de "quanto tem", que é outra pergunta.
 */

export default function MovimentacaoPage() {
  return (
    <Suspense fallback={null}>
      <MovimentacaoConteudo />
    </Suspense>
  );
}

function MovimentacaoConteudo() {
  const params = useSearchParams();
  const unidadeUrl = params.get("unidade");

  const [janela, setJanela] = useState<
    null | "entrada" | "transferir" | "entrega" | "devolucao" | "colaboradores"
  >(null);
  /** Mora aqui, e não no registro, porque as janelas de ação nascem na base
   *  escolhida e o saldo por base segue o mesmo recorte. */
  const [baseFiltro, setBaseFiltro] = useState<string>(unidadeUrl ?? "TODAS");

  const { data: catalogo = [] } = useEquipamentosCatalogo();
  const { data: saldo } = useEquipamentosSaldo();
  const { data: unidades = [] } = useUnidades();

  const bases = useMemo(
    () =>
      [...unidades]
        .filter((u) => !/^conselh/i.test((u.nome ?? "").trim()))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [unidades]
  );

  /** Saldo por base. Só produtos POR QUANTIDADE aparecem: computador e notebook
   *  viram ficha individual e são contados na Visão geral, não aqui. */
  const saldoPorBase = useMemo(() => {
    const out: {
      base: string;
      nomeBase: string;
      itens: { nome: string; qtd: number; minimo: number }[];
    }[] = [];
    for (const u of bases) {
      if (baseFiltro !== "TODAS" && u.id_unidade !== baseFiltro) continue;
      const itens: { nome: string; qtd: number; minimo: number }[] = [];
      for (const c of catalogo) {
        if (c.controla_individual) continue;
        const q = saldo?.get(`${u.id_unidade}|${c.id_catalogo}`) ?? 0;
        if (q !== 0)
          itens.push({ nome: c.nome, qtd: q, minimo: Number(c.estoque_minimo ?? 0) });
      }
      if (itens.length > 0) out.push({ base: u.id_unidade, nomeBase: u.nome, itens });
    }
    return out;
  }, [bases, catalogo, saldo, baseFiltro]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Movimentação</h1>
        <p className="text-sm text-gray-500">
          Entrada, transferência, retirada e devolução de material — no mesmo registro.
        </p>
      </div>

      {/* ── As portas ─────────────────────────────────────── */}
      {/* Eram quatro portas; o Catálogo (21/09/2026) passou a viver DENTRO do
          Dar entrada — "+ Novo" e "Editar" ao lado do item. Uma tela a menos
          para a pessoa descobrir. */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Acao
          icone={PackagePlus}
          titulo="Dar entrada"
          descricao="Material sem nota — cadastra o produto aqui"
          cor="emerald"
          onClick={() => setJanela("entrada")}
        />
        <Acao
          icone={FileText}
          titulo="Importar NF-e"
          descricao="Do XML da nota fiscal"
          cor="blue"
          href="/equipamentos/movimentacao/nfe"
        />
        <Acao
          icone={ArrowLeftRight}
          titulo="Transferir"
          descricao="Entre bases, com assinatura"
          cor="violet"
          onClick={() => setJanela("transferir")}
        />
      </div>

      {/* ── Posse: sai para a pessoa, volta para a base ────
          Separado das portas de cima de propósito. As de cima movem material
          ENTRE LUGARES da JCN Consultoria; estas duas trocam a POSSE, que é o que gera
          termo assinado e responsabilidade de alguém. */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Acao
          icone={HandCoins}
          titulo="Retirada"
          descricao="Entregar a um colaborador, com termo"
          cor="emerald"
          onClick={() => setJanela("entrega")}
        />
        <Acao
          icone={Undo2}
          titulo="Devolução"
          descricao="Receber de volta na base, com termo"
          cor="blue"
          onClick={() => setJanela("devolucao")}
        />
        <Acao
          icone={Users}
          titulo="Colaboradores"
          descricao="Quem pode receber equipamento"
          cor="gray"
          onClick={() => setJanela("colaboradores")}
        />
      </div>

      {/* Pendências primeiro: material em trânsito é o que precisa de ação. */}
      <TransferenciasPendentes />

      {/* ── Saldo por base ────────────────────────────────── */}
      {saldoPorBase.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Saldo por base</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {saldoPorBase.map((b) => (
              <div key={b.base} className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {b.nomeBase}
                </p>
                <ul className="space-y-0.5 text-sm">
                  {b.itens.map((i) => {
                    const abaixo = i.minimo > 0 && i.qtd < i.minimo;
                    return (
                      <li key={i.nome} className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-gray-700">{i.nome}</span>
                        <span
                          className={cn(
                            "shrink-0 font-mono font-semibold tabular-nums",
                            abaixo ? "text-red-600" : "text-gray-900"
                          )}
                          title={abaixo ? `Abaixo do mínimo (${i.minimo})` : undefined}
                        >
                          {i.qtd}
                          {abaixo && <AlertTriangle className="ml-1 inline size-3" />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cercado de propósito: o registro é o bloco novo e fica no corpo da
          página, ao lado das portas que já estão em uso. Sem a cerca, uma
          exceção aqui apagaria a tela inteira — e o healthcheck do deploy
          responderia 200 do mesmo jeito. */}
      <ErroContido titulo="O registro de movimentação">
        <RegistroMovimentacoes
          bases={bases}
          baseFiltro={baseFiltro}
          onBaseFiltro={setBaseFiltro}
          catalogo={catalogo}
          saldo={saldo}
        />
      </ErroContido>

      {/* ── Janelas das ações rápidas ─────────────────────── */}
      <Modal
        open={janela === "entrada"}
        onClose={() => setJanela(null)}
        title="Entrada de material"
        size="xl"
      >
        <MovimentacaoEntrada bases={bases} />
      </Modal>

      <Modal
        open={janela === "transferir"}
        onClose={() => setJanela(null)}
        title="Transferir entre bases"
        size="xl"
      >
        <MovimentacaoTransferir bases={bases} />
      </Modal>

      <Modal
        open={janela === "entrega"}
        onClose={() => setJanela(null)}
        title="Retirada de equipamento"
        size="xl"
      >
        <MovimentacaoEntrega bases={bases} baseInicial={baseFiltro} />
      </Modal>

      <Modal
        open={janela === "devolucao"}
        onClose={() => setJanela(null)}
        title="Devolução de equipamento"
        size="xl"
      >
        <MovimentacaoDevolucao bases={bases} baseInicial={baseFiltro} />
      </Modal>

      <Modal
        open={janela === "colaboradores"}
        onClose={() => setJanela(null)}
        title="Colaboradores que podem receber equipamento"
        size="xl"
      >
        <ColaboradoresChabra bases={bases} baseInicial={baseFiltro} />
      </Modal>
    </div>
  );
}

/** Porta de entrada. Vira link quando a ação pede tela cheia (NF-e e catálogo)
 *  e botão quando abre em janela (entrada e transferência). */
function Acao({
  icone: Icone,
  titulo,
  descricao,
  cor,
  onClick,
  href,
}: {
  icone: typeof PackagePlus;
  titulo: string;
  descricao: string;
  cor: "emerald" | "blue" | "violet" | "gray";
  onClick?: () => void;
  href?: string;
}) {
  const cores = {
    emerald: "text-emerald-600 group-hover:border-emerald-300",
    blue: "text-blue-600 group-hover:border-blue-300",
    violet: "text-violet-600 group-hover:border-violet-300",
    gray: "text-gray-500 group-hover:border-gray-400",
  }[cor];

  const conteudo = (
    <>
      <Icone className={cn("size-5", cores.split(" ")[0])} />
      <span className="mt-1.5 block text-sm font-semibold text-gray-900">{titulo}</span>
      <span className="mt-0.5 block text-xs text-gray-500">{descricao}</span>
    </>
  );

  const classe = cn(
    "group block rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
    cores.split(" ")[1]
  );

  return href ? (
    <Link href={href} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cn(classe, "w-full")}>
      {conteudo}
    </button>
  );
}
