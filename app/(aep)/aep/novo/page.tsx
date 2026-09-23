"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { useCriarAep } from "@/lib/hooks/useAep";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";

export default function AepNovoPage() {
  const router = useRouter();
  const criar = useCriarAep();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { data: empresa } = useEmpresa(empresaId);
  const [endereco, setEndereco] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [titulo, setTitulo] = useState("");
  const [registro, setRegistro] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  // O endereço mora no cadastro da empresa em campos separados (logradouro,
  // número, bairro, município, UF, CEP). A caixa aqui é uma linha só, então
  // monta com o MESMO formatador que o PDF e a AET usam — senão o laudo sairia
  // com um endereço escrito de um jeito e a tela de outro.
  const enderecoCadastro = montarEnderecoEmpresa(empresa);

  // A caixa acompanha a empresa escolhida até a pessoa digitar por cima; daí
  // o que ela escreveu manda. Trocar de empresa devolve o comando ao cadastro
  // (senão o endereço da empresa anterior ficaria colado na análise nova).
  const enderecoEditado = useRef(false);

  useEffect(() => {
    if (enderecoEditado.current) return;
    setEndereco((atual) => (atual === enderecoCadastro ? atual : enderecoCadastro));
  }, [enderecoCadastro]);

  function handleEmpresaChange(id: string | null) {
    enderecoEditado.current = false;
    setEmpresaId(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || !responsavel.trim()) return;
    const result = await criar.mutateAsync({
      id_empresa: empresaId,
      responsavel_elaboracao: responsavel.trim(),
      titulo_profissional: titulo.trim(),
      registro_profissional: registro.trim(),
      endereco_empresa: endereco.trim() || null,
      data_elaboracao: data || null,
    });
    router.push(`/aep/${result.id_relatorio}/setores`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="size-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nova Análise AEP</h1>
          <p className="text-sm text-gray-500">Análise Ergonômica Preliminar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm reveal-up">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Empresa *</label>
          <EmpresaSelect
            value={empresaId}
            onChange={handleEmpresaChange}
            modulo="aep"
            allowAll
            placeholder="Selecione a empresa..."
          />
        </div>

        {empresaId && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Endereço da empresa</label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => {
                enderecoEditado.current = true;
                setEndereco(e.target.value);
              }}
              placeholder="Rua, nº, bairro — cidade/UF"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {empresa && !enderecoCadastro ? (
              <p className="mt-1 text-[11px] text-amber-700">
                O cadastro desta empresa está sem endereço. Digite aqui ou
                preencha em Empresas para que ele venha sozinho da próxima vez.
              </p>
            ) : enderecoCadastro && endereco === enderecoCadastro ? (
              <p className="mt-1 text-[11px] text-gray-500">
                Puxado do cadastro da empresa. Pode editar.
              </p>
            ) : null}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Responsável pela elaboração *</label>
          <ProfissionalSelect
            value={responsavel}
            onChange={(nome, cargo, _cert, regValue) => {
              setResponsavel(nome);
              setTitulo(cargo ?? "");
              if (regValue) setRegistro(regValue);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Título profissional</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Eng. de Segurança"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Registro profissional</label>
            <input
              type="text"
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
              placeholder="CREA / CRQ / CFT"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Data de elaboração</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={!empresaId || !responsavel.trim() || criar.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-4" />
          {criar.isPending ? "Criando..." : "Criar e continuar"}
        </button>
      </form>
    </div>
  );
}
