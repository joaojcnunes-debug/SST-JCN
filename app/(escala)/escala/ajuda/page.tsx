"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  CalendarRange,
  FileBarChart,
  Info,
  Settings,
} from "lucide-react";
import { SITUACOES } from "@/lib/escala/tipos";
import AjudaComAbas from "@/components/novidades/AjudaComAbas";

/**
 * Ajuda do módulo Escala de Supervisores.
 *
 * Curta e na ORDEM DE USO, não na ordem do menu: quem abre esta página pela
 * primeira vez não quer a lista de telas, quer saber por onde começar — e o
 * módulo subiu vazio, então "por onde começar" é literalmente a primeira
 * pergunta que ele responde.
 *
 * O que está escrito aqui foi tirado do comportamento real do código
 * (lib/escala/gerar.ts, regras.ts, datas.ts), não do contrato do módulo. As
 * quatro regras que surpreendem têm seção própria porque são exatamente as que
 * fazem alguém achar que a escala está errada quando ela está certa.
 */
function ConteudoAjudaEscalaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Como usar a Escala de Supervisores
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Este módulo substitui a planilha <em>Escala dos Supervisores</em> — as
          18 abas dela viraram seis telas. É operação interna da JCN Consultoria: não tem
          empresa cliente no meio.
        </p>
      </div>

      {/* ── Por onde começar ────────────────────────────────── */}
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-700" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">Por onde começar</p>
            <p className="mt-1">
              A grade mensal não se preenche sozinha: ela <strong>nasce</strong>{" "}
              do padrão semanal, e o padrão precisa saber quem são as pessoas e
              quais são as bases. A ordem é sempre esta:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                <strong>Configuração → Unidades</strong>: cada base ganha uma cor
                e o <strong>município</strong>.
              </li>
              <li>
                <strong>Configuração → Supervisores</strong>: escolha a conta do
                painel de cada um.
              </li>
              <li>
                <strong>Configuração → Feriados</strong>: os do ano, incluindo os
                municipais.
              </li>
              <li>
                <strong>Padrão Semanal</strong>: onde cada supervisor fica em
                cada dia da semana.
              </li>
              <li>
                <strong>Grade Mensal</strong>: gere o mês. Só aí o módulo tem o
                que mostrar.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* ── As quatro regras que surpreendem ────────────────── */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <AlertTriangle className="size-4 text-amber-500" />
          Quatro coisas que parecem erro e não são
        </h2>
        <div className="space-y-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900">
              O dia que você mexeu à mão nunca é sobrescrito
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Pode gerar o mês quantas vezes quiser: a regeração passa por cima
              só do que veio do padrão. O que foi editado na grade fica —
              inclusive se o padrão semanal mudar depois. Para um dia voltar a
              seguir o padrão, é preciso desfazer a edição dele.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900">
              Sábado e domingo não existem na escala
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Não é que estejam vazios: eles não geram linha nenhuma. A planilha
              fazia igual — a coluna existia e ficava em branco.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900">
              Ponto facultativo bloqueia igual a feriado
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Feriado vira a situação <strong>Feriado</strong> e sobrepõe o que o
              padrão dizia daquele dia — inclusive home office. Ponto facultativo
              faz o mesmo, porque é assim que a operação sempre tratou o Carnaval.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900">
              Feriado municipal só alcança quem está naquele município
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Quem está alocado em outra unidade trabalha normal. É por isso que o
              <strong> município da unidade</strong> importa tanto: sem ele
              preenchido, o feriado municipal não encontra ninguém e passa em
              branco, sem avisar.
            </p>
          </div>
        </div>
      </section>

      {/* ── As telas ────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">As telas</h2>

        <Tela
          icone={Settings}
          titulo="Configuração"
          href="/escala/configuracao"
          texto="Quatro cadastros pequenos, feitos uma vez: unidades (com cor e município), supervisores, feriados e regras. É a única tela que você visita no começo e quase não volta."
        />
        <Tela
          icone={CalendarRange}
          titulo="Padrão Semanal"
          href="/escala/padrao"
          texto="O que se repete toda semana: cada supervisor, em cada dia de segunda a sexta, numa unidade ou numa situação. A grade mensal nasce daqui — mexer aqui não mexe no mês já gerado."
        />
        <Tela
          icone={CalendarDays}
          titulo="Grade Mensal"
          href="/escala"
          texto="O mês dia a dia — as doze abas Jan…Dez da planilha numa tela só. É onde você gera o mês a partir do padrão e ajusta o que fugir dele."
        />
        <Tela
          icone={CalendarCheck}
          titulo="Conferência"
          href="/escala/conferencia"
          texto="O que as regras dizem sobre o mês, e QUAIS dias furaram cada uma. Regra que o painel não sabe avaliar aparece como desconhecida — nunca como aprovada."
        />
        <Tela
          icone={CalendarDays}
          titulo="Calendário Anual"
          href="/escala/calendario"
          texto="Os doze meses e os feriados do ano. É o único lugar onde se enxerga além do mês; clicar num mês abre a grade dele."
        />
        <Tela
          icone={FileBarChart}
          titulo="Relatórios"
          href="/escala/relatorios"
          texto="Quanto cada supervisor esteve em cada unidade, no ano ou no mês. Sai em PDF e em planilha."
        />
      </section>

      {/* ── As situações ────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <CalendarOff className="size-4 text-gray-500" />
          As situações
        </h2>
        <p className="text-sm text-gray-600">
          Num dia, o supervisor está <strong>numa unidade</strong> ou{" "}
          <strong>numa situação</strong> — nunca nos dois. São estas:
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {SITUACOES.map((s) => (
            <li
              key={s}
              className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
            >
              {s}
            </li>
          ))}
        </ul>
        <p className="text-sm text-gray-600">
          <strong>Feriado</strong> não se escolhe à mão no dia a dia: ele entra
          sozinho, a partir do cadastro de feriados.
        </p>
      </section>

      {/* ── Conferência: o que é dia útil ───────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-900">
          Uma conta que confunde: o que é “dia útil” na Conferência
        </p>
        <p className="mt-1 text-sm text-gray-600">
          É dia de semana <strong>sem feriado geral</strong>. Janeiro de 2026,
          por exemplo, tem 22 dias de semana e <strong>21 com expediente</strong>{" "}
          — o 1º de janeiro não conta. Se contasse, toda regra acusaria falta
          justamente nos dias em que ninguém trabalhou. Feriado{" "}
          <strong>municipal</strong> é a exceção: ele não tira o dia da conta,
          porque alcança só parte da equipe.
        </p>
      </section>

      <p className="text-sm text-gray-500">
        Alguma coisa aqui não bate com o que a tela faz?{" "}
        <Link href="/escala" className="font-semibold text-blue-700 hover:underline">
          Volte para a grade
        </Link>{" "}
        e avise o TI — ajuda que mente é pior do que ajuda que falta.
      </p>
    </div>
  );
}

function Tela({
  icone: Icone,
  titulo,
  href,
  texto,
}: {
  icone: typeof Settings;
  titulo: string;
  href: string;
  texto: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <Link
        href={href}
        className="flex items-center gap-2 text-sm font-bold text-blue-700 hover:underline"
      >
        <Icone className="size-4 text-gray-500" />
        {titulo}
      </Link>
      <p className="mt-1 text-sm text-gray-600">{texto}</p>
    </div>
  );
}

export default function AjudaEscalaPage() {
  return (
    <AjudaComAbas titulo="Guia da Escala de Supervisores">
      <ConteudoAjudaEscalaPage />
    </AjudaComAbas>
  );
}
