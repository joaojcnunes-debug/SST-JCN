"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { useCriarAet } from "@/lib/hooks/useAet";
import { useEmpresa } from "@/lib/hooks/useEmpresas";

export default function NovoAetPage() {
  const router = useRouter();
  const criar = useCriarAet();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { data: empresa } = useEmpresa(empresaId);

  const [form, setForm] = useState({
    responsavel_elaboracao: "",
    titulo_profissional: "",
    registro_profissional: "",
    endereco_empresa: "",
    data_elaboracao: "",
  });

  function handleChange(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId) {
      toast.error("Selecione uma empresa.");
      return;
    }
    if (!form.responsavel_elaboracao.trim()) {
      toast.error("Informe o responsável pela elaboração.");
      return;
    }

    criar.mutate(
      {
        id_empresa: empresaId,
        responsavel_elaboracao: form.responsavel_elaboracao.trim(),
        titulo_profissional: form.titulo_profissional.trim(),
        registro_profissional: form.registro_profissional.trim(),
        endereco_empresa: form.endereco_empresa.trim(),
        data_elaboracao: form.data_elaboracao || null,
      },
      {
        onSuccess: (r) => {
          toast.success("Laudo criado!");
          router.push(`/aet/${r.id_relatorio}/setores`);
        },
        onError: (e: Error) => toast.error(mensagemErro(e)),
      }
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <ClipboardCheck className="size-5 text-verde-primary" />
          Novo Laudo AET
        </h1>
        <p className="text-sm text-gray-500">
          Preencha os dados iniciais para criar o laudo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm reveal-up">
        {/* Empresa */}
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">
            Empresa *
          </label>
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} modulo="sst" />
        </div>

        {/* Campos revelados após selecionar empresa */}
        {empresaId && (
          <>
            {/* Info da empresa */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <p className="font-medium text-gray-800">{empresa?.nome_empresa ?? "—"}</p>
              {empresa?.cnpj && <p className="text-gray-500">CNPJ: {empresa.cnpj}</p>}
            </div>

            {/* Endereço */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Endereço da Empresa
              </label>
              <input
                type="text"
                value={form.endereco_empresa}
                onChange={(e) => handleChange("endereco_empresa", e.target.value)}
                placeholder="Rua, nº, Bairro, Cidade – UF"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
              />
            </div>

            {/* Responsável */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Responsável pela Elaboração *
              </label>
              <ProfissionalSelect
                value={form.responsavel_elaboracao}
                onChange={(nome, cargo) => {
                  handleChange("responsavel_elaboracao", nome);
                  handleChange("titulo_profissional", cargo ?? "");
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Título Profissional
                </label>
                <input
                  type="text"
                  value={form.titulo_profissional}
                  onChange={(e) => handleChange("titulo_profissional", e.target.value)}
                  placeholder="Médico do Trabalho"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Registro Profissional
                </label>
                <input
                  type="text"
                  value={form.registro_profissional}
                  onChange={(e) => handleChange("registro_profissional", e.target.value)}
                  placeholder="277120-RJ"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Data de Elaboração
              </label>
              <input
                type="date"
                value={form.data_elaboracao}
                onChange={(e) => handleChange("data_elaboracao", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={criar.isPending || !empresaId}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-verde-primary py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {criar.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ClipboardCheck className="size-4" />
          )}
          {criar.isPending ? "Criando..." : "Criar Laudo"}
        </button>
      </form>
    </div>
  );
}
