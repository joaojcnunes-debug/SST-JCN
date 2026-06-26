"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { useCriarInvestigacao } from "@/lib/hooks/useInvestigacaoAcidente";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";

export default function NovaInvestigacaoPage() {
  const router = useRouter();
  const criar = useCriarInvestigacao();
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId) return;
    const id = await criar.mutateAsync(empresaId);
    router.push(`/investigacao-acidente/${id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="size-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nova investigação</h1>
          <p className="text-sm text-gray-500">Investigação de Acidente de Trabalho</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="reveal-up space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Empresa *</label>
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} allowAll placeholder="Selecione a empresa..." />
        </div>
        <p className="text-xs text-gray-400">
          Os dados do acidente, acidentado, causas e medidas são preenchidos na próxima tela.
        </p>
        <button
          type="submit"
          disabled={!empresaId || criar.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-4" />
          {criar.isPending ? "Criando..." : "Criar e continuar"}
        </button>
      </form>
    </div>
  );
}
