"use client";

// Segurança do Trabalho › Consolidação › Por empresa (27/10/2026; completa desde a v303).
//
// A mesma consolidação da página de grupo — Fontes, Setores, Fatores, análises, Validação,
// planilhas, apresentação e PDF — com as empresas escolhidas na hora. Como uma empresa só
// pode estar em UM grupo, a seleção é salva como uma "consolidação por empresa": uma linha de
// `empresa_grupos` do tipo CONSOLIDACAO, com as empresas em `empresas_consolidacao`. Ela não
// aparece nas listas de grupos e não mexe no grupo de nenhuma empresa. O painel é o mesmo
// componente da página de grupo (`PainelConsolidacao`).
//
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui.

import { useEffect, useState } from "react";
import { Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import EmpresasMultiSelect from "@/components/empresas/EmpresasMultiSelect";
import PainelConsolidacao from "@/components/psico-consolidacao/PainelConsolidacao";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useConsolidacoesPorEmpresa,
  useExcluirConsolidacaoPorEmpresa,
  useMembrosDaConsolidacao,
  useSalvarConsolidacaoPorEmpresa,
} from "@/lib/hooks/usePsicoConsolidacao";

// A última consolidação aberta fica no navegador de quem olha (preferência, não dado).
const CHAVE_ULTIMA = "chabra:consolidacao-por-empresa:ultima";

type Edicao = { id: string | null; nome: string; empresas: string[] };

export default function ConsolidacaoPorEmpresaPage() {
  const podeEditar = useCanEdit();
  const { data: consolidacoes = [], isLoading } = useConsolidacoesPorEmpresa();
  const salvar = useSalvarConsolidacaoPorEmpresa();
  const excluir = useExcluirConsolidacaoPorEmpresa();
  const [id, setId] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_ULTIMA);
      if (salvo) setId(salvo);
    } catch {
      /* navegador sem storage: começa vazio */
    }
  }, []);
  useEffect(() => {
    try {
      if (id) localStorage.setItem(CHAVE_ULTIMA, id);
      else localStorage.removeItem(CHAVE_ULTIMA);
    } catch {
      /* idem */
    }
  }, [id]);

  const atual = consolidacoes.find((c) => c.id_grupo === id) ?? null;
  const membros = useMembrosDaConsolidacao(atual?.id_grupo ?? null, atual?.empresas_consolidacao);

  const gravar = async () => {
    if (!edicao) return;
    const novoId = await salvar.mutateAsync({ id_grupo: edicao.id, nome: edicao.nome, empresas: edicao.empresas }).catch(() => null);
    if (novoId) {
      setId(novoId);
      setEdicao(null);
    }
  };

  const apagar = async () => {
    if (!atual) return;
    if (!window.confirm(`Excluir a consolidação "${atual.nome}"? A padronização de setores dela também é apagada.`)) return;
    await excluir.mutateAsync(atual.id_grupo).then(() => setId("")).catch(() => undefined);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Building2 className="size-5 text-indigo-600" />
          Consolidação por empresa
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
          Escolha as empresas e faça a mesma consolidação de um grupo — setores, fatores, análises, validação e relatório —
          sem precisar cadastrar um grupo. A seleção fica salva com um nome para você voltar a ela.
        </p>
      </div>

      {edicao ? (
        <div className="max-w-2xl space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-900">{edicao.id ? "Editar consolidação" : "Nova consolidação"}</p>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Nome</span>
            <input
              autoFocus
              value={edicao.nome}
              onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
              placeholder="Ex.: Obras Serra 2026"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </label>
          <div>
            <span className="text-xs font-medium text-gray-600">Empresas</span>
            <EmpresasMultiSelect value={edicao.empresas} onChange={(empresas) => setEdicao({ ...edicao, empresas })} className="mt-1" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={gravar}
              disabled={salvar.isPending || !edicao.nome.trim() || edicao.empresas.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
            </button>
            <button
              type="button"
              onClick={() => setEdicao(null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex max-w-3xl flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-medium text-gray-600">Consolidação</span>
            <select
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={isLoading}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">{isLoading ? "Carregando…" : consolidacoes.length ? "Selecione…" : "Nenhuma consolidação salva"}</option>
              {consolidacoes.map((c) => (
                <option key={c.id_grupo} value={c.id_grupo}>
                  {c.nome} ({c.empresas_consolidacao?.length ?? 0} empresas)
                </option>
              ))}
            </select>
          </label>
          {podeEditar && (
            <button
              type="button"
              onClick={() => setEdicao({ id: null, nome: "", empresas: [] })}
              className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary px-3 py-2 text-sm font-medium text-verde-primary hover:bg-verde-light"
            >
              <Plus className="size-4" /> Nova consolidação
            </button>
          )}
          {podeEditar && atual && (
            <>
              <button
                type="button"
                onClick={() => setEdicao({ id: atual.id_grupo, nome: atual.nome, empresas: atual.empresas_consolidacao ?? [] })}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="size-4" /> Editar empresas
              </button>
              <button
                type="button"
                onClick={apagar}
                disabled={excluir.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="size-4" /> Excluir
              </button>
            </>
          )}
        </div>
      )}

      {atual && !edicao && (
        membros.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Lendo as empresas…
          </div>
        ) : membros.isError ? (
          <p className="py-16 text-center text-sm text-red-600">Erro ao carregar as empresas desta consolidação.</p>
        ) : (
          <PainelConsolidacao grupo={atual} membros={membros.data ?? []} rotuloExportar="Exportar a consolidação inteira:" />
        )
      )}
    </div>
  );
}
