"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useInspecao } from "@/lib/hooks/useInspecao";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanEdit, useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import StatusBadge from "@/components/inspecoes/StatusBadge";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
import CopiarParaEmpresaModal from "@/components/inspecoes/editor/CopiarParaEmpresaModal";

type TabKey =
  | "setores"
  | "cargos"
  | "riscos"
  | "epis"
  | "fotos"
  | "responsaveis"
  | "pae"
  | "treinamentos"
  | "extintores"
  | "complementos"
  | "observacoes";

interface Props {
  params: Promise<{ id: string }>;
}

export default function InspecaoEditorPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const canEdit = useCanEdit();
  const isAdmin = useIsAdmin();
  const currentUser = useCurrentUser();

  const { data, isLoading, error } = useInspecao(id);
  const { data: empresa } = useEmpresa(data?.inspecao?.id_empresa);
  const [tab, setTab] = useState<TabKey>("setores");
  const [copiarOpen, setCopiarOpen] = useState(false);

  const mudarStatus = useMutation({
    mutationFn: async (novoStatus: "CONCLUIDA" | "EM_ANDAMENTO") => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("inspecoes")
        .update({
          status: novoStatus,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_inspecao", id);
      if (error) throw error;
      return novoStatus;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["inspecao", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(s === "CONCLUIDA" ? "Inspeção concluída" : "Inspeção reaberta");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingSkeleton rows={8} />;
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
  } = data;
  const isConcluida = inspecao.status === "CONCLUIDA";
  // Quem pode reabrir uma inspeção concluída:
  //   - Admin (sempre)
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

  const TABS: { key: TabKey; label: string; icon: typeof Layers; count: number }[] = [
    { key: "setores", label: "Setores", icon: Layers, count: setores.length },
    { key: "cargos", label: "Cargos", icon: Briefcase, count: cargos.length },
    { key: "riscos", label: "Riscos", icon: AlertTriangle, count: riscos.length },
    { key: "epis", label: "EPIs/EPCs", icon: ShieldCheck, count: epis.length },
    { key: "fotos", label: "Fotos", icon: ImageIcon, count: fotos.length },
    { key: "responsaveis", label: "Responsáveis", icon: Users, count: responsaveis.length },
    { key: "pae", label: "PAE", icon: Siren, count: paeContatos.length },
    { key: "treinamentos", label: "Treinamentos", icon: GraduationCap, count: treinamentos.length },
    { key: "extintores", label: "Extintores", icon: Flame, count: extintores.length },
    { key: "complementos", label: "Complementos", icon: Sticker, count: complementos.length },
    { key: "observacoes", label: "Observações", icon: FileText, count: inspecao.observacoes ? 1 : 0 },
  ];

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
            {isConcluida && podeReabrir && (
              <button
                type="button"
                onClick={() => mudarStatus.mutate("EM_ANDAMENTO")}
                disabled={mudarStatus.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-warning bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-warning hover:bg-amber-100 disabled:opacity-60"
                title={
                  isAdmin
                    ? "Reabrir inspeção (Admin)"
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
