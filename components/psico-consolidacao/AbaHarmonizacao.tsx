"use client";

import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { AcaoLacuna, Lacuna } from "@/lib/psico-consolidacao/motor";
import { Cartao, Nivel, passa, Secao, Tabela, TD, TD_1A, TH, TH_FATOR, Vazio, type Analise } from "./comum";

const COR_ACAO: Record<AcaoLacuna, string> = {
  Incluir: "bg-red-100 text-red-800",
  "Revisar nível": "bg-amber-100 text-amber-800",
  OK: "bg-green-50 text-green-700",
};

/**
 * 5.4 — Harmonização: o perfil de cada setor comum (mínimo obrigatório para todas as
 * empresas que têm o setor) e o que cada empresa precisa incluir ou revisar no PGR.
 */
export default function AbaHarmonizacao({ a }: { a: Analise }) {
  const { r, nomeEmpresa, nomeFator, filtro } = a;
  const [comOk, setComOk] = useState(false);

  const fatores = r.fatores.filter((f) => passa(filtro, { idFator: f.id_fator }));
  const lacunas = useMemo(() => r.lacunas.filter((l) => passa(filtro, l)), [r.lacunas, filtro]);
  const incluir = lacunas.filter((l) => l.acao === "Incluir").length;
  const revisar = lacunas.filter((l) => l.acao === "Revisar nível").length;

  const top = (chave: (l: Lacuna) => string, nome: (k: string) => string) => {
    const m = new Map<string, number>();
    for (const l of lacunas) if (l.acao !== "OK") m.set(chave(l), (m.get(chave(l)) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, n]) => `${n} — ${nome(k)}`);
  };

  const perfil = [...r.perfil.map((p) => ({ ...p, propria: false })), ...r.avaliacaoPropria.map((p) => ({ ...p, propria: true }))];
  const setoresPerfil = r.setores
    .filter((s) => passa(filtro, { setor: s.setor }) && (!filtro.empresa || s.empresas.includes(filtro.empresa)))
    .filter((s) => perfil.some((p) => p.setor === s.setor));
  const nivelPerfil = new Map(perfil.map((p) => [`${p.setor}|${p.idFator}`, p]));

  const linhasEmpresa = useMemo(() => {
    const m = new Map<string, { idEmpresa: string; setor: string; acoes: Map<string, Lacuna> }>();
    for (const l of lacunas) {
      const k = `${l.idEmpresa}|${l.setor}`;
      const x = m.get(k) ?? { idEmpresa: l.idEmpresa, setor: l.setor, acoes: new Map() };
      x.acoes.set(l.idFator, l);
      m.set(k, x);
    }
    return [...m.values()].sort(
      (x, y) => nomeEmpresa(x.idEmpresa).localeCompare(nomeEmpresa(y.idEmpresa), "pt-BR") || x.setor.localeCompare(y.setor, "pt-BR"),
    );
  }, [lacunas, nomeEmpresa]);

  const lista = lacunas
    .filter((l) => comOk || l.acao !== "OK")
    .sort(
      (x, y) =>
        nomeEmpresa(x.idEmpresa).localeCompare(nomeEmpresa(y.idEmpresa), "pt-BR") ||
        x.setor.localeCompare(y.setor, "pt-BR") ||
        (r.fatores.find((f) => f.id_fator === x.idFator)?.ordem ?? 0) - (r.fatores.find((f) => f.id_fator === y.idFator)?.ordem ?? 0),
    );
  const fontesTexto = (l: Lacuna) => l.fontes.map((f) => `${nomeEmpresa(f.idEmpresa)} (${f.nivel === "Identificado" ? "AEP" : f.nivel})`).join("; ");

  const copiar = async () => {
    const texto = lista
      .map((l) => `${nomeEmpresa(l.idEmpresa)}\t${l.setor}\t${nomeFator(l.idFator)}\t${l.acao}\t${l.situacao ?? "ausente"}\t${l.perfil}\t${fontesTexto(l)}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(`Empresa\tSetor\tFator\tAção\tNa empresa\tPerfil\tOnde foi achado\n${texto}`);
      toast.success(`${lista.length} linha(s) copiada(s) — cole no Excel ou no e-mail.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  if (r.perfil.length === 0 && r.avaliacaoPropria.length === 0) {
    return <Vazio>Nenhum risco presente nos documentos escolhidos.</Vazio>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao titulo="Incluir" valor={incluir} tom="text-red-700" detalhe="fator do perfil ausente (ou só Baixo) na empresa" />
        <Cartao titulo="Revisar nível" valor={revisar} tom="text-amber-700" detalhe="nível da empresa abaixo do perfil" />
        <Cartao titulo="Fatores que mais faltam" valor={<Top itens={top((l) => l.idFator, nomeFator)} />} />
        <Cartao titulo="Empresas com mais ajustes" valor={<Top itens={top((l) => l.idEmpresa, nomeEmpresa)} />} />
      </div>

      <Secao
        titulo="Perfil consolidado por setor"
        descricao={
          <>
            Setor em 2 ou mais empresas (e que transita): todo fator presente em qualquer empresa entra, no <strong>maior</strong> nível — é o
            mínimo para todas as empresas que têm o setor. ¹ = setor de uma empresa só: vale a avaliação própria.
          </>
        }
      >
        <Tabela minW="min-w-[900px]">
          <thead>
            <tr>
              <th className={cn(TH, "left-0 z-20")}>Setor</th>
              {fatores.map((f) => (
                <th key={f.id_fator} className={TH_FATOR}>{f.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {setoresPerfil.map((s) => (
              <tr key={s.setor}>
                <td className={cn(TD_1A, "whitespace-nowrap")}>
                  {s.setor}
                  {!s.comum && <sup className="ml-0.5 text-indigo-700">1</sup>}
                  <span className="ml-1 text-[11px] font-normal text-gray-400">({s.empresas.length})</span>
                </td>
                {fatores.map((f) => {
                  const p = nivelPerfil.get(`${s.setor}|${f.id_fator}`);
                  return (
                    <td key={f.id_fator} className="border-t border-gray-100 p-0.5 text-center">
                      {p && (
                        <span title={p.fontes.map((x) => `${nomeEmpresa(x.idEmpresa)} (${x.nivel})`).join("; ")}>
                          <Nivel nivel={p.nivel} className="text-[10px]" />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Secao>

      <Secao titulo="Matriz por empresa" descricao="Setores comuns: o que cada empresa precisa fazer em cada fator do perfil.">
        {linhasEmpresa.length === 0 ? (
          <Vazio>Nenhum setor comum com esses filtros.</Vazio>
        ) : (
          <Tabela minW="min-w-[1000px]">
            <thead>
              <tr>
                <th className={cn(TH, "left-0 z-20")}>Empresa · Setor</th>
                {fatores.map((f) => (
                  <th key={f.id_fator} className={TH_FATOR}>{f.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasEmpresa.map((x, i) => {
                const nova = i === 0 || linhasEmpresa[i - 1].idEmpresa !== x.idEmpresa;
                return (
                  <tr key={`${x.idEmpresa}|${x.setor}`} className={nova ? "border-t-2 border-gray-300" : undefined}>
                    <td className={cn(TD_1A, "whitespace-nowrap text-xs")}>
                      <span className={nova ? "font-semibold" : "text-transparent"}>{nomeEmpresa(x.idEmpresa)}</span>
                      <span className="ml-1 font-normal text-gray-600">· {x.setor}</span>
                    </td>
                    {fatores.map((f) => {
                      const l = x.acoes.get(f.id_fator);
                      return (
                        <td key={f.id_fator} className="border-t border-gray-100 p-0.5 text-center">
                          {l && (
                            <span
                              title={`${l.acao} — na empresa: ${l.situacao ?? "ausente"}; perfil: ${l.perfil}. Achado em: ${fontesTexto(l)}`}
                              className={cn("inline-block rounded px-1 py-0.5 text-[10px] font-semibold", COR_ACAO[l.acao])}
                            >
                              {l.acao === "Revisar nível" ? "Revisar" : l.acao}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Lista de lacunas"
        descricao="Use o filtro de empresa no alto para separar a lista de uma empresa e enviar só a ela."
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={comOk} onChange={(e) => setComOk(e.target.checked)} className="size-3.5" />
            Mostrar também as que estão OK
          </label>
          <button
            type="button"
            onClick={copiar}
            disabled={lista.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Copy className="size-3.5" /> Copiar {lista.length} linha(s)
          </button>
        </div>
        <Tabela minW="min-w-[900px]">
          <thead>
            <tr>
              <th className={TH}>Empresa</th>
              <th className={TH}>Setor</th>
              <th className={TH}>Fator</th>
              <th className={TH}>Ação</th>
              <th className={TH}>Na empresa</th>
              <th className={TH}>Perfil</th>
              <th className={TH}>Onde foi achado</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((l) => (
              <tr key={`${l.idEmpresa}|${l.setor}|${l.idFator}`}>
                <td className={cn(TD, "text-xs")}>{nomeEmpresa(l.idEmpresa)}</td>
                <td className={cn(TD, "whitespace-nowrap")}>{l.setor}</td>
                <td className={TD}>{nomeFator(l.idFator)}</td>
                <td className={TD}>
                  <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", COR_ACAO[l.acao])}>{l.acao}</span>
                </td>
                <td className={TD}>{l.situacao ? <Nivel nivel={l.situacao} /> : <span className="text-xs text-gray-400">ausente</span>}</td>
                <td className={TD}><Nivel nivel={l.perfil} /></td>
                <td className={cn(TD, "text-xs text-gray-600")}>{fontesTexto(l)}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Secao>
    </div>
  );
}

function Top({ itens }: { itens: string[] }) {
  if (itens.length === 0) return <span className="text-sm font-normal text-gray-400">—</span>;
  return (
    <ol className="mt-1 space-y-0.5 text-xs font-normal leading-snug text-gray-700">
      {itens.map((x) => (
        <li key={x} className="truncate" title={x}>{x}</li>
      ))}
    </ol>
  );
}
