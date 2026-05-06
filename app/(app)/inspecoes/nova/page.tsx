"use client";

import { Suspense, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ArrowLeft, Sparkles, Copy, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import {
  useInspecao,
  useInspecoesByEmpresa,
} from "@/lib/hooks/useInspecao";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/store";
import type {
  Cargo,
  Risco,
  Setor,
  TipoCriacao,
} from "@/lib/supabase/types";

type Step = 1 | 2 | 3;

export default function NovaInspecaoPage() {
  return (
    <Suspense fallback={null}>
      <NovaInspecaoInner />
    </Suspense>
  );
}

function NovaInspecaoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  const [step, setStep] = useState<Step>(1);
  const [empresaId, setEmpresaId] = useState<string | null>(
    params.get("empresa")
  );
  const [tipoCriacao, setTipoCriacao] = useState<TipoCriacao>("BRANCO");
  const [inspBaseId, setInspBaseId] = useState<string | null>(null);
  const [dataInsp, setDataInsp] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [obs, setObs] = useState("");

  const { data: inspecoesEmpresa = [] } = useInspecoesByEmpresa(
    tipoCriacao === "REVISAO" ? empresaId : null
  );
  const { data: baseFull } = useInspecao(
    tipoCriacao === "REVISAO" ? inspBaseId : null
  );

  const proximaRevisao = useMemo(() => {
    if (tipoCriacao === "BRANCO") return 1;
    const max = Math.max(0, ...inspecoesEmpresa.map((i) => i.revisao ?? 0));
    return max + 1;
  }, [tipoCriacao, inspecoesEmpresa]);

  const create = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Selecione uma empresa");
      const supabase = createSupabaseBrowserClient();

      const novaId = gerarId("INSP");
      const insertInsp = {
        id_inspecao: novaId,
        id_empresa: empresaId,
        data_inspecao: dataInsp,
        status: "EM_ANDAMENTO" as const,
        revisao: proximaRevisao,
        responsavel: user?.nome ?? null,
        observacoes: obs || null,
        tipo_criacao: tipoCriacao,
        id_inspecao_base: tipoCriacao === "REVISAO" ? inspBaseId : null,
        usuario: user?.email ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: errInsp } = await supabase
        .from("inspecoes")
        .insert(insertInsp as never);
      if (errInsp) throw errInsp;

      // Se for revisão, copia setores, cargos e riscos da inspeção base.
      if (tipoCriacao === "REVISAO" && baseFull) {
        const mapaSetor = new Map<string, string>();
        const mapaCargo = new Map<string, string>();

        const novosSetores = baseFull.setores.map<Partial<Setor>>((s) => {
          const novoId = gerarId("SET");
          mapaSetor.set(s.id_setor, novoId);
          return {
            id_setor: novoId,
            id_inspecao: novaId,
            id_empresa: empresaId,
            setor_ghe: s.setor_ghe,
            descricao: s.descricao,
            conformidade: s.conformidade,
            nao_conformidade: s.nao_conformidade,
          };
        });
        if (novosSetores.length > 0) {
          const { error } = await supabase
            .from("setores")
            .insert(novosSetores as never);
          if (error) throw error;
        }

        const novosCargos = baseFull.cargos.map<Partial<Cargo>>((c) => {
          const novoId = gerarId("CGO");
          mapaCargo.set(c.id_cargo, novoId);
          return {
            id_cargo: novoId,
            id_inspecao: novaId,
            id_empresa: empresaId,
            id_setor: mapaSetor.get(c.id_setor) ?? c.id_setor,
            cargo: c.cargo,
            descricao: c.descricao,
          };
        });
        if (novosCargos.length > 0) {
          const { error } = await supabase
            .from("cargos")
            .insert(novosCargos as never);
          if (error) throw error;
        }

        const novosRiscos = baseFull.riscos.map<Partial<Risco>>((r) => {
          const novoId = gerarId("RSC");
          return {
            ...r,
            id_risco: novoId,
            id_inspecao: novaId,
            id_empresa: empresaId,
            id_setor: r.id_setor ? mapaSetor.get(r.id_setor) ?? r.id_setor : null,
            id_cargo: r.id_cargo ? mapaCargo.get(r.id_cargo) ?? r.id_cargo : null,
          };
        });
        if (novosRiscos.length > 0) {
          const { error } = await supabase
            .from("riscos")
            .insert(novosRiscos as never);
          if (error) throw error;
        }
      }

      return novaId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-recentes"] });
      toast.success("Inspeção criada");
      router.replace(`/inspecoes/${id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar inspeção");
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded p-1 hover:bg-white"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span>Voltar</span>
      </div>

      <Stepper step={step} />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Selecione a Empresa</h2>
            <EmpresaSelect value={empresaId} onChange={setEmpresaId} />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!empresaId}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                Próximo <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Tipo de Criação</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setTipoCriacao("BRANCO");
                  setInspBaseId(null);
                }}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-colors",
                  tipoCriacao === "BRANCO"
                    ? "border-verde-primary bg-verde-light"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <Sparkles className="size-5 text-verde-primary" />
                <p className="mt-2 font-semibold text-gray-900">Em Branco</p>
                <p className="text-xs text-gray-600">
                  Começar do zero, sem dados prévios.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTipoCriacao("REVISAO")}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition-colors",
                  tipoCriacao === "REVISAO"
                    ? "border-verde-primary bg-verde-light"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <Copy className="size-5 text-verde-primary" />
                <p className="mt-2 font-semibold text-gray-900">Nova Revisão</p>
                <p className="text-xs text-gray-600">
                  Copia setores, cargos e riscos de uma inspeção existente.
                </p>
              </button>
            </div>

            {tipoCriacao === "REVISAO" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Inspeção Base
                </label>
                <select
                  value={inspBaseId ?? ""}
                  onChange={(e) => setInspBaseId(e.target.value || null)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
                >
                  <option value="">Selecione...</option>
                  {inspecoesEmpresa.map((i) => (
                    <option key={i.id_inspecao} value={i.id_inspecao}>
                      Rev. {i.revisao} — {i.id_inspecao} ({i.status})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Próxima revisão será: <strong>Rev. {proximaRevisao}</strong>
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={tipoCriacao === "REVISAO" && !inspBaseId}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                Próximo <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Dados da Inspeção</h2>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Data da Inspeção
              </label>
              <input
                type="date"
                value={dataInsp}
                onChange={(e) => setDataInsp(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Observações iniciais
              </label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={4}
                placeholder="Notas iniciais (opcional)"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={create.isPending}
                onClick={() => create.mutate()}
                className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {create.isPending && <Loader2 className="size-4 animate-spin" />}
                Criar Inspeção →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Empresa" },
    { n: 2, label: "Tipo" },
    { n: 3, label: "Dados" },
  ];
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, idx) => (
        <li key={s.n} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold",
              s.n === step
                ? "border-verde-primary bg-verde-primary text-white"
                : s.n < step
                ? "border-verde-primary bg-verde-light text-verde-primary"
                : "border-gray-300 bg-white text-gray-400"
            )}
          >
            {s.n}
          </span>
          <span
            className={cn(
              "text-sm font-medium",
              s.n <= step ? "text-gray-900" : "text-gray-400"
            )}
          >
            {s.label}
          </span>
          {idx < steps.length - 1 && (
            <span className="mx-1 h-px w-8 bg-gray-300" />
          )}
        </li>
      ))}
    </ol>
  );
}
