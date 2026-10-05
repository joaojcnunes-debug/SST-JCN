"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import {
  useCriarAepNoModulo,
  useInspecoesComAep,
  type VinculoInspecao,
} from "@/lib/hooks/useErgonomiaInspecao";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import { cn, fmtData } from "@/lib/utils";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";

export default function AepNovoPage() {
  const router = useRouter();
  const criar = useCriarAepNoModulo();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { data: empresa } = useEmpresa(empresaId);
  const [endereco, setEndereco] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [titulo, setTitulo] = useState("");
  const [registro, setRegistro] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  // Onde a AEP fica registrada (2026-10-05): numa inspeção já realizada, numa
  // inspeção nova criada agora, ou sem inspeção. Com inspeção, a AEP chega à
  // Sinalização Psicossocial quando o documento da inspeção é concluído pelo
  // associado; sem inspeção, quando a própria AEP é marcada Concluída.
  const [vinculo, setVinculo] = useState<VinculoInspecao>("existente");
  const [idInspecao, setIdInspecao] = useState("");
  const { data: inspecoes = [] } = useInspecoesByEmpresa(empresaId);
  const { data: comAep } = useInspecoesComAep(empresaId);
  const inspecoesAtivas = useMemo(() => inspecoes.filter((i) => i.status !== "DELETADA"), [inspecoes]);
  const proximaRevisao = useMemo(
    () => Math.max(0, ...inspecoes.map((i) => i.revisao ?? 0)) + 1,
    [inspecoes],
  );

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
    setIdInspecao("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId || !responsavel.trim()) return;
    if (vinculo === "existente" && !idInspecao) return;
    const result = await criar.mutateAsync({
      vinculo,
      id_inspecao: vinculo === "existente" ? idInspecao : null,
      revisao_nova: proximaRevisao,
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

        {empresaId && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Registrar em inspeção</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["existente", "Inspeção realizada", "Usa os setores e cargos dela"],
                  ["nova", "Criar nova inspeção", `Inspeção em branco, Rev. ${proximaRevisao}`],
                  ["nenhum", "Sem inspeção", "AEP só no módulo"],
                ] as [VinculoInspecao, string, string][]
              ).map(([v, rotulo, dica]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVinculo(v)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm",
                    vinculo === v
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <div className="font-medium">{rotulo}</div>
                  <div className="text-[11px] text-gray-500">{dica}</div>
                </button>
              ))}
            </div>

            {vinculo === "existente" && (
              <div className="mt-2">
                {inspecoesAtivas.length === 0 ? (
                  <p className="text-[11px] text-amber-700">
                    Esta empresa não tem inspeção. Escolha &quot;Criar nova inspeção&quot;.
                  </p>
                ) : (
                  <select
                    value={idInspecao}
                    onChange={(e) => setIdInspecao(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecione a inspeção...</option>
                    {inspecoesAtivas.map((i) => {
                      const temAep = comAep?.has(i.id_inspecao) ?? false;
                      return (
                        <option key={i.id_inspecao} value={i.id_inspecao} disabled={temAep}>
                          {i.id_inspecao} · Rev. {i.revisao ?? 0} · {fmtData(i.data_inspecao)}
                          {i.status === "CONCLUIDA" ? " · Concluída" : i.status === "RASCUNHO" ? " · Rascunho" : " · Em andamento"}
                          {temAep ? " · já tem AEP" : ""}
                        </option>
                      );
                    })}
                  </select>
                )}
                <p className="mt-1 text-[11px] text-gray-500">
                  A AEP fica na aba AEP da inspeção e já começa com os setores e cargos dela. Uma inspeção só tem uma AEP.
                </p>
              </div>
            )}
            <p className="mt-2 text-[11px] text-gray-500">
              {vinculo === "nenhum"
                ? "Sem inspeção, a AEP aparece na Sinalização Psicossocial quando for marcada como Concluída (enviada ao cliente)."
                : "A AEP aparece na Sinalização Psicossocial quando o documento da inspeção for concluído pelo associado (entregue ao cliente)."}
            </p>
            {vinculo === "nova" && (
              <p className="mt-2 text-[11px] text-gray-500">
                Será criada a inspeção em branco Rev. {proximaRevisao} desta empresa, com a data de elaboração acima, e
                a AEP fica registrada nela (aba AEP).
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={
            !empresaId || !responsavel.trim() || (vinculo === "existente" && !idInspecao) || criar.isPending
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-4" />
          {criar.isPending ? "Criando..." : "Criar e continuar"}
        </button>
      </form>
    </div>
  );
}
