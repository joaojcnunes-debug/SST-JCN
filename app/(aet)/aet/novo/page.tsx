"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { useCriarAet } from "@/lib/hooks/useAet";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";

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

  // O endereço mora no cadastro da empresa em campos separados (logradouro,
  // número, bairro, município, UF, CEP). A caixa aqui é uma linha só, então
  // monta com o MESMO formatador que o PDF usa — senão o laudo sairia com um
  // endereço escrito de um jeito e a tela de outro.
  const enderecoCadastro = montarEnderecoEmpresa(empresa);

  // A caixa acompanha a empresa escolhida até a pessoa digitar por cima; daí
  // o que ela escreveu manda. Trocar de empresa devolve o comando ao cadastro
  // (senão o endereço da empresa anterior ficaria colado no laudo novo).
  const enderecoEditado = useRef(false);

  useEffect(() => {
    if (enderecoEditado.current) return;
    setForm((f) =>
      f.endereco_empresa === enderecoCadastro
        ? f
        : { ...f, endereco_empresa: enderecoCadastro }
    );
  }, [enderecoCadastro]);

  function handleEmpresaChange(id: string | null) {
    enderecoEditado.current = false;
    setEmpresaId(id);
  }

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
          <EmpresaSelect value={empresaId} onChange={handleEmpresaChange} modulo="sst" />
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
                onChange={(e) => {
                  enderecoEditado.current = true;
                  handleChange("endereco_empresa", e.target.value);
                }}
                placeholder="Rua, nº, Bairro, Cidade – UF"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
              />
              {empresa && !enderecoCadastro ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  O cadastro desta empresa está sem endereço. Digite aqui ou
                  preencha em Empresas para que ele venha sozinho da próxima vez.
                </p>
              ) : enderecoCadastro && form.endereco_empresa === enderecoCadastro ? (
                <p className="mt-1 text-[11px] text-gray-500">
                  Puxado do cadastro da empresa. Pode editar.
                </p>
              ) : null}
            </div>

            {/* Responsável */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Responsável pela Elaboração *
              </label>
              <ProfissionalSelect
                value={form.responsavel_elaboracao}
                onChange={(nome, cargo, _cert, regValue) => {
                  handleChange("responsavel_elaboracao", nome);
                  handleChange("titulo_profissional", cargo ?? "");
                  if (regValue) handleChange("registro_profissional", regValue);
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
