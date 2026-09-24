"use client";

import Link from "next/link";
import { HardDrive, ArrowLeftRight, Info } from "lucide-react";
import { TIPOS_EQUIPAMENTO } from "@/lib/equipamentos/tipos";
import AjudaComAbas from "@/components/novidades/AjudaComAbas";

/**
 * Ajuda do módulo Equipamentos.
 *
 * Curta de propósito. A ajuda do inventário NR-12 tem 641 linhas e descreve as
 * três categorias juntas — era parte do problema que a separação resolve.
 * Aqui só entra o que é deste módulo, escrito para quem opera, não para quem
 * programa.
 */
function ConteudoAjudaEquipamentosPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Como usar os Equipamentos</h1>
        <p className="mt-1 text-sm text-gray-600">
          Este módulo é o patrimônio interno da JCN Consultoria — o que é nosso. Máquinas
          de empresas clientes ficam na aba Máquinas da inspeção e na{" "}
          <Link href="/apreciacao-maquinas/relacao-maquinas" className="font-semibold text-blue-700 hover:underline">
            Relação de Máquinas
          </Link>{" "}
          do módulo Apreciação.
        </p>
      </div>

      {/* ── O que mudou ─────────────────────────────────────── */}
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-700" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">O que mudou em agosto de 2026</p>
            <p className="mt-1">
              Notebooks, monitores, ar-condicionado e afins <strong>saíram do
              Inventário</strong> e passaram a viver aqui, com cadastro próprio.
              Nada se perdeu: todos os itens vieram junto, com foto e número de
              patrimônio. Se você tinha o endereço antigo salvo, ele traz você
              para cá sozinho.
            </p>
          </div>
        </div>
      </section>

      {/* ── Cadastrar ───────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <HardDrive className="size-4 text-gray-500" />
          Cadastrar um equipamento
        </h2>
        <p className="text-sm text-gray-600">
          Só dois campos são obrigatórios: o <strong>nome</strong> e a{" "}
          <strong>base</strong> onde o item está. Todo o resto pode ficar em
          branco e ser preenchido depois — inclusive o setor, porque item em
          estoque muitas vezes ainda não tem setor.
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            As quatro abas do cadastro
          </p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold text-gray-700">Identificação</dt>
              <dd className="text-gray-600">Nome, tipo, fabricante, modelo, série, patrimônio e a foto.</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold text-gray-700">Aquisição</dt>
              <dd className="text-gray-600">
                Fornecedor, nota fiscal, data, valor e garantia. <em>Tudo opcional.</em>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold text-gray-700">Localização</dt>
              <dd className="text-gray-600">Base, setor, onde exatamente está e quem responde por ele.</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-semibold text-gray-700">Observações</dt>
              <dd className="text-gray-600">Qualquer coisa que ajude a identificar ou cuidar do item.</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── Patrimônio ──────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-base font-bold text-gray-900">O número de patrimônio não pode repetir</h2>
        <p className="text-sm text-gray-600">
          É a plaqueta colada no aparelho. Se você digitar um número que já está
          em outro equipamento, o sistema avisa <strong>qual</strong> item já usa
          aquele número, para você conferir a etiqueta antes de salvar.
          Equipamento sem plaqueta pode ficar sem número — vários podem.
        </p>
      </section>

      {/* ── Tipos ───────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-base font-bold text-gray-900">Os tipos são uma lista</h2>
        <p className="text-sm text-gray-600">
          O tipo virou uma lista fechada para o filtro funcionar. Antes era texto
          livre, e a mesma coisa aparecia escrita de várias formas — “Ar”,
          “Ar-condicionado” e “Split” eram três grupos diferentes na hora de
          contar.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TIPOS_EQUIPAMENTO.map((g) => (
            <div key={g.grupo} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {g.grupo}
              </p>
              <p className="mt-1 text-sm text-gray-700">{g.tipos.join(" · ")}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600">
          Se o item não for nenhum desses, escolha{" "}
          <strong>“Outro (escrever)…”</strong> e digite. Se esse tipo virar
          comum, vale pedir para acrescentá-lo à lista.
        </p>
      </section>

      {/* ── Transferência ───────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <ArrowLeftRight className="size-4 text-gray-500" />
          Transferir entre bases
        </h2>
        <p className="text-sm text-gray-600">
          Fica em <strong>Movimentação</strong>, no botão <em>Transferir</em>. Não
          existe mais item separado no menu: transferência é uma movimentação, e
          o extrato, o histórico e o termo em PDF vivem na mesma tela.
        </p>
        <p className="text-sm text-gray-600">
          <strong>O tipo do item decide como funciona.</strong> Fone, mouse e cabo
          vão por <em>quantidade</em>: mandar 2 tira 2 do saldo da base de origem
          na hora do registro, e eles ficam <em>em trânsito</em> até alguém
          assinar. Computador e notebook vão por <em>aparelho identificado</em>:
          o aparelho <strong>continua na base de origem</strong> e só muda de
          lugar quando o recebimento for assinado — ele é um só, e some de verdade
          se ninguém souber onde está.
        </p>
        <p className="text-sm text-gray-600">
          Nos dois casos quem recebe assina, quem registrou pode cancelar
          enquanto ninguém aceitou, e o <strong>termo em PDF</strong> sai do
          histórico, marcando uma ou várias linhas de uma vez.
        </p>
      </section>

      {/* ── Movimentação: o que mais existe lá ──────────────── */}
      <section className="space-y-2">
        <h2 className="text-base font-bold text-gray-900">O que mais está em Movimentação</h2>
        <p className="text-sm text-gray-600">
          Tudo o que muda a situação ou o lugar de um item passa por lá, e cada
          ação fica no extrato com quem fez e quando:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>
            <strong>Estoque por base</strong> — quantos mouses temos em cada lugar.
            O produto é cadastrado no próprio <em>Dar entrada</em> (“+ Novo”), e a
            entrada soma no saldo da base. Periféricos aparecem também na Visão
            geral e podem ser retirados por quantidade.
          </li>
          <li>
            <strong>Entrada por nota fiscal</strong> — importa a NF-e e cria os
            itens de uma vez.
          </li>
          <li>
            <strong>Entrega a funcionário</strong> — com termo de retirada em
            PDF; a assinatura de quem entrega e de quem recebe é colhida pela
            biometria, no histórico de entregas, ou no papel, nas duas vias.
          </li>
          <li>
            <strong>Devolução</strong> — registra a volta, e a situação do
            aparelho muda com o motivo (avaria com descrição obrigatória). A
            planilha exportada traz a aba <em>Com quem está</em>, com o que
            está na mão de cada pessoa.
          </li>
        </ul>
        <p className="text-sm text-gray-600">
          Por isso a <strong>situação</strong> do equipamento não se edita no
          cadastro: ela muda pela devolução, com o motivo registrado — assim o
          histórico responde “por que este item saiu de operação”.
        </p>
      </section>
    </div>
  );
}

/**
 * A ajuda deste módulo ganhou a aba Atualizações (01/09). O conteúdo acima
 * continua exatamente como estava — quem monta as abas é o AjudaComAbas, e a
 * lista de novidades vive num componente só, compartilhado pelos 11 módulos.
 */
export default function AjudaEquipamentosPage() {
  return (
    <AjudaComAbas titulo="Guia dos Equipamentos">
      <ConteudoAjudaEquipamentosPage />
    </AjudaComAbas>
  );
}
