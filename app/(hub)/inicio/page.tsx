"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import { useConfiguracoes } from "@/lib/hooks/useConfiguracoes";
import { useVisaoGeralUnidades } from "@/lib/hooks/useVisaoGeralUnidades";
import { useHomeStats } from "@/lib/hooks/useHomeStats";
import { useAtividadeContexto } from "@/lib/hooks/useAtividadeContexto";
import { useVencimentos } from "@/lib/hooks/useVencimentos";
import { useLaudosValidade } from "@/lib/hooks/useLaudosValidade";
import { useInspecoesStatus } from "@/lib/hooks/useInspecoesStatus";
import { useInspecoesPorMes } from "@/lib/hooks/useInspecoesPorMes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import VisaoGeralView, { type PendenciaItem } from "@/components/visao-geral/VisaoGeralView";

export default function VisaoGeralPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const { data: configs } = useConfiguracoes();
  const { data, isLoading, error } = useVisaoGeralUnidades();
  const stats = useHomeStats();
  const { data: ctx, isLoading: ctxLoading } = useAtividadeContexto();
  const { data: vencimentos, isLoading: vencLoading } = useVencimentos();
  const { data: laudosVal = [], isLoading: laudosLoading } = useLaudosValidade();
  const { data: inspecoesPorStatus = [] } = useInspecoesStatus();
  const { data: serieInspecoes = [] } = useInspecoesPorMes();

  // Saúde dos documentos (anel): total + composição por status de validade.
  // Enquanto carrega devolve undefined: a Visão geral ESCONDE o anel nesse caso,
  // e desenhar "0 documentos" seria afirmar algo que ainda não se sabe.
  const saude = useMemo(() => {
    if (laudosLoading) return undefined;
    const s = { total: laudosVal.length, emDia: 0, vencendo: 0, vencido: 0, semValidade: 0 };
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (const l of laudosVal) {
      if (!l.data_validade) { s.semValidade++; continue; }
      const dias = Math.round(
        (new Date(l.data_validade + "T00:00:00").getTime() - hoje.getTime()) / 86_400_000,
      );
      if (dias < 0) s.vencido++;
      else if (dias <= 60) s.vencendo++;
      else s.emDia++;
    }
    return s;
  }, [laudosVal, laudosLoading]);

  // Laudos por tipo (donut) — exclui inspeções.
  const laudosPorTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of laudosVal) {
      if (l.tipo === "Inspeção") continue;
      m.set(l.tipo, (m.get(l.tipo) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([tipo, valor]) => ({ tipo, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [laudosVal]);

  // Inspeções por mês (barras) — últimos 6 meses, CONCLUÍDAS pela data de
  // conclusão: o mesmo número do card do dashboard, pela mesma régua. Até
  // 15/09 contava por conta própria pela data da VISITA (via laudosVal) e
  // mostrava 140 para agosto onde o dashboard mostra 153.
  const inspecoesPorMes = useMemo(
    () => serieInspecoes.map((m) => ({ mes: m.mes, valor: m.concluidas })),
    [serieInspecoes],
  );

  // Enriquece a atividade com nome da empresa + técnico vinculado (via id_empresa).
  const atividade = stats.atividadeRecente.map((a) => ({
    ...a,
    empresaNome: a.id_empresa ? ctx?.nomePorEmpresa.get(a.id_empresa) ?? null : null,
    tecnicoVinculado: a.id_empresa ? ctx?.tecnicoPorEmpresa.get(a.id_empresa) ?? null : null,
  }));

  // Pendências = itens não finalizados por módulo (rascunho/em andamento).
  const pendencias: PendenciaItem[] = [
    { label: "Inspeções (Painel SST)", pendente: stats.painel?.pendente ?? 0, href: "/dashboard" },
    { label: "Conformidade", pendente: stats.conformidade?.pendente ?? 0, href: "/relatorio-conformidade" },
    { label: "Não Conformidade", pendente: stats.nao_conformidade?.pendente ?? 0, href: "/relatorio-nao-conformidade" },
    { label: "Psicossocial (DRPS)", pendente: stats.psicossocial?.pendente ?? 0, href: "/psicossocial" },
    { label: "Apreciação NR-12", pendente: stats.apreciacao_maquinas?.pendente ?? 0, href: "/apreciacao-maquinas" },
    { label: "AET", pendente: stats.aet?.pendente ?? 0, href: "/aet" },
    { label: "AEP", pendente: stats.aep?.pendente ?? 0, href: "/aep" },
  ]
    .filter((p) => p.pendente > 0)
    .sort((a, b) => b.pendente - a.pendente);

  // Cliente não acessa o painel interno — vai pro portal.
  useEffect(() => {
    if (user?.perfil === "Cliente") router.replace("/portal-cliente/inicio");
  }, [user?.perfil, router]);

  async function handleLogout() {
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      /* segue mesmo offline */
    }
    logout();
    toast.success("Sessão encerrada");
    router.replace("/login");
  }

  return (
    <VisaoGeralView
      logoUrl={configs?.logo_url}
      userNome={user?.nome}
      userPerfil={user?.perfil}
      isAdmin={user?.perfil === "Admin"}
      vinculadasCount={user?.empresas_vinculadas?.length ?? 0}
      data={data}
      isLoading={isLoading}
      hasError={!!error}
      atividade={atividade}
      pendencias={pendencias}
      statsLoading={stats.isLoading || ctxLoading}
      vencimentos={vencimentos}
      vencimentosLoading={vencLoading}
      saude={saude}
      laudosPorTipo={laudosPorTipo}
      inspecoesPorMes={inspecoesPorMes}
      inspecoesPorStatus={inspecoesPorStatus}
      onLogout={handleLogout}
    />
  );
}
