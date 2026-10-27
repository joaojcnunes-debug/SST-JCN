"use client";

// Segurança do Trabalho › Consolidação › Por empresa (27/10/2026).
//
// A mesma consolidação da página de grupo (AEP + DRPS/QPS concluídos, motor puro de
// `lib/psico-consolidacao/motor.ts`), mas com empresas escolhidas na hora, sem precisar
// de um grupo cadastrado. O que é GRAVADO por grupo não existe aqui:
// - setores: casados pela sugestão automática do nome (`sugerirSetorCanonico`), sem a
//   padronização confirmada da aba Setores;
// - fatores: o catálogo e o de-para gerais valem; nenhum fator é deixado de fora;
// - Validação (registro e decisão do cliente) e o relatório ao cliente em PDF são do grupo.
// Para essas partes, a tela aponta para Empresas › Grupos.
//
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Building2, CheckSquare, FileStack, GitCompare, Grid3x3, Info, Loader2, Scale } from "lucide-react";
import EmpresasMultiSelect from "@/components/empresas/EmpresasMultiSelect";
import AbaFontes from "@/components/psico-consolidacao/AbaFontes";
import AbaComparativo from "@/components/psico-consolidacao/AbaComparativo";
import AbaVisoes from "@/components/psico-consolidacao/AbaVisoes";
import AbaConfronto from "@/components/psico-consolidacao/AbaConfronto";
import AbaHarmonizacao from "@/components/psico-consolidacao/AbaHarmonizacao";
import AbaSimNao from "@/components/psico-consolidacao/AbaSimNao";
import BarraExportar from "@/components/psico-consolidacao/BarraExportar";
import FiltrosAnalise, { SEM_FILTRO } from "@/components/psico-consolidacao/FiltrosAnalise";
import { montarOcorrencias, type Analise, type FiltroAnalise } from "@/components/psico-consolidacao/comum";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useFontesDoGrupo, usePapeisEconomicos, usePsicoCatalogo } from "@/lib/hooks/usePsicoConsolidacao";
import { documentosPadrao } from "@/lib/psico-consolidacao/fontes";
import { montarEntrada } from "@/lib/psico-consolidacao/entrada";
import { nomesDasEmpresas } from "@/lib/psico-consolidacao/consolidacao-grupo";
import { consolidar } from "@/lib/psico-consolidacao/motor";
import type { MembroGrupo } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Aba = "fontes" | "comparativo" | "visoes" | "confronto" | "harmonizacao" | "simnao";

const ABAS: Array<{ id: Aba; label: string; icon: typeof FileStack }> = [
  { id: "fontes", label: "Fontes", icon: FileStack },
  { id: "comparativo", label: "Comparativo AEP", icon: BarChart3 },
  { id: "visoes", label: "Visões", icon: Grid3x3 },
  { id: "confronto", label: "Confronto", icon: GitCompare },
  { id: "harmonizacao", label: "Harmonização", icon: Scale },
  { id: "simnao", label: "Sim/Não", icon: CheckSquare },
];

// Chave da consulta das fontes: não há grupo, então as próprias empresas identificam.
const SEM_GRUPO = "por-empresa";

export default function ConsolidacaoPorEmpresaPage() {
  const podeEditar = useCanEdit();
  const { data: empresas = [] } = useEmpresas();
  const [ids, setIds] = useState<string[]>([]);
  const [aba, setAba] = useState<Aba>("fontes");
  const [escolhidos, setEscolhidos] = useState<Set<string> | null>(null);
  const [filtro, setFiltro] = useState<FiltroAnalise>(SEM_FILTRO);
  const [incluirTrivial, setIncluirTrivial] = useState(true);

  // As escolhidas viram "membros" no formato que as abas já usam (todas visíveis:
  // a lista de empresas já vem filtrada pelo que a pessoa pode ver).
  const membros = useMemo<MembroGrupo[]>(() => {
    const porId = new Map(empresas.map((e) => [e.id_empresa, e]));
    return ids
      .map((id) => porId.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({
        id_empresa: e.id_empresa,
        id_grupo: "",
        papel_grupo: "FILIAL",
        nome_empresa: e.nome_empresa,
        razao_social: e.razao_social,
        nome_fantasia: e.nome_fantasia ?? null,
        cnpj: e.cnpj,
        id_unidade: e.id_unidade ?? null,
        unidade_nome: null,
        status: e.status ?? null,
        visivel: true,
      }));
  }, [empresas, ids]);
  const idsVisiveis = useMemo(() => membros.map((m) => m.id_empresa), [membros]);

  const fontes = useFontesDoGrupo(idsVisiveis.length ? SEM_GRUPO : null, idsVisiveis);
  const catalogo = usePsicoCatalogo();
  const papeis = usePapeisEconomicos(idsVisiveis);

  // Mudou a seleção → volta para os documentos padrão (o mais recente de cada tipo).
  useEffect(() => {
    setEscolhidos(null);
    setFiltro(SEM_FILTRO);
  }, [ids]);
  const usados = useMemo(
    () => escolhidos ?? documentosPadrao(fontes.data?.documentos ?? []),
    [escolhidos, fontes.data],
  );
  const linhas = useMemo(
    () => (fontes.data?.linhas ?? []).filter((l) => usados.has(l.idDocumento)),
    [fontes.data, usados],
  );
  const nomeEmpresa = useMemo(() => nomesDasEmpresas(membros), [membros]);

  const montada = useMemo(() => {
    if (!fontes.data || !catalogo.data || membros.length === 0) return null;
    const comLinha = new Set(linhas.map((l) => l.idEmpresa));
    return montarEntrada({
      linhas,
      pendencias: fontes.data.pendencias.filter((p) => usados.has(p.idDocumento)),
      empresas: membros
        .filter((m) => comLinha.has(m.id_empresa) || papeis.data?.get(m.id_empresa))
        .map((m) => ({ idEmpresa: m.id_empresa, nome: nomeEmpresa(m.id_empresa), papel: papeis.data?.get(m.id_empresa) ?? null })),
      fatores: catalogo.data.fatores,
      fatorDepara: catalogo.data.depara,
      ignorados: [],
      canonicos: [],
      setorDepara: [],
      aepIncluirTrivialBaixo: incluirTrivial,
    });
  }, [fontes.data, catalogo.data, linhas, usados, membros, papeis.data, nomeEmpresa, incluirTrivial]);
  const resultado = useMemo(() => (montada ? consolidar(montada.entrada) : null), [montada]);
  const analise = useMemo<Analise | null>(() => {
    if (!montada || !resultado) return null;
    const nomes = new Map(resultado.fatores.map((f) => [f.id_fator, f.nome]));
    return {
      r: resultado,
      itens: montada.entrada.itens,
      nomeEmpresa,
      nomeFator: (id: string) => nomes.get(id) ?? id,
      filtro,
      ocorrencias: montarOcorrencias(montada.entrada.itens, new Set(nomes.keys()), incluirTrivial),
    };
  }, [montada, resultado, nomeEmpresa, filtro, incluirTrivial]);

  const nomeCurto = useMemo(() => {
    const m = new Map((catalogo.data?.fatores ?? []).map((f) => [f.id_fator, f.nome_curto || f.nome]));
    return (id: string) => m.get(id) ?? id;
  }, [catalogo.data]);

  const alternarDocumento = (id: string) =>
    setEscolhidos(() => {
      const novo = new Set(usados);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  // Nome que vai nos arquivos exportados.
  const titulo =
    membros.length === 0 ? "" : membros.length <= 3 ? membros.map((m) => m.nome_empresa).join(", ") : `${membros.length} empresas`;
  const documentosUsados = fontes.data?.documentos.filter((d) => usados.has(d.id)) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Building2 className="size-5 text-indigo-600" />
          Consolidação por empresa
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
          Junta a AEP e o DRPS/Questionário concluídos das empresas que você escolher, sem precisar de um grupo
          cadastrado, e mostra as mesmas análises da consolidação de grupo.
        </p>
      </div>

      <div className="max-w-xl">
        <EmpresasMultiSelect value={ids} onChange={setIds} />
      </div>

      {membros.length > 0 && (
        <>
          <p className="flex max-w-3xl items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Aqui os setores são casados pelo nome (sugestão automática) e nada fica gravado. Para confirmar a
              padronização dos setores, deixar fatores de fora, registrar a validação do cliente e gerar o relatório em
              PDF, cadastre as empresas num grupo em{" "}
              <Link href="/empresas/grupos" className="font-medium underline">
                Empresas › Grupos
              </Link>{" "}
              e use <strong>Grupos de empresas</strong>.
            </span>
          </p>

          <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={cn(
                  "-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                  aba === a.id ? "border-verde-primary text-verde-primary" : "border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                <a.icon className="size-4" /> {a.label}
              </button>
            ))}
          </div>

          {fontes.isLoading || catalogo.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" /> Lendo os documentos das empresas…
            </div>
          ) : fontes.isError || catalogo.isError ? (
            <p className="py-16 text-center text-sm text-red-600">Erro ao carregar a consolidação destas empresas.</p>
          ) : !fontes.data ? null : aba === "fontes" ? (
            <AbaFontes
              membros={membros}
              fontes={fontes.data}
              escolhidos={usados}
              onAlternar={alternarDocumento}
              podeEditar={podeEditar}
            />
          ) : !analise ? null : (
            <div className="space-y-4">
              <FiltrosAnalise
                analise={analise}
                filtro={filtro}
                onFiltro={setFiltro}
                incluirTrivial={incluirTrivial}
                onIncluirTrivial={setIncluirTrivial}
                linhasSemFator={montada?.linhasSemFator ?? 0}
              />
              <BarraExportar
                rotulo="Exportar as empresas escolhidas:"
                documentosEscolhidos={escolhidos ? [...escolhidos] : null}
                incluirTrivial={incluirTrivial}
                nomeCurto={nomeCurto}
                dados={{
                  grupo: titulo,
                  r: analise.r,
                  itens: analise.itens,
                  nomeEmpresa,
                  nomeFator: analise.nomeFator,
                  documentos: documentosUsados,
                  empresasInfo: fontes.data.empresas,
                }}
              />
              {aba === "comparativo" ? (
                // Sem grupo não há padronização confirmada: a sugestão É a regra, não um aviso.
                <AbaComparativo a={analise} documentos={documentosUsados} empresasInfo={fontes.data.empresas} setoresSemConfirmacao={0} />
              ) : aba === "visoes" ? (
                <AbaVisoes a={analise} />
              ) : aba === "confronto" ? (
                <AbaConfronto a={analise} />
              ) : aba === "harmonizacao" ? (
                <AbaHarmonizacao a={analise} />
              ) : (
                <AbaSimNao a={analise} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
