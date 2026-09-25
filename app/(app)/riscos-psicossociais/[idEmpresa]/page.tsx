"use client";

// Riscos Psicossociais de UMA empresa: dados cadastrais + o resultado final de
// cada risco, por setor. Só o nível final (matriz) — gravidade, probabilidade
// e perguntas ficam no laudo. Sem link para as telas de Análise, de propósito.

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Layers, Users } from "lucide-react";
import { useRiscosPsicossociais } from "@/lib/hooks/useRiscosPsicossociais";
import { CORES_MATRIZ } from "@/lib/drps/calculos";
import type { NivelMatriz } from "@/lib/drps/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useUserStore } from "@/lib/store";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const STATUS_ROTULO: Record<string, string> = {
  CONCLUIDO: "Concluído",
  ENVIADO_CLIENTE: "Enviado ao cliente",
};

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

function SeloNivel({ nivel }: { nivel: NivelMatriz }) {
  return (
    <span
      className="inline-block min-w-[64px] rounded-full px-2.5 py-0.5 text-center text-xs font-semibold text-white"
      style={{ backgroundColor: CORES_MATRIZ[nivel] }}
    >
      {nivel}
    </span>
  );
}

function ListaTexto({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{titulo}</div>
      {itens.length === 0 ? (
        <p className="text-sm text-gray-400">Não informado</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
          {itens.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Info({ rotulo, valor, className }: { rotulo: string; valor: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-500">{rotulo}</div>
      <div className="text-sm text-gray-900">{valor && valor.trim() ? valor : "—"}</div>
    </div>
  );
}

export default function RiscosEmpresaPage() {
  const user = useUserStore((s) => s.user);
  const { idEmpresa: bruto } = useParams<{ idEmpresa: string }>();
  const idEmpresa = decodeURIComponent(bruto);
  const { data: empresas = [], isLoading } = useRiscosPsicossociais();
  const riscos = empresas.find((e) => e.idEmpresa === idEmpresa) ?? null;

  const { data: cadastro } = useQuery({
    queryKey: ["riscos-psicossociais-empresa", idEmpresa],
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

  if (user?.perfil === "Cliente") {
    return <p className="py-10 text-center text-sm text-gray-500">Sem acesso a esta página.</p>;
  }

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
          href="/riscos-psicossociais"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary"
        >
          <ArrowLeft className="size-4" /> Voltar às empresas
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <Building2 className="size-5 text-verde-primary" />
          {cadastro?.nome_empresa ?? riscos?.nome ?? "Empresa"}
        </h1>
        <p className="text-sm text-gray-500">Riscos psicossociais por setor — resultado final de cada risco.</p>
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
      ) : !riscos ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          Esta empresa não tem avaliação do DRPS ou do Questionário concluída.
        </p>
      ) : (
        riscos.avaliacoes.map((a) => (
          <section key={a.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold",
                  a.fonte === "DRPS" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                )}
              >
                {a.fonte}
              </span>
              <h2 className="text-base font-semibold text-gray-900">{a.titulo}</h2>
              <span className="text-xs text-gray-500">
                {STATUS_ROTULO[a.status] ?? a.status}
                {a.data ? ` · ${fmtData(a.data)}` : ""}
                {a.responsavel ? ` · ${a.responsavel}` : ""}
              </span>
            </div>

            {a.setores.length === 0 ? (
              <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500 shadow-sm">
                Sem respondentes importados nesta avaliação.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {a.setores.map((s) => (
                  <div key={s.setor} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                        <Layers className="size-4 text-verde-primary" /> {s.setor}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Users className="size-3.5" /> {s.respondentes} respondente{s.respondentes !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {s.fatores.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum risco com resposta neste setor.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                            <th className="py-1.5 font-medium">Risco</th>
                            <th className="py-1.5 text-right font-medium">Resultado final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.fatores.map((f) => (
                            <tr key={f.nome} className="border-b border-gray-50 last:border-0">
                              <td className="py-2 pr-3 align-top">
                                <div className="text-gray-700">{f.nome}</div>
                                {f.fonteGeradora && (
                                  <div className="mt-0.5 text-xs text-gray-500">
                                    <span className="font-medium text-gray-600">Fonte geradora:</span> {f.fonteGeradora}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 text-right align-top"><SeloNivel nivel={f.nivel} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <ListaTexto titulo="Possíveis agravos à saúde mental" itens={s.agravos} />
                    <ListaTexto
                      titulo="Medidas de controle recomendadas (medidas que a empresa deve adotar)"
                      itens={s.medidas}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
