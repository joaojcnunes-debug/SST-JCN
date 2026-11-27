"use client";

// Segurança do Trabalho › Consolidação Psicossocial de Grupo (v295; módulo próprio desde 19/10 —
// antes era Psicossocial › Consolidação de Grupo) — fases 3 a 8: as fontes, a padronização
// e as análises (comparativo AEP, visões, confronto, harmonização, Sim/Não).
//
// Um grupo econômico (empresa_grupos, v282) tem várias empresas e os trabalhadores
// transitam entre elas: o risco psicossocial de um setor numa empresa precisa constar
// no mesmo setor das outras. Esta tela junta a AEP e o DRPS/QPS já concluídos das
// empresas do grupo e padroniza os nomes de setor e de fator. As abas e as análises
// ficam em `PainelConsolidacao`, que a página Por empresa (v303) também usa.
//
// 0.3.336 (pedido do usuário): sem grupo escolhido, a tela mostra os grupos em CARTÕES (situação do registro, documentos,
// avisos e ações) em vez de ficar vazia; o grupo aberto vai para o endereço (?grupo=…) — voltar ou mandar o link abre
// direto nele — e o último aberto vira o atalho "Continuar onde parou".
//
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, GitMerge, Network, Plus } from "lucide-react";
import GrupoSelect from "@/components/empresas/GrupoSelect";
import PainelConsolidacao from "@/components/psico-consolidacao/PainelConsolidacao";
import CartoesConsolidacao, { useDocsPorEmpresa, type CartaoItem } from "@/components/psico-consolidacao/CartoesConsolidacao";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import { useResumoRegistrosConsolidacao } from "@/lib/hooks/usePsicoConsolidacao";
import { useRegistrosConciliacaoGrupo } from "@/lib/hooks/useConciliacaoParecer";
import { avisosDoCartao, resumirDocs, resumirRegistro } from "@/lib/consolidacao/cartoes";
import { empresasFora } from "@/lib/psico-consolidacao/selecao-grupo";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import { fmtData } from "@/lib/utils";

const CHAVE_ULTIMO = "chabra:consolidacao-grupo:ultimo";

export default function ConsolidacaoGrupoPage() {
  // useSearchParams() exige um limite de Suspense para o build do Next não falhar.
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Conteudo />
    </Suspense>
  );
}

function Conteudo() {
  const { grupos, membrosPorGrupo, isLoading: carregandoGrupos } = useGruposEmpresas();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const idGrupo = params.get("grupo") ?? "";

  const abrir = (id: string) => router.replace(id ? `${pathname}?grupo=${encodeURIComponent(id)}` : pathname, { scroll: false });

  // O último aberto neste navegador (preferência de quem olha, não dado): guarda ao abrir, relê ao voltar para a lista.
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  useEffect(() => {
    try {
      if (idGrupo) localStorage.setItem(CHAVE_ULTIMO, idGrupo);
      else setUltimoId(localStorage.getItem(CHAVE_ULTIMO));
    } catch {
      /* navegador sem storage */
    }
  }, [idGrupo]);

  const grupo = grupos.find((g) => g.id_grupo === idGrupo) ?? null;
  const membros = useMemo(() => membrosPorGrupo.get(idGrupo) ?? [], [membrosPorGrupo, idGrupo]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Network className="size-5 text-indigo-600" />
            Consolidação de Grupo
          </h1>
          <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
            Junta a AEP e o DRPS/Questionário concluídos das empresas de um grupo econômico e padroniza os setores e os
            fatores, para que o risco achado num setor conste no mesmo setor de todas as empresas do grupo.
          </p>
        </div>
        {!idGrupo && (
          <Link href="/empresas/grupos" className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
            <Plus className="size-4" /> Criar ou editar grupos
          </Link>
        )}
      </div>

      {idGrupo ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" onClick={() => abrir("")} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="size-4" /> Todos os grupos
            </button>
            <div className="w-full max-w-md">
              <GrupoSelect value={idGrupo} onChange={abrir} title="Grupo de empresas" />
            </div>
          </div>
          {!carregandoGrupos && !grupo && <p className="text-sm text-gray-500">Grupo não encontrado (o link pode ser de um grupo excluído).</p>}
          {grupo && <PainelConsolidacao grupo={grupo} membros={membros} />}
        </>
      ) : (
        <ListaGrupos ultimoId={ultimoId} onAbrir={abrir} />
      )}
    </div>
  );
}

function ListaGrupos({ ultimoId, onAbrir }: { ultimoId: string | null; onAbrir: (id: string) => void }) {
  const { grupos, membrosPorGrupo, isLoading } = useGruposEmpresas();
  const registros = useResumoRegistrosConsolidacao();
  const conciliacao = useRegistrosConciliacaoGrupo();
  const { docs, isLoading: carregandoDocs } = useDocsPorEmpresa();

  const itens = useMemo<CartaoItem[]>(() => {
    if (!registros.data) return [];
    const hoje = hojeSP();
    const ultimoFech = new Map<string, { fechado_em: string; reaberta: boolean }>();
    for (const f of conciliacao.data?.fechamentos ?? []) {
      if (!ultimoFech.has(f.id_grupo)) ultimoFech.set(f.id_grupo, { fechado_em: f.fechado_em, reaberta: !!f.reabertura });
    }
    return grupos.map((g): CartaoItem => {
      const fora = empresasFora(g);
      const membros = (membrosPorGrupo.get(g.id_grupo) ?? [])
        .filter((m) => !fora.has(m.id_empresa))
        .map((m) => ({ id: m.id_empresa, nome: m.nome_empresa, visivel: m.visivel }));
      const fech = ultimoFech.get(g.id_grupo);
      return {
        id: g.id_grupo,
        nome: g.nome,
        descricao: g.descricao,
        empresas: membros.length,
        registro: resumirRegistro(
          registros.data.execucoes.filter((e) => e.id_grupo === g.id_grupo),
          registros.data.validacoes,
          membros.filter((m) => m.visivel).length,
        ),
        docs: resumirDocs(membros, docs),
        avisos: avisosDoCartao(membros, docs, hoje),
        extra: (
          <span className="inline-flex items-center gap-1">
            <GitMerge className="size-3.5 text-gray-400" />
            Conciliação: {!fech ? "não fechada" : fech.reaberta ? "reaberta" : `fechada em ${fmtData(fech.fechado_em)}`}
          </span>
        ),
        acoes: (
          <>
            <Link href={`/consolidacao-grupo/conciliacao-grupo/${g.id_grupo}`} className="rounded-md border border-gray-300 px-2.5 py-1 font-medium text-gray-700 hover:bg-gray-50">
              Conciliação
            </Link>
            <Link href="/empresas/grupos" className="rounded-md px-2 py-1 text-gray-500 hover:text-indigo-700 hover:underline">
              Editar grupo
            </Link>
          </>
        ),
      };
    });
  }, [grupos, membrosPorGrupo, registros.data, conciliacao.data, docs]);

  if (isLoading || registros.isLoading || carregandoDocs) return <LoadingSkeleton />;
  if (registros.error) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar: {(registros.error as Error).message}</p>;

  return (
    <CartoesConsolidacao
      itens={itens}
      rotuloItem={{ um: "grupo", varios: "grupos" }}
      ultimoId={ultimoId}
      onAbrir={onAbrir}
      vazio={<>Nenhum grupo cadastrado. <Link href="/empresas/grupos" className="font-medium text-indigo-700 underline">Crie em Empresas › Grupos</Link>.</>}
    />
  );
}
