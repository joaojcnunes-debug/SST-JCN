"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChartBar,
  Layers,
  Briefcase,
  AlertTriangle,
  ShieldCheck,
  Image as ImageIcon,
  Users,
  FileText,
  Loader2,
  RotateCcw,
  Copy,
  Sticker,
  Siren,
  GraduationCap,
  ClipboardEdit,
  Flame,
  Wrench,
  PersonStanding,
  Accessibility,
  RefreshCw,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useInspecao, type InspecaoFull } from "@/lib/hooks/useInspecao";
import { gravar } from "@/lib/offline/gravar";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import DocumentosEmpresaPainel from "@/components/empresas/DocumentosEmpresaPainel";
import { useCanEdit, useCurrentUser, useIsSupervisor } from "@/lib/hooks/useUsuario";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import { DetalheSkeleton } from "@/components/ui/PageSkeletons";
import { cn, fmtData } from "@/lib/utils";
import SetoresTab from "@/components/inspecoes/editor/tabs/SetoresTab";
import CargosTab from "@/components/inspecoes/editor/tabs/CargosTab";
import RiscosTab from "@/components/inspecoes/editor/tabs/RiscosTab";
import EpisTab from "@/components/inspecoes/editor/tabs/EpisTab";
import FotosTab from "@/components/inspecoes/editor/tabs/FotosTab";
import ResponsaveisTab from "@/components/inspecoes/editor/tabs/ResponsaveisTab";
import ComplementosTab from "@/components/inspecoes/editor/tabs/ComplementosTab";
import ObservacoesTab from "@/components/inspecoes/editor/tabs/ObservacoesTab";
import PaeTab from "@/components/inspecoes/editor/tabs/PaeTab";
import TreinamentosTab from "@/components/inspecoes/editor/tabs/TreinamentosTab";
import ExtintoresTab from "@/components/inspecoes/editor/tabs/ExtintoresTab";
import MaquinasTab from "@/components/inspecoes/editor/tabs/MaquinasTab";
import ErgonomiaTab from "@/components/inspecoes/editor/tabs/ErgonomiaTab";
import { useLaudoErgoDaInspecao } from "@/lib/hooks/useErgonomiaInspecao";
import CopiarParaEmpresaModal from "@/components/inspecoes/editor/CopiarParaEmpresaModal";
import { LevarParaCampo } from "@/components/ui/LevarParaCampo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ehRenovacao, RENOVACAO } from "@/lib/dashboard/inspecoes";
import type { TipoCriacao } from "@/lib/supabase/types";

/**
 * Chaves das abas. Lista em runtime (e não só união de tipos) porque o valor
 * vem da URL e precisa ser validado antes de virar TabKey — `?aba=qualquercoisa`
 * não pode quebrar a tela.
 */
const TAB_KEYS = [
  "setores",
  "cargos",
  "riscos",
  "epis",
  "fotos",
  "responsaveis",
  "pae",
  "treinamentos",
  "extintores",
  "maquinas",
  "aep",
  "aet",
  "complementos",
  "observacoes",
] as const;

type TabKey = (typeof TAB_KEYS)[number];

const TAB_PADRAO: TabKey = "setores";

interface Props {
  params: Promise<{ id: string }>;
}

export default function InspecaoEditorPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const canEdit = useCanEdit();
  // v229: quem supervisiona (nível Aprovação) reabre inspeção de outro, não só Admin.
  const isAdmin = useIsSupervisor();
  const currentUser = useCurrentUser();

  const { data, isLoading, error } = useInspecao(id);
  // v259: só para o número da aba (1 = já tem AEP/AET nesta inspeção).
  const { data: aepDaInspecao } = useLaudoErgoDaInspecao("aep", id);
  const { data: aetDaInspecao } = useLaudoErgoDaInspecao("aet", id);
  const { data: empresa } = useEmpresa(data?.inspecao?.id_empresa);

  // A aba ativa mora na URL (`?aba=riscos`), não em useState. Com useState,
  // recarregar a página, duplicar a aba do navegador ou voltar depois jogava o
  // usuário de volta em "setores" — perdia o contexto no meio do preenchimento.
  // Na URL, o contexto sobrevive aos três casos e o link fica compartilhável.
  const searchParams = useSearchParams();
  const abaUrl = searchParams.get("aba");
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(abaUrl ?? "")
    ? (abaUrl as TabKey)
    : TAB_PADRAO;

  // `replace` e não `push`: trocar de aba não empilha histórico, então o botão
  // Voltar sai do editor em vez de percorrer as 12 abas uma a uma.
  const setTab = useCallback(
    (nova: TabKey) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("aba", nova);
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [copiarOpen, setCopiarOpen] = useState(false);

  /**
   * Concluir e reabrir também funcionam sem sinal: o técnico termina a visita no
   * cliente, e obrigá-lo a lembrar de concluir depois, de volta na base, é
   * pedir para a inspeção ficar aberta por dias.
   *
   * A data de conclusão vem do APARELHO, e não do banco. É a mesma razão da
   * Frota (`db.ts`, `finalizado_em`): a visita terminou às 15h no cliente;
   * deixar o servidor carimbar a hora em que a rede voltou registraria a
   * conclusão às 19h, e o relatório de produtividade sairia mentindo.
   */
  const mudarStatus = useMutation({
    mutationFn: async (novoStatus: "CONCLUIDA" | "EM_ANDAMENTO") => {
      const payload = {
        status: novoStatus,
        // Data de conclusão real: carimba ao CONCLUIR, limpa ao REABRIR.
        concluida_em: novoStatus === "CONCLUIDA" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      const resultado = await gravar({
        tabela: "inspecoes",
        tipo: "update",
        linhas: payload,
        filtro: { id_inspecao: id },
        modulo: "inspecoes",
        id_documento: id,
      });
      return { resultado, payload, novoStatus };
    },
    onSuccess: ({ resultado, payload, novoStatus }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", id] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        toast.success(novoStatus === "CONCLUIDA" ? "Inspeção concluída" : "Inspeção reaberta");
        return;
      }
      // Sem rede não há o que revalidar: o status muda na tela à mão, senão o
      // botão "Concluir" continuaria ali, como se nada tivesse acontecido.
      qc.setQueryData<InspecaoFull>(["inspecao", id], (antigo) =>
        antigo ? { ...antigo, inspecao: { ...antigo.inspecao, ...payload } } : antigo,
      );
      toast.success(
        novoStatus === "CONCLUIDA"
          ? "Conclusão guardada no aparelho"
          : "Reabertura guardada no aparelho",
        { icon: "📵" },
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * RENOVAÇÃO DE DOCUMENTO (23/09) — mutation PRÓPRIA, de propósito.
   *
   * Regra dele: "o outro de concluir não podemos tocar, se não quebra tudo".
   * `mudarStatus` acima é a mesma do Reabrir e fica intocada; esta vive ao
   * lado e grava, além do status, o `tipo_criacao = RENOVACAO` — que é o que
   * tira o registro de todos os gráficos de inspeção (`ehRenovacao`, em
   * lib/dashboard/inspecoes). O registro continua existindo: lista, ficha da
   * empresa e documentos seguem vendo.
   *
   * "concluir" → conclui já como renovação.
   * "marcar"   → inspeção JÁ concluída vira renovação, sem reabrir: só o tipo
   *   muda; status e data de conclusão ficam como estavam. Existe porque as
   *   49 de setembro já estavam concluídas (visto no ar em 23/09).
   * "desfazer" → volta a contar como inspeção. O tipo original não é guardado
   *   em lugar nenhum, então é refeito: sem inspeção base foi "Em Branco";
   *   com base, a empresa da base decide entre revisão e cópia. Sem sinal essa
   *   consulta falha e fica REVISAO — que conta EXATAMENTE como cópia em todo
   *   gráfico (`ehCopiaOuRevisao`), então o número não erra.
   */
  const marcarRenovacao = useMutation({
    mutationFn: async (acao: "concluir" | "marcar" | "desfazer") => {
      const insp = data?.inspecao;
      if (!insp) throw new Error("Inspeção não carregada");
      let payload: Record<string, unknown>;
      if (acao === "concluir") {
        payload = {
          status: "CONCLUIDA",
          concluida_em: new Date().toISOString(),
          tipo_criacao: RENOVACAO,
          updated_at: new Date().toISOString(),
        };
      } else if (acao === "marcar") {
        payload = { tipo_criacao: RENOVACAO, updated_at: new Date().toISOString() };
      } else {
        let tipoOriginal: TipoCriacao = "BRANCO";
        if (insp.id_inspecao_base) {
          tipoOriginal = "REVISAO";
          try {
            const { data: base } = await createSupabaseBrowserClient()
              .from("inspecoes")
              .select("id_empresa")
              .eq("id_inspecao", insp.id_inspecao_base)
              .maybeSingle();
            const empBase = (base as { id_empresa?: string } | null)?.id_empresa;
            if (empBase && empBase !== insp.id_empresa) tipoOriginal = "COPIA_EMPRESA";
          } catch {
            /* sem sinal: fica REVISAO (ver acima) */
          }
        }
        payload = { tipo_criacao: tipoOriginal, updated_at: new Date().toISOString() };
      }
      const resultado = await gravar({
        tabela: "inspecoes",
        tipo: "update",
        linhas: payload,
        filtro: { id_inspecao: id },
        modulo: "inspecoes",
        id_documento: id,
      });
      return { resultado, payload, acao };
    },
    onSuccess: ({ resultado, payload, acao }) => {
      const msg =
        acao === "desfazer"
          ? "Voltou a contar como inspeção"
          : "Marcada como renovação — não conta nos gráficos de inspeção";
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", id] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["inspecoes-por-mes"] });
        qc.invalidateQueries({ queryKey: ["inspecoes-status"] });
        toast.success(msg);
        return;
      }
      qc.setQueryData<InspecaoFull>(["inspecao", id], (antigo) =>
        antigo ? { ...antigo, inspecao: { ...antigo.inspecao, ...payload } } : antigo,
      );
      toast.success(`${msg} (guardado no aparelho)`, { icon: "📵" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <DetalheSkeleton />;
  if (error)
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar inspeção: {(error as Error).message}
      </div>
    );
  if (!data)
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Inspeção não encontrada.
      </div>
    );

  const {
    inspecao,
    setores,
    cargos,
    riscos,
    epis,
    fotos,
    responsaveis,
    complementos,
    paeContatos,
    treinamentos,
    treinamentosSetor,
    treinamentosCargo,
    treinamentosRisco,
    extintores,
    maquinas,
  } = data;
  const isConcluida = inspecao.status === "CONCLUIDA";
  const isRenovacao = ehRenovacao(inspecao.tipo_criacao);
  // Quem pode reabrir uma inspeção concluída:
  //   - Supervisor (nível Aprovação ou Admin) — sempre
  //   - Técnico que criou a inspeção (inspecao.usuario === email do logado)
  // Visualizador e técnicos de outras inspeções não podem.
  const podeReabrir =
    isAdmin ||
    (canEdit &&
      currentUser?.email &&
      (inspecao.usuario ?? "").toLowerCase() ===
        currentUser.email.toLowerCase());
  // V2: usuários podem editar inspeções concluídas (spec exige).
  const readOnly = !canEdit;

  // v259: as abas AEP/AET usam as tabelas dos módulos — só para quem tem o módulo.
  const temModulo = (m: "aep" | "aet") =>
    currentUser?.perfil === "Admin" || (currentUser?.modulos_permitidos ?? []).includes(m);

  const TABS_TODAS: { key: TabKey; label: string; icon: typeof Layers; count: number }[] = [
    { key: "setores", label: "Setores", icon: Layers, count: setores.length },
    { key: "cargos", label: "Cargos", icon: Briefcase, count: cargos.length },
    { key: "riscos", label: "Riscos", icon: AlertTriangle, count: riscos.length },
    { key: "epis", label: "EPIs/EPCs", icon: ShieldCheck, count: epis.length },
    { key: "fotos", label: "Fotos", icon: ImageIcon, count: fotos.length },
    { key: "responsaveis", label: "Responsáveis", icon: Users, count: responsaveis.length },
    { key: "pae", label: "PAE", icon: Siren, count: paeContatos.length },
    { key: "treinamentos", label: "Treinamentos", icon: GraduationCap, count: treinamentos.length },
    { key: "extintores", label: "Extintores", icon: Flame, count: extintores.length },
    { key: "maquinas", label: "Máquinas", icon: Wrench, count: maquinas.length },
    { key: "aep", label: "AEP", icon: PersonStanding, count: aepDaInspecao ? 1 : 0 },
    { key: "aet", label: "AET", icon: Accessibility, count: aetDaInspecao ? 1 : 0 },
    { key: "complementos", label: "Complementos", icon: Sticker, count: complementos.length },
    { key: "observacoes", label: "Observações", icon: FileText, count: inspecao.observacoes ? 1 : 0 },
  ];
  const TABS = TABS_TODAS.filter((t) => (t.key !== "aep" && t.key !== "aet") || temModulo(t.key));

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" /> Voltar
      </button>

      {/* Cabeçalho */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {empresa?.nome_empresa ?? "—"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="font-mono">{inspecao.id_inspecao}</span>
              <span>·</span>
              <span>Revisão {inspecao.revisao}</span>
              <span>·</span>
              <StatusBadge status={inspecao.status} />
              {isRenovacao && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
                  title="Registro de documento — não conta nos gráficos de inspeção"
                >
                  <RefreshCw className="size-3" /> Renovação
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/inspecoes/${id}/relatorio`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChartBar className="size-4" /> Relatório
            </Link>
            <Link
              href={`/inspecoes/${id}/pgr`}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-warning bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-warning hover:bg-amber-100"
              title="PGR / Inventário de Riscos (NR-1)"
            >
              <FileText className="size-4" /> PGR
            </Link>
            <Link
              href={`/inspecoes/${id}/ficha`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Gerar ficha em branco para preenchimento em campo"
            >
              <ClipboardEdit className="size-4" /> Ficha em Branco
            </Link>
            {canEdit && (
              <button
                type="button"
                onClick={() => setCopiarOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="Copiar inspeção para outra empresa"
              >
                <Copy className="size-4" /> Copiar p/ Empresa
              </button>
            )}
            {canEdit && !isConcluida && (
              <button
                type="button"
                onClick={() => mudarStatus.mutate("CONCLUIDA")}
                disabled={mudarStatus.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
              >
                {mudarStatus.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Concluir
              </button>
            )}
            {canEdit && !isConcluida && (
              <button
                type="button"
                onClick={() => marcarRenovacao.mutate("concluir")}
                disabled={marcarRenovacao.isPending || mudarStatus.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary bg-white px-3 py-1.5 text-sm font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-60"
                title="Conclui sem contar como inspeção: serve para registrar a empresa ou a renovação dos documentos dela"
              >
                {marcarRenovacao.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Concluir como renovação
              </button>
            )}
            {canEdit && isConcluida && !isRenovacao && (
              <button
                type="button"
                onClick={() => marcarRenovacao.mutate("marcar")}
                disabled={marcarRenovacao.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary bg-white px-3 py-1.5 text-sm font-semibold text-verde-primary hover:bg-verde-light disabled:opacity-60"
                title="Continua concluída, mas deixa de contar como inspeção: serve para registro de empresa ou renovação de documentos"
              >
                {marcarRenovacao.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Marcar como renovação
              </button>
            )}
            {isConcluida && podeReabrir && (
              <button
                type="button"
                onClick={() => mudarStatus.mutate("EM_ANDAMENTO")}
                disabled={mudarStatus.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-warning bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-warning hover:bg-amber-100 disabled:opacity-60"
                title={
                  isAdmin
                    ? "Reabrir inspeção (supervisão)"
                    : "Reabrir sua inspeção"
                }
              >
                {mudarStatus.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Reabrir
              </button>
            )}
          </div>
        </div>
      </div>

      {isRenovacao && (
        <div className="flex flex-col gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 md:flex-row md:items-center md:justify-between">
          <p>
            <strong>Renovação de documento.</strong> Este registro não conta nos
            gráficos de inspeção, na produtividade nem por técnico — continua na
            lista, na ficha da empresa e nos documentos.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => marcarRenovacao.mutate("desfazer")}
              disabled={marcarRenovacao.isPending}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-60"
            >
              {marcarRenovacao.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Voltar a contar como inspeção
            </button>
          )}
        </div>
      )}

      {/* Dados da empresa */}
      <EmpresaInfoPanel
        empresa={empresa ?? null}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      />

      {/* Situação do DRPS, QPS, AEP e AET da empresa — só para quem administra. */}
      {isAdmin && (
        <DocumentosEmpresaPainel
          idEmpresa={inspecao.id_empresa}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        />
      )}

      {/* Levar para o campo: acima das abas de propósito. A decisão de copiar a
          inspeção para o aparelho é tomada ANTES de sair da base, e não no meio
          do preenchimento de uma aba — se estivesse lá dentro, o técnico só
          esbarraria nela quando já não tivesse sinal para baixar nada. */}
      <LevarParaCampo idDocumento={id} dados={data} rotulo="Inspeção" />

      {/* Abas */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <nav className="flex min-w-max border-b border-gray-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-verde-primary text-verde-primary"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                )}
              >
                <Icon className="size-4" />
                {t.label}
                {t.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      active
                        ? "bg-verde-primary text-white"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4">
          {tab === "setores" && (
            <SetoresTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              setores={setores}
              readOnly={readOnly}
            />
          )}
          {tab === "cargos" && (
            <CargosTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              setores={setores}
              cargos={cargos}
              readOnly={readOnly}
            />
          )}
          {tab === "riscos" && (
            <RiscosTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              setores={setores}
              cargos={cargos}
              riscos={riscos}
              readOnly={readOnly}
              referenciaInspecao={[
                empresa?.nome_empresa,
                inspecao.data_inspecao ? fmtData(inspecao.data_inspecao) : null,
                id,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          )}
          {tab === "epis" && (
            <EpisTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              setores={setores}
              riscos={riscos}
              epis={epis}
              readOnly={readOnly}
            />
          )}
          {tab === "fotos" && (
            <FotosTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              fotos={fotos}
              setores={setores}
              readOnly={readOnly}
            />
          )}
          {tab === "responsaveis" && (
            <ResponsaveisTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              responsaveis={responsaveis}
              readOnly={readOnly}
            />
          )}
          {tab === "pae" && (
            <PaeTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              contatos={paeContatos}
              readOnly={readOnly}
            />
          )}
          {tab === "treinamentos" && (
            <TreinamentosTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              setores={setores}
              cargos={cargos}
              riscos={riscos}
              treinamentos={treinamentos}
              treinamentosSetor={treinamentosSetor}
              treinamentosCargo={treinamentosCargo}
              treinamentosRisco={treinamentosRisco}
              readOnly={readOnly}
            />
          )}
          {tab === "extintores" && (
            <ExtintoresTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              setores={setores}
              extintores={extintores}
              readOnly={readOnly}
            />
          )}
          {tab === "maquinas" && (
            <MaquinasTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              setores={setores}
              maquinas={maquinas}
              readOnly={readOnly}
            />
          )}
          {(tab === "aep" || tab === "aet") && temModulo(tab) && (
            <ErgonomiaTab
              key={tab}
              tipo={tab}
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              empresa={empresa}
              setores={setores}
              cargos={cargos}
              maquinas={maquinas}
              readOnly={readOnly}
            />
          )}
          {tab === "complementos" && (
            <ComplementosTab
              idInspecao={id}
              idEmpresa={inspecao.id_empresa}
              setores={setores}
              complementos={complementos}
              readOnly={readOnly}
            />
          )}
          {tab === "observacoes" && (
            <ObservacoesTab
              idInspecao={id}
              observacoes={inspecao.observacoes ?? null}
              readOnly={readOnly}
            />
          )}
        </div>
      </div>

      <CopiarParaEmpresaModal
        open={copiarOpen}
        onClose={() => setCopiarOpen(false)}
        idInspecao={id}
        idEmpresaOrigem={inspecao.id_empresa}
      />
    </div>
  );
}
