"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  ImageIcon,
  KeyRound,
  Link2Off,
  Loader2,
  RefreshCw,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useOperacoesOffline } from "@/lib/hooks/useOperacoesOffline";
import { formatarBytes } from "@/lib/frota/fotos";
import type { OperacaoOffline } from "@/lib/offline/operacoes";
import { cn } from "@/lib/utils";

/**
 * O que a inspeção registrou em campo e ainda não chegou ao painel.
 *
 * ESTA TELA É A CONTRAPARTIDA DO OFFLINE, pela mesma razão da tela irmã da Frota:
 * guardar no celular sem ter onde ver o que ficou para trás transforma "funciona
 * sem internet" em "some sem avisar". Enquanto houver uma linha aqui, o trabalho
 * do técnico não terminou.
 *
 * A diferença para a tela da Frota é o que cada linha significa. Lá é uma saída,
 * que o técnico reconhece pela placa. Aqui é uma OPERAÇÃO — e "insert em riscos"
 * não quer dizer nada para quem passou a manhã andando pela fábrica. Por isso
 * `descrever()` existe: a tela fala de risco, setor e foto, não de tabela.
 */
export default function PendenciasInspecaoPage() {
  const {
    aguardando,
    travadas,
    recusadas,
    enviadas,
    naoResolvidas,
    carregando,
    sincronizando,
    online,
    espaco,
    precisaReautenticar,
    enviarAgora,
  } = useOperacoesOffline();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Guardado no aparelho</h1>
          <p className="text-sm text-gray-500">
            {carregando
              ? "Lendo o aparelho…"
              : naoResolvidas === 0
                ? "Nada pendente — tudo o que você registrou já está no painel."
                : `${naoResolvidas} ${naoResolvidas === 1 ? "registro ainda não resolvido" : "registros ainda não resolvidos"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              online ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
            )}
          >
            {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online ? "Com rede" : "Sem rede"}
          </span>
          <button
            type="button"
            onClick={() => void enviarAgora()}
            disabled={sincronizando || !online}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sincronizando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Enviar agora
          </button>
        </div>
      </div>

      {/* A sessão do Cloudflare Access caiu. É o único erro que se resolve
          sozinho ao entrar de novo — e por isso vem antes de tudo. */}
      {precisaReautenticar && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Sua sessão expirou</p>
            <p className="mt-0.5 text-amber-800">
              Nada foi perdido. Recarregue a página, entre de novo e volte aqui — o envio continua
              de onde parou.
            </p>
          </div>
        </div>
      )}

      {espaco && espaco.total > 0 && espaco.usado / espaco.total > 0.8 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-sm text-red-900">
            <p className="font-semibold">O aparelho está quase sem espaço</p>
            <p className="mt-0.5 text-red-800">
              {formatarBytes(espaco.usado)} de {formatarBytes(espaco.total)} em uso. Envie o que
              está pendente antes de registrar mais coisas.
            </p>
          </div>
        </div>
      )}

      {!carregando && naoResolvidas === 0 && enviadas.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <CheckCircle2 className="mx-auto size-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nada guardado no aparelho</p>
          <p className="mt-1 text-sm text-gray-500">
            O que você registrar sem internet aparece aqui até subir para o painel.
          </p>
        </div>
      )}

      <Secao
        titulo="Aguardando envio"
        descricao="Guardado no aparelho. Sobe sozinho assim que houver rede."
        icone={<Upload className="size-4 text-blue-600" />}
        operacoes={aguardando}
        cor="border-blue-200"
      />

      <Secao
        titulo="Esperando outro registro"
        descricao="Depende de algo que ainda não subiu. Resolva o registro recusado abaixo e estes sobem sozinhos em seguida."
        icone={<Link2Off className="size-4 text-amber-600" />}
        operacoes={travadas}
        cor="border-amber-300"
      />

      <Secao
        titulo="Recusados pelo painel"
        descricao="O servidor respondeu e disse não. Tentar de novo sem mudar nada dá o mesmo resultado — leia o motivo e corrija na inspeção."
        icone={<CloudOff className="size-4 text-red-600" />}
        operacoes={recusadas}
        cor="border-red-300"
      />

      <Secao
        titulo="Já enviados"
        descricao="Confirmados no painel. Somem desta lista depois de uma semana."
        icone={<CheckCircle2 className="size-4 text-emerald-600" />}
        operacoes={enviadas}
        cor="border-emerald-200"
      />
    </div>
  );
}

/**
 * Da tabela para a língua do técnico.
 *
 * O plural sai da contagem de linhas porque uma operação só costuma criar
 * vários registros de uma vez: marcar três setores num risco cria três riscos
 * (`RiscoForm.tsx:568-579`). Mostrar "risco novo" quando são três esconderia
 * justamente o que ele precisa conferir.
 */
const NOMES: Record<string, [string, string]> = {
  // Inspeção
  inspecoes: ["inspeção", "inspeções"],
  riscos: ["risco", "riscos"],
  setores: ["setor", "setores"],
  cargos: ["cargo", "cargos"],
  epi_epc: ["EPI/EPC", "EPIs/EPCs"],
  fotos: ["foto", "fotos"],
  responsaveis: ["responsável", "responsáveis"],
  complementos: ["complemento", "complementos"],
  extintores: ["extintor", "extintores"],
  treinamentos_nr: ["treinamento", "treinamentos"],
  treinamentos_setor: ["vínculo de setor", "vínculos de setor"],
  treinamentos_cargo: ["vínculo de cargo", "vínculos de cargo"],
  treinamentos_risco: ["vínculo de risco", "vínculos de risco"],
  inspecao_maquinas: ["máquina", "máquinas"],
  inspecao_maquinas_setores: ["vínculo de setor", "vínculos de setor"],
  pae_contatos: ["contato do PAE", "contatos do PAE"],

  // Não-conformidade
  relatorios_nao_conformidade: ["relatório", "relatórios"],
  relatorios_nao_conformidade_itens: ["não-conformidade", "não-conformidades"],

  // Conformidade
  relatorios_conformidade: ["relatório", "relatórios"],
  relatorios_conformidade_itens: ["item do checklist", "itens do checklist"],

  // Máquinas e equipamentos
  apreciacoes_maquinas: ["apreciação", "apreciações"],
  apreciacoes_maquinas_itens: ["item da apreciação", "itens da apreciação"],
  apreciacao_fichas_maquina: ["máquina do laudo", "máquinas do laudo"],
  inventario_maquinas: ["máquina", "máquinas"],
  equipamentos: ["equipamento", "equipamentos"],

  // Ergonomia. O laudo inteiro é uma linha só — os setores moram num jsonb
  // dentro dela —, então toda gravação de campo aparece como "alteração".
  aet_relatorios: ["AET", "AETs"],
  aep_relatorios: ["AEP", "AEPs"],

  // Questionários
  qps_respondentes: ["respondente", "respondentes"],
};

/**
 * Para onde o técnico volta ao tocar na pendência.
 *
 * O mapa existe porque a fila serve mais de um módulo: sem ele toda pendência
 * apontaria para `/inspecoes/...`, e o técnico que registrou uma
 * não-conformidade cairia numa tela de inspeção que não existe.
 */
const ROTAS: Record<string, (id: string) => string> = {
  inspecoes: (id) => `/inspecoes/${id}`,
  "nao-conformidade": (id) => `/relatorio-nao-conformidade/${id}`,
  conformidade: (id) => `/relatorio-conformidade/${id}`,
  "apreciacao-maquinas": (id) => `/apreciacao-maquinas/${id}`,
  // A tela do inventário saiu (2026-09-14); a máquina continua na Relação.
  "inventario-maquinas": () => `/apreciacao-maquinas/relacao-maquinas`,
  equipamentos: (id) => `/equipamentos/${id}`,
  aet: (id) => `/aet/${id}`,
  aep: (id) => `/aep/${id}`,
  questionarios: (id) => `/questionarios-psicossociais/${id}`,
};

function descrever(o: OperacaoOffline): string {
  const quantidade = Array.isArray(o.linhas) ? o.linhas.length : 1;
  // Tabela sem tradução ainda é melhor que "undefined" — o técnico chama o dev
  // com o nome certo na mão, e o dev acrescenta a linha no mapa acima.
  const [singular, plural] = NOMES[o.tabela] ?? [o.tabela, o.tabela];
  const nome = quantidade === 1 ? singular : plural;

  if (o.tipo === "insert") return `${quantidade} ${nome} ${quantidade === 1 ? "novo" : "novos"}`;
  if (o.tipo === "update") return `Alteração em ${nome}`;
  return `Exclusão de ${nome}`;
}

function Secao({
  titulo,
  descricao,
  icone,
  operacoes,
  cor,
}: {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  operacoes: OperacaoOffline[];
  cor: string;
}) {
  if (operacoes.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icone}
        <h2 className="text-sm font-semibold text-gray-900">
          {titulo} <span className="font-normal text-gray-400">· {operacoes.length}</span>
        </h2>
      </div>
      <p className="text-xs text-gray-500">{descricao}</p>

      <ul className="space-y-2">
        {operacoes.map((o) => (
          <li key={o.id} className={cn("rounded-lg border bg-white p-3", cor)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{descrever(o)}</p>
                {/* Módulo sem rota mapeada vira texto, não link.
                    Um link que leva à tela errada é pior que nenhum link: o
                    técnico clica, cai num "não encontrado" e passa a achar que
                    o registro se perdeu. */}
                {ROTAS[o.modulo] ? (
                  <Link
                    href={ROTAS[o.modulo](o.id_documento)}
                    className="mt-0.5 inline-block font-mono text-xs text-blue-700 hover:underline"
                  >
                    {o.id_documento}
                  </Link>
                ) : (
                  <span className="mt-0.5 inline-block font-mono text-xs text-gray-500">
                    {o.id_documento}
                  </span>
                )}

                {o.imagens.length > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                    <ImageIcon className="size-3.5" />
                    {o.imagens.length} {o.imagens.length === 1 ? "foto" : "fotos"} no aparelho
                  </p>
                )}

                {/* O motivo, quando existe. Mensagem de banco é ríspida, mas
                    esconder deixaria o técnico sem nada para levar ao gerente. */}
                {o.ultimo_erro && (
                  <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    {o.ultimo_erro}
                  </p>
                )}
                {o.tentativas > 0 && o.status !== "ENVIADA" && (
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {o.tentativas} {o.tentativas === 1 ? "tentativa" : "tentativas"}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="font-mono text-xs tabular-nums text-gray-500">
                  {new Date(o.criado_em).toLocaleDateString("pt-BR")}
                </p>
                <p className="font-mono text-xs tabular-nums text-gray-400">
                  {new Date(o.criado_em).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
