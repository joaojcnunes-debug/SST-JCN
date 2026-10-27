"use client";

// Consolidação Psicossocial — o painel inteiro (abas, análises, exportação, validação) de
// UM conjunto de empresas gravado em `empresa_grupos`: um grupo de verdade (página Grupos
// de empresas) ou uma consolidação por empresa (v303, página Por empresa). Tudo o que é
// gravado (setores padronizados, fatores ignorados, registros, validações) fica no
// `id_grupo` da linha, então os dois casos funcionam igual.
//
// Saiu da página de grupo em 27/10/2026, sem mudança de comportamento.
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui.

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, BarChart3, CheckSquare, FileStack, GitCompare, Grid3x3, Layers, ListChecks, Loader2, Scale } from "lucide-react";
import AbaFontes from "@/components/psico-consolidacao/AbaFontes";
import AbaSetores from "@/components/psico-consolidacao/AbaSetores";
import AbaFatores from "@/components/psico-consolidacao/AbaFatores";
import AbaComparativo from "@/components/psico-consolidacao/AbaComparativo";
import AbaVisoes from "@/components/psico-consolidacao/AbaVisoes";
import AbaConfronto from "@/components/psico-consolidacao/AbaConfronto";
import AbaHarmonizacao from "@/components/psico-consolidacao/AbaHarmonizacao";
import AbaSimNao from "@/components/psico-consolidacao/AbaSimNao";
import BarraExportar from "@/components/psico-consolidacao/BarraExportar";
import AbaValidacao from "@/components/psico-consolidacao/AbaValidacao";
import FiltrosAnalise, { SEM_FILTRO } from "@/components/psico-consolidacao/FiltrosAnalise";
import { montarOcorrencias, type Analise, type FiltroAnalise } from "@/components/psico-consolidacao/comum";
import { useCanEdit, useIsAdmin } from "@/lib/hooks/useUsuario";
import { useFontesDoGrupo, usePapeisEconomicos, usePsicoCatalogo, useSetoresDoGrupo } from "@/lib/hooks/usePsicoConsolidacao";
import { documentosPadrao } from "@/lib/psico-consolidacao/fontes";
import { montarEntrada } from "@/lib/psico-consolidacao/entrada";
import { nomesDasEmpresas } from "@/lib/psico-consolidacao/consolidacao-grupo";
import { consolidar } from "@/lib/psico-consolidacao/motor";
import type { EmpresaGrupo, MembroGrupo } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Aba = "fontes" | "setores" | "fatores" | "comparativo" | "visoes" | "confronto" | "harmonizacao" | "simnao" | "validacao";

const ABAS: Array<{ id: Aba; label: string; icon: typeof FileStack }> = [
  { id: "fontes", label: "Fontes", icon: FileStack },
  { id: "setores", label: "Setores", icon: Layers },
  { id: "fatores", label: "Fatores", icon: ListChecks },
  { id: "comparativo", label: "Comparativo AEP", icon: BarChart3 },
  { id: "visoes", label: "Visões", icon: Grid3x3 },
  { id: "confronto", label: "Confronto", icon: GitCompare },
  { id: "harmonizacao", label: "Harmonização", icon: Scale },
  { id: "simnao", label: "Sim/Não", icon: CheckSquare },
  { id: "validacao", label: "Validação", icon: BadgeCheck },
];

const ANALISE = new Set<Aba>(["comparativo", "visoes", "confronto", "harmonizacao", "simnao", "validacao"]);

export default function PainelConsolidacao({
  grupo,
  membros,
  rotuloExportar,
}: {
  grupo: EmpresaGrupo;
  membros: MembroGrupo[];
  /** Texto antes dos botões de exportar (padrão: "Exportar o grupo inteiro:"). */
  rotuloExportar?: string;
}) {
  const podeEditar = useCanEdit();
  const ehAdmin = useIsAdmin();
  const idGrupo = grupo.id_grupo;
  const [aba, setAba] = useState<Aba>("fontes");
  const [escolhidos, setEscolhidos] = useState<Set<string> | null>(null);
  const [filtro, setFiltro] = useState<FiltroAnalise>(SEM_FILTRO);
  const [incluirTrivial, setIncluirTrivial] = useState(true);

  const idsVisiveis = useMemo(() => membros.filter((m) => m.visivel).map((m) => m.id_empresa), [membros]);

  const fontes = useFontesDoGrupo(idGrupo, idsVisiveis);
  const setores = useSetoresDoGrupo(idGrupo);
  const catalogo = usePsicoCatalogo();
  const papeis = usePapeisEconomicos(idsVisiveis);

  // Grupo novo (ou empresas trocadas) → volta para os documentos padrão (o mais recente de cada tipo).
  const chaveEmpresas = idsVisiveis.join(",");
  useEffect(() => {
    setEscolhidos(null);
    setFiltro(SEM_FILTRO);
  }, [idGrupo, chaveEmpresas]);
  const usados = useMemo(
    () => escolhidos ?? documentosPadrao(fontes.data?.documentos ?? []),
    [escolhidos, fontes.data],
  );
  const linhas = useMemo(
    () => (fontes.data?.linhas ?? []).filter((l) => usados.has(l.idDocumento)),
    [fontes.data, usados],
  );
  // Duas empresas com o mesmo nome (MPR da Serra 0001-49 e 0002-20): o fim do CNPJ separa.
  const nomeEmpresa = useMemo(() => nomesDasEmpresas(membros), [membros]);

  // ── Análises (fase 5): entrada do motor e resultado, recalculados na tela ──────
  const montada = useMemo(() => {
    if (!fontes.data || !catalogo.data || !setores.data) return null;
    const comLinha = new Set(linhas.map((l) => l.idEmpresa));
    return montarEntrada({
      linhas,
      pendencias: fontes.data.pendencias.filter((p) => usados.has(p.idDocumento)),
      empresas: membros
        .filter((m) => m.visivel && (comLinha.has(m.id_empresa) || papeis.data?.get(m.id_empresa)))
        .map((m) => ({ idEmpresa: m.id_empresa, nome: nomeEmpresa(m.id_empresa), papel: papeis.data?.get(m.id_empresa) ?? null })),
      fatores: catalogo.data.fatores,
      fatorDepara: catalogo.data.depara,
      ignorados: grupo.psico_fatores_ignorados ?? [],
      canonicos: setores.data.canonicos,
      setorDepara: setores.data.depara,
      aepIncluirTrivialBaixo: incluirTrivial,
    });
  }, [fontes.data, catalogo.data, setores.data, grupo, linhas, usados, membros, papeis.data, nomeEmpresa, incluirTrivial]);
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

  return (
    <>
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

      {fontes.isLoading || setores.isLoading || catalogo.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Lendo os documentos das empresas…
        </div>
      ) : fontes.isError || setores.isError || catalogo.isError ? (
        <p className="py-16 text-center text-sm text-red-600">Erro ao carregar a consolidação.</p>
      ) : !fontes.data ? (
        <p className="py-16 text-center text-sm text-gray-500">Nenhuma destas empresas está acessível para você.</p>
      ) : ANALISE.has(aba) ? (
        !analise ? null : (
          <div className="space-y-4">
            {aba !== "validacao" && (
              <>
                <FiltrosAnalise
                  analise={analise}
                  filtro={filtro}
                  onFiltro={setFiltro}
                  incluirTrivial={incluirTrivial}
                  onIncluirTrivial={setIncluirTrivial}
                  linhasSemFator={montada?.linhasSemFator ?? 0}
                />
                <BarraExportar
                  idGrupo={idGrupo}
                  rotulo={rotuloExportar}
                  documentosEscolhidos={escolhidos ? [...escolhidos] : null}
                  incluirTrivial={incluirTrivial}
                  nomeCurto={nomeCurto}
                  dados={{
                    grupo: grupo.nome,
                    r: analise.r,
                    itens: analise.itens,
                    nomeEmpresa,
                    nomeFator: analise.nomeFator,
                    documentos: fontes.data.documentos.filter((d) => usados.has(d.id)),
                    empresasInfo: fontes.data.empresas,
                  }}
                />
              </>
            )}
            {aba === "comparativo" ? (
              <AbaComparativo
                a={analise}
                documentos={fontes.data.documentos.filter((d) => usados.has(d.id))}
                empresasInfo={fontes.data.empresas}
                setoresSemConfirmacao={montada?.setoresSemConfirmacao ?? 0}
              />
            ) : aba === "visoes" ? (
              <AbaVisoes a={analise} />
            ) : aba === "confronto" ? (
              <AbaConfronto a={analise} />
            ) : aba === "harmonizacao" ? (
              <AbaHarmonizacao a={analise} />
            ) : aba === "validacao" ? (
              <AbaValidacao
                a={analise}
                idGrupo={idGrupo}
                documentos={fontes.data.documentos.filter((d) => usados.has(d.id))}
                canonicos={setores.data?.canonicos ?? []}
                ignorados={grupo.psico_fatores_ignorados ?? []}
                incluirTrivial={incluirTrivial}
                setoresSemConfirmacao={montada?.setoresSemConfirmacao ?? 0}
                podeEditar={podeEditar}
                grupoNome={grupo.nome}
                nomeCurto={nomeCurto}
              />
            ) : (
              <AbaSimNao a={analise} />
            )}
          </div>
        )
      ) : aba === "fontes" ? (
        <AbaFontes
          membros={membros}
          fontes={fontes.data}
          escolhidos={usados}
          onAlternar={alternarDocumento}
          podeEditar={podeEditar}
        />
      ) : aba === "setores" ? (
        <AbaSetores
          idGrupo={idGrupo}
          linhas={linhas}
          nomeEmpresa={nomeEmpresa}
          canonicos={setores.data?.canonicos ?? []}
          depara={setores.data?.depara ?? []}
          podeEditar={podeEditar}
        />
      ) : (
        <AbaFatores
          idGrupo={idGrupo}
          ignorados={grupo.psico_fatores_ignorados ?? []}
          linhas={linhas}
          fatores={catalogo.data?.fatores ?? []}
          depara={catalogo.data?.depara ?? []}
          podeEditar={podeEditar}
          ehAdmin={ehAdmin}
        />
      )}
    </>
  );
}
