"use client";

// Riscos Psicossociais — por empresa e por setor, a partir das avaliações do
// DRPS e do Questionário que já chegaram à coluna "Concluídos".
// A conta está em `useRiscosPsicossociais`; esta tela só organiza e filtra.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Brain,
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useRiscosPsicossociais, NIVEIS, type EmpresaRisco, type SetorRisco } from "@/lib/hooks/useRiscosPsicossociais";
import { CORES_MATRIZ } from "@/lib/drps/calculos";
import type { NivelMatriz } from "@/lib/drps/types";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";
import { useUserStore } from "@/lib/store";

type FiltroFonte = "" | "DRPS" | "Questionário";

const STATUS_ROTULO: Record<string, string> = {
  CONCLUIDO: "Concluído",
  ENVIADO_CLIENTE: "Enviado ao cliente",
};

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

function peso(n: NivelMatriz | null) {
  return n ? NIVEIS.indexOf(n) : -1;
}

function SeloNivel({ nivel, className }: { nivel: NivelMatriz | null; className?: string }) {
  if (!nivel) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span
      className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white", className)}
      style={{ backgroundColor: CORES_MATRIZ[nivel] }}
    >
      {nivel}
    </span>
  );
}

export default function RiscosPsicossociaisPage() {
  const user = useUserStore((s) => s.user);
  const { data: empresas = [], isLoading, error } = useRiscosPsicossociais();
  const [busca, setBusca] = useState("");
  const [fonte, setFonte] = useState<FiltroFonte>("");
  const [nivelMin, setNivelMin] = useState<NivelMatriz | "">("");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  // Filtra de fora para dentro: fonte → nível mínimo do setor → busca
  // (empresa ou setor). Empresa sem nenhum setor restante some da lista.
  const filtradas = useMemo(() => {
    const min = nivelMin ? peso(nivelMin) : -1;
    let lista: EmpresaRisco[] = empresas
      .map((e) => ({
        ...e,
        avaliacoes: e.avaliacoes
          .filter((a) => !fonte || a.fonte === fonte)
          .map((a) => ({ ...a, setores: a.setores.filter((s) => peso(s.pior) >= min) }))
          .filter((a) => a.setores.length > 0 || (!nivelMin && a.setores.length === 0)),
      }))
      .filter((e) => e.avaliacoes.length > 0);
    if (busca.trim()) {
      lista = buscar(lista, busca, (e) => [
        e.nome,
        e.cnpj ?? "",
        e.municipio ?? "",
        ...e.avaliacoes.flatMap((a) => a.setores.map((s) => s.setor)),
      ]).itens;
    }
    return lista;
  }, [empresas, fonte, nivelMin, busca]);

  const totais = useMemo(() => {
    let setores = 0, critico = 0, alto = 0;
    for (const e of filtradas) {
      for (const a of e.avaliacoes) {
        for (const s of a.setores) {
          setores++;
          if (s.pior === "Crítico") critico++;
          if (s.pior === "Alto") alto++;
        }
      }
    }
    return { empresas: filtradas.length, setores, critico, alto };
  }, [filtradas]);

  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // O menu já esconde de Cliente; isto cobre quem digitar a URL.
  if (user?.perfil === "Cliente") {
    return <p className="py-10 text-center text-sm text-gray-500">Sem acesso a esta página.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-verde-primary" />
          Riscos Psicossociais
        </h1>
        <p className="text-sm text-gray-500">
          Risco por empresa e por setor, vindo do DRPS e do Questionário. Só entram avaliações na coluna
          Concluídos (ou já enviadas ao cliente).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao rotulo="Empresas" valor={totais.empresas} icone={Building2} cor="text-sky-600" />
        <Cartao rotulo="Setores avaliados" valor={totais.setores} icone={Layers} cor="text-emerald-600" />
        <Cartao rotulo="Setores com risco Crítico" valor={totais.critico} icone={ShieldAlert} cor="text-gray-900" />
        <Cartao rotulo="Setores com risco Alto" valor={totais.alto} icone={AlertTriangle} cor="text-red-600" />
      </div>

      <div className="grid gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_200px_220px]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ ou setor..."
            className={cn(inputCls, "pl-8")}
          />
        </div>
        <select value={fonte} onChange={(e) => setFonte(e.target.value as FiltroFonte)} className={inputCls}>
          <option value="">DRPS e Questionário</option>
          <option value="DRPS">Só DRPS</option>
          <option value="Questionário">Só Questionário</option>
        </select>
        <select value={nivelMin} onChange={(e) => setNivelMin(e.target.value as NivelMatriz | "")} className={inputCls}>
          <option value="">Todos os níveis</option>
          <option value="Médio">Setores Médio ou pior</option>
          <option value="Alto">Setores Alto ou Crítico</option>
          <option value="Crítico">Só setores Crítico</option>
        </select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar os riscos: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {empresas.length === 0
            ? "Nenhuma avaliação do DRPS ou do Questionário está na coluna Concluídos ainda."
            : "Nenhuma empresa com esses filtros."}
        </p>
      ) : (
        <div className="space-y-4">
          {filtradas.map((e) => (
            <div key={e.idEmpresa} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <Building2 className="size-4 text-verde-primary" /> {e.nome}
                </h2>
                <p className="text-xs text-gray-500">
                  {[e.cnpj ? formatCNPJ(e.cnpj) : null, e.municipio && e.uf ? `${e.municipio}/${e.uf}` : e.municipio]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="space-y-4">
                {e.avaliacoes.map((a) => (
                  <div key={a.id} className="rounded-xl border border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-semibold",
                            a.fonte === "DRPS" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                          )}
                        >
                          {a.fonte}
                        </span>
                        <span className="font-medium text-gray-800">{a.titulo}</span>
                        <span className="text-xs text-gray-500">
                          {STATUS_ROTULO[a.status] ?? a.status}
                          {a.data ? ` · ${fmtData(a.data)}` : ""}
                          {a.responsavel ? ` · ${a.responsavel}` : ""}
                        </span>
                      </div>
                      <Link href={a.href} className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline">
                        Abrir análise <ExternalLink className="size-3" />
                      </Link>
                    </div>

                    {a.setores.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-gray-500">Sem respondentes importados nesta avaliação.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                              <th className="px-4 py-2 font-medium">Setor</th>
                              <th className="px-2 py-2 text-center font-medium">Resp.</th>
                              {[...NIVEIS].reverse().map((n) => (
                                <th key={n} className="px-2 py-2 text-center font-medium">{n}</th>
                              ))}
                              <th className="px-4 py-2 font-medium">Maior risco</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.setores.map((s) => {
                              const chave = `${a.id}::${s.setor}`;
                              const aberto = abertas.has(chave);
                              return (
                                <LinhaSetor
                                  key={chave}
                                  setor={s}
                                  aberto={aberto}
                                  onToggle={() => alternar(chave)}
                                />
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaSetor({ setor: s, aberto, onToggle }: { setor: SetorRisco; aberto: boolean; onToggle: () => void }) {
  // Fatores do pior para o melhor — o que pede ação aparece primeiro.
  const fatores = [...s.fatores].sort((a, b) => peso(b.nivel) - peso(a.nivel));
  return (
    <>
      <tr className="cursor-pointer border-t border-gray-50 hover:bg-gray-50/60" onClick={onToggle}>
        <td className="px-4 py-2.5 font-medium text-gray-800">
          <span className="inline-flex items-center gap-1">
            {aberto ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
            {s.setor}
          </span>
        </td>
        <td className="px-2 py-2.5 text-center text-gray-600">{s.respondentes}</td>
        {[...NIVEIS].reverse().map((n) => (
          <td key={n} className="px-2 py-2.5 text-center">
            {s.contagem[n] > 0 ? (
              <span className="font-semibold" style={{ color: CORES_MATRIZ[n] }}>{s.contagem[n]}</span>
            ) : (
              <span className="text-gray-300">0</span>
            )}
          </td>
        ))}
        <td className="px-4 py-2.5"><SeloNivel nivel={s.pior} /></td>
      </tr>
      {aberto && (
        <tr className="bg-gray-50/40">
          <td colSpan={7} className="px-4 pb-3 pt-1">
            {fatores.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhum fator com resposta neste setor.</p>
            ) : (
              <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {fatores.map((f) => (
                  <li key={f.nome} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-1.5">
                    <span className="text-xs text-gray-700">{f.nome}</span>
                    <SeloNivel nivel={f.nivel} />
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Cartao({ rotulo, valor, icone: Icone, cor }: { rotulo: string; valor: number; icone: typeof Brain; cor: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{rotulo}</span>
        <Icone className={cn("size-4", cor)} />
      </div>
      <div className={cn("mt-1 text-2xl font-bold", cor)}>{valor}</div>
    </div>
  );
}
