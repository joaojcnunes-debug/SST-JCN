"use client";

// Fatores psicossociais da AEP de UMA empresa: dados cadastrais e, por
// AEP, um bloco por setor (um embaixo do outro) com os fatores organizacionais
// marcados "Sim" — Fator · Resultado final (AIHA) · Probabilidade · Severidade
// · Sinais observados. Mesmo formato da página Riscos Psicossociais; sem link
// para o editor da AEP, de propósito. Usada em /sinalizacao-psicossocial/[id]
// e em /aep-psicossocial/[id]; `basePath` é a lista para onde o "Voltar" leva.

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Layers } from "lucide-react";
import { useAepsEntregues } from "@/lib/hooks/useAep";
import { montarSinalizacao } from "@/lib/aep/sinalizacao";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { fmtData, formatCNPJ } from "@/lib/utils";

const STATUS_ROTULO: Record<string, string> = { RASCUNHO: "Rascunho", CONCLUIDO: "Concluída" };

interface EmpresaCadastro {
  nome_empresa: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  grau_risco: number | string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
}

function Info({ rotulo, valor, className }: { rotulo: string; valor: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-500">{rotulo}</div>
      <div className="text-sm text-gray-900">{valor && valor.trim() ? valor : "—"}</div>
    </div>
  );
}

export default function SinalizacaoEmpresaDetalhe({
  idEmpresa,
  basePath,
}: {
  idEmpresa: string;
  basePath: string;
}) {
  const { data: relatorios = [], isLoading } = useAepsEntregues(idEmpresa);
  const sinal = useMemo(() => montarSinalizacao(relatorios)[0] ?? null, [relatorios]);

  const { data: cadastro } = useQuery({
    queryKey: ["sinalizacao-empresa", idEmpresa],
    queryFn: async (): Promise<EmpresaCadastro | null> => {
      const { data, error } = await createSupabaseBrowserClient()
        .from("empresas")
        .select(
          "nome_empresa, razao_social, nome_fantasia, cnpj, cnae_principal, cnae_descricao, grau_risco, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email"
        )
        .eq("id_empresa", idEmpresa)
        .maybeSingle();
      if (error) throw error;
      return data as EmpresaCadastro | null;
    },
  });

  const endereco = cadastro
    ? [
        [cadastro.logradouro, cadastro.numero].filter(Boolean).join(", "),
        cadastro.complemento,
        cadastro.bairro,
        cadastro.municipio && cadastro.uf ? `${cadastro.municipio}/${cadastro.uf}` : cadastro.municipio,
        cadastro.cep ? `CEP ${cadastro.cep}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={basePath}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary"
        >
          <ArrowLeft className="size-4" /> Voltar às empresas
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <Building2 className="size-5 text-verde-primary" />
          {cadastro?.nome_empresa ?? sinal?.nome ?? "Empresa"}
        </h1>
        <p className="text-sm text-gray-500">
          Fatores psicossociais por setor nas triagens AEP — resultado na matriz AIHA.
        </p>
      </div>

      {/* Dados da empresa */}
      <div className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info rotulo="Razão social" valor={cadastro?.razao_social} className="sm:col-span-2" />
        <Info rotulo="Nome fantasia" valor={cadastro?.nome_fantasia} />
        <Info rotulo="CNPJ" valor={cadastro?.cnpj ? formatCNPJ(cadastro.cnpj) : null} />
        <Info
          rotulo="CNAE principal"
          valor={[cadastro?.cnae_principal, cadastro?.cnae_descricao].filter(Boolean).join(" — ")}
          className="sm:col-span-2"
        />
        <Info rotulo="Grau de risco" valor={cadastro?.grau_risco != null ? String(cadastro.grau_risco) : null} />
        <Info rotulo="Telefone" valor={cadastro?.telefone} />
        <Info rotulo="Endereço" valor={endereco} className="sm:col-span-2 lg:col-span-3" />
        <Info rotulo="E-mail" valor={cadastro?.email} />
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : !sinal ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          Esta empresa não tem fator psicossocial sinalizado em AEP entregue ao cliente.
        </p>
      ) : (
        sinal.avaliacoes.map((a) => (
          <section key={a.idRelatorio} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">AEP</span>
              <h2 className="text-base font-semibold text-gray-900">Análise Ergonômica Preliminar</h2>
              <span className="text-xs text-gray-500">
                {a.data ? `Entregue ao cliente em ${fmtData(a.data)}` : STATUS_ROTULO[a.status] ?? a.status}
                {a.idInspecao ? ` · ${a.idInspecao}` : ""}
                {a.responsavel ? ` · ${a.responsavel}` : ""}
              </span>
            </div>

            <div className="space-y-4">
              {a.setores.map((s) => (
                <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                      <Layers className="size-4 text-verde-primary" /> {s.nome}
                    </h3>
                    <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                      {s.fatores.length} fator{s.fatores.length !== 1 ? "es" : ""}
                      <SeloNivelAiha nivel={s.pior} />
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="w-64 border border-gray-200 px-3 py-2 font-medium">Fator de risco</th>
                          <th className="w-32 border border-gray-200 px-3 py-2 font-medium">Resultado final</th>
                          <th className="w-44 border border-gray-200 px-3 py-2 font-medium">Probabilidade</th>
                          <th className="w-40 border border-gray-200 px-3 py-2 font-medium">Severidade</th>
                          <th className="border border-gray-200 px-3 py-2 font-medium">Sinais observados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.fatores.map((f) => (
                          <tr key={f.key}>
                            <td className="border border-gray-200 px-3 py-2 align-top text-gray-800">
                              {f.label}
                              {f.observacao && (
                                <div className="mt-1 text-xs italic text-gray-500">Obs.: {f.observacao}</div>
                              )}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 align-top">
                              <SeloNivelAiha nivel={f.nivel} />
                            </td>
                            <td className="border border-gray-200 px-3 py-2 align-top text-gray-700">{f.probabilidade ?? "—"}</td>
                            <td className="border border-gray-200 px-3 py-2 align-top text-gray-700">{f.severidade ?? "—"}</td>
                            <td className="border border-gray-200 px-3 py-2 align-top">
                              {f.sinais.length === 0 ? (
                                <span className="text-sm text-gray-400">Nenhum sinal marcado</span>
                              ) : (
                                <ul className="list-disc space-y-0.5 pl-4 text-sm text-gray-700">
                                  {f.sinais.map((x) => (
                                    <li key={x}>{x}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
