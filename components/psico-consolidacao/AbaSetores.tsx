"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { chaveSetor, sugerirSetorCanonico } from "@/lib/psico-consolidacao/setores";
import type { LinhaFonte } from "@/lib/psico-consolidacao/fontes";
import type { OrigemFonte } from "@/lib/psico-consolidacao/fatores";
import type { PsicoSetorCanonico, PsicoSetorDepara } from "@/lib/supabase/types";
import { useAlternarTransita, useConfirmarSetores } from "@/lib/hooks/usePsicoConsolidacao";

interface Linha {
  chave: string;
  idEmpresa: string;
  origem: OrigemFonte;
  setorOriginal: string;
  fatores: number;
  /** Nome padronizado já confirmado (null = só sugestão). */
  confirmado: string | null;
  sugestao: string;
}

/**
 * Padronização dos setores: cada nome de setor de cada documento ganha um nome
 * padronizado do grupo. O sistema sugere; o técnico confere, corrige e confirma.
 */
export default function AbaSetores({
  idGrupo,
  linhas,
  nomeEmpresa,
  canonicos,
  depara,
  podeEditar,
}: {
  idGrupo: string;
  linhas: LinhaFonte[];
  nomeEmpresa: (id: string) => string;
  canonicos: PsicoSetorCanonico[];
  depara: PsicoSetorDepara[];
  podeEditar: boolean;
}) {
  const confirmar = useConfirmarSetores(idGrupo);
  const alternar = useAlternarTransita(idGrupo);
  const [editado, setEditado] = useState<Record<string, string>>({});
  const [soPendentes, setSoPendentes] = useState(false);

  const linhasSetor = useMemo<Linha[]>(() => {
    const nomeCanonico = new Map(canonicos.map((c) => [c.id_setor_canonico, c.nome]));
    const salvo = new Map(depara.map((d) => [`${d.id_empresa}|${d.origem}|${d.setor_original}`, d]));
    const m = new Map<string, Linha & { _f: Set<string> }>();
    for (const l of linhas) {
      const chave = `${l.idEmpresa}|${l.origem}|${l.setorOriginal}`;
      let x = m.get(chave);
      if (!x) {
        const s = salvo.get(chave);
        x = {
          chave,
          idEmpresa: l.idEmpresa,
          origem: l.origem,
          setorOriginal: l.setorOriginal,
          fatores: 0,
          confirmado: s?.confirmado_em && s.id_setor_canonico ? nomeCanonico.get(s.id_setor_canonico) ?? null : null,
          sugestao: sugerirSetorCanonico(l.setorOriginal),
          _f: new Set(),
        };
        m.set(chave, x);
      }
      x._f.add(l.fatorOriginal);
    }
    return [...m.values()]
      .map(({ _f, ...x }) => ({ ...x, fatores: _f.size }))
      .sort(
        (a, b) =>
          (a.confirmado ?? a.sugestao).localeCompare(b.confirmado ?? b.sugestao, "pt-BR") ||
          nomeEmpresa(a.idEmpresa).localeCompare(nomeEmpresa(b.idEmpresa), "pt-BR"),
      );
  }, [linhas, canonicos, depara, nomeEmpresa]);

  const nomeAtual = (l: Linha) => editado[l.chave] ?? l.confirmado ?? l.sugestao;
  const pendente = (l: Linha) => !l.confirmado || (editado[l.chave] !== undefined && editado[l.chave] !== l.confirmado);
  const pendentes = linhasSetor.filter(pendente);
  const visiveis = soPendentes ? pendentes : linhasSetor;

  // Resumo por setor padronizado: em quantas empresas ele aparece.
  const resumo = useMemo(() => {
    const porNome = new Map<string, { nome: string; empresas: Set<string>; origens: Set<string> }>();
    for (const l of linhasSetor) {
      const nome = (editado[l.chave] ?? l.confirmado ?? l.sugestao).trim();
      const k = chaveSetor(nome);
      if (!k) continue;
      const r = porNome.get(k) ?? { nome, empresas: new Set(), origens: new Set() };
      r.empresas.add(l.idEmpresa);
      r.origens.add(l.origem);
      porNome.set(k, r);
    }
    const canonicoPorChave = new Map(canonicos.map((c) => [chaveSetor(c.nome), c]));
    return [...porNome.entries()]
      .map(([k, r]) => ({ ...r, canonico: canonicoPorChave.get(k) ?? null }))
      .sort((a, b) => b.empresas.size - a.empresas.size || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [linhasSetor, editado, canonicos]);

  const salvar = (alvo: Linha[]) =>
    confirmar.mutate(
      alvo.map((l) => ({
        id_empresa: l.idEmpresa,
        origem: l.origem,
        setor_original: l.setorOriginal,
        nome_canonico: nomeAtual(l),
      })),
      { onSuccess: () => setEditado({}) },
    );

  if (linhasSetor.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-500">Nenhum setor nos documentos escolhidos.</p>;
  }

  return (
    <div className="space-y-4">
      <datalist id="psico-setores-canonicos">
        {resumo.map((r) => (
          <option key={r.nome} value={r.nome} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          <strong>{linhasSetor.length}</strong> nome(s) de setor nos documentos ·{" "}
          <strong className={pendentes.length ? "text-amber-700" : "text-green-700"}>{pendentes.length}</strong> a confirmar
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} className="size-3.5" />
            Só os a confirmar
          </label>
          {podeEditar && (
            <button
              type="button"
              disabled={pendentes.length === 0 || confirmar.isPending}
              onClick={() => salvar(pendentes)}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {confirmar.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirmar {pendentes.length} pendente(s)
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Empresa</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Setor no documento</th>
              <th className="px-3 py-2">Setor padronizado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visiveis.map((l) => (
              <tr key={l.chave} className={pendente(l) ? "bg-amber-50/40" : undefined}>
                <td className="px-3 py-1.5 text-gray-700">{nomeEmpresa(l.idEmpresa)}</td>
                <td className="px-3 py-1.5 text-xs text-gray-500">{l.origem}</td>
                <td className="px-3 py-1.5 text-gray-800">
                  {l.setorOriginal}
                  <span className="ml-1 text-[11px] text-gray-400">({l.fatores} fator{l.fatores === 1 ? "" : "es"})</span>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    list="psico-setores-canonicos"
                    value={nomeAtual(l)}
                    disabled={!podeEditar}
                    onChange={(e) => setEditado((m) => ({ ...m, [l.chave]: e.target.value }))}
                    aria-label={`Setor padronizado de ${l.setorOriginal}`}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-50"
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                  {pendente(l) ? (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Sparkles className="size-3.5" /> {l.confirmado ? "alterado" : "sugestão"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="size-3.5" /> confirmado
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-1.5 text-sm font-semibold text-gray-800">Setores padronizados do grupo</h3>
        <p className="mb-2 text-xs text-gray-500">
          Setor em 2 ou mais empresas é <strong>comum</strong>: o perfil de riscos dele vale para todas. Desmarque
          &quot;Transita&quot; se os trabalhadores daquele setor não circulam entre as empresas.
        </p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {resumo.map((r) => (
            <li key={r.nome} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                {r.nome}
                <span className={cn("ml-1.5 inline-flex items-center gap-0.5 text-[11px]", r.empresas.size >= 2 ? "text-indigo-700" : "text-gray-400")}>
                  <Users className="size-3" /> {r.empresas.size}
                  {r.empresas.size >= 2 ? " · comum" : r.empresas.size === 1 ? " · só uma empresa" : ""}
                </span>
              </span>
              {r.canonico ? (
                <label className="flex shrink-0 items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={r.canonico.transita}
                    disabled={!podeEditar || alternar.isPending}
                    onChange={(e) => alternar.mutate({ id_setor_canonico: r.canonico!.id_setor_canonico, transita: e.target.checked })}
                    className="size-3.5"
                  />
                  Transita
                </label>
              ) : (
                <span className="shrink-0 text-[11px] text-gray-400">confirme para salvar</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
