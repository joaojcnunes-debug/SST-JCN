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
// 0.3.336 (pedido do usuário): sem consolidação aberta, a tela mostra as consolidações em CARTÕES (situação do registro,
// documentos, avisos e ações) em vez de ficar vazia; a aberta vai para o endereço (?consolidacao=…) — voltar ou mandar
// o link abre direto nela — e a última aberta vira o atalho "Continuar onde parou" (antes abria sozinha).
//
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui.

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import CartoesConsolidacao, { useDocsPorEmpresa, type CartaoItem } from "@/components/psico-consolidacao/CartoesConsolidacao";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { avisosDoCartao, resumirDocs, resumirRegistro } from "@/lib/consolidacao/cartoes";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import EmpresasMultiSelect from "@/components/empresas/EmpresasMultiSelect";
import PainelConsolidacao from "@/components/psico-consolidacao/PainelConsolidacao";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useConsolidacoesPorEmpresa,
  useExcluirConsolidacaoPorEmpresa,
  useMembrosDaConsolidacao,
  useResumoRegistrosConsolidacao,
  useSalvarConsolidacaoPorEmpresa,
} from "@/lib/hooks/usePsicoConsolidacao";

// A última consolidação aberta fica no navegador de quem olha (preferência, não dado).
const CHAVE_ULTIMA = "chabra:consolidacao-por-empresa:ultima";

type Edicao = { id: string | null; nome: string; empresas: string[] };

export default function ConsolidacaoPorEmpresaPage() {
  // useSearchParams() exige um limite de Suspense para o build do Next não falhar.
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const podeEditar = useCanEdit();
  const { data: consolidacoes = [], isLoading } = useConsolidacoesPorEmpresa();
  const salvar = useSalvarConsolidacaoPorEmpresa();
  const excluir = useExcluirConsolidacaoPorEmpresa();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = params.get("consolidacao") ?? "";
  const setId = (novo: string) => router.replace(novo ? `${pathname}?consolidacao=${encodeURIComponent(novo)}` : pathname, { scroll: false });
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);

  useEffect(() => {
    try {
      if (id) localStorage.setItem(CHAVE_ULTIMA, id);
      else setUltimoId(localStorage.getItem(CHAVE_ULTIMA));
    } catch {
      /* navegador sem storage */
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/30"
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
              className="inline-flex items-center gap-1.5 rounded-md bg-marca-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
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
      ) : !id ? (
        <>
          {podeEditar && (
            <button
              type="button"
              onClick={() => setEdicao({ id: null, nome: "", empresas: [] })}
              className="inline-flex items-center gap-1.5 rounded-md border border-marca-primary px-3 py-2 text-sm font-medium text-marca-primary hover:bg-marca-light"
            >
              <Plus className="size-4" /> Nova consolidação
            </button>
          )}
          <ListaConsolidacoes
            consolidacoes={consolidacoes}
            carregando={isLoading}
            ultimoId={ultimoId}
            onAbrir={setId}
            onEditar={podeEditar ? (c) => setEdicao({ id: c.id_grupo, nome: c.nome, empresas: c.empresas_consolidacao ?? [] }) : undefined}
          />
        </>
      ) : (
        <div className="flex max-w-3xl flex-wrap items-end gap-2">
          <button type="button" onClick={() => setId("")} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <ArrowLeft className="size-4" /> Todas
          </button>
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
              className="inline-flex items-center gap-1.5 rounded-md border border-marca-primary px-3 py-2 text-sm font-medium text-marca-primary hover:bg-marca-light"
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

/** 0.3.336: as consolidações salvas em cartões — situação do registro, documentos e avisos. */
function ListaConsolidacoes({
  consolidacoes,
  carregando,
  ultimoId,
  onAbrir,
  onEditar,
}: {
  consolidacoes: ReturnType<typeof useConsolidacoesPorEmpresa>["data"] & object;
  carregando: boolean;
  ultimoId: string | null;
  onAbrir: (id: string) => void;
  onEditar?: (c: NonNullable<ReturnType<typeof useConsolidacoesPorEmpresa>["data"]>[number]) => void;
}) {
  const registros = useResumoRegistrosConsolidacao();
  const { data: empresas = [], isLoading: carregandoEmpresas } = useEmpresas();
  const { docs, isLoading: carregandoDocs } = useDocsPorEmpresa();

  const itens = useMemo<CartaoItem[]>(() => {
    if (!registros.data) return [];
    const hoje = hojeSP();
    // A lista de empresas já vem recortada pelo acesso: empresa que não está nela é de fora do acesso.
    const nomes = new Map(empresas.map((e) => [e.id_empresa, e.nome_empresa]));
    return consolidacoes.map((c): CartaoItem => {
      const membros = (c.empresas_consolidacao ?? []).map((id) => ({ id, nome: nomes.get(id) ?? "Empresa fora do acesso", visivel: nomes.has(id) }));
      return {
        id: c.id_grupo,
        nome: c.nome,
        descricao: c.descricao,
        empresas: membros.length,
        registro: resumirRegistro(
          registros.data.execucoes.filter((e) => e.id_grupo === c.id_grupo),
          registros.data.validacoes,
          membros.filter((m) => m.visivel).length,
        ),
        docs: resumirDocs(membros, docs),
        avisos: avisosDoCartao(membros, docs, hoje),
        extra: membros.length > 0 && (
          <span className="line-clamp-1" title={membros.map((m) => m.nome).join(", ")}>
            {membros.map((m) => m.nome).join(", ")}
          </span>
        ),
        acoes: onEditar && (
          <button type="button" onClick={() => onEditar(c)} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50">
            <Pencil className="size-3.5" /> Editar empresas
          </button>
        ),
      };
    });
  }, [consolidacoes, registros.data, empresas, docs, onEditar]);

  if (carregando || registros.isLoading || carregandoEmpresas || carregandoDocs) return <LoadingSkeleton />;
  if (registros.error) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar: {(registros.error as Error).message}</p>;
  return (
    <CartoesConsolidacao
      itens={itens}
      rotuloItem={{ um: "consolidação", varios: "consolidações" }}
      ultimoId={ultimoId}
      onAbrir={onAbrir}
      vazio={<>Nenhuma consolidação salva. Use &quot;Nova consolidação&quot; para escolher as empresas.</>}
    />
  );
}
