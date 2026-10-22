"use client";

// Segurança do Trabalho › Consolidação Psicossocial de Grupo (v295; módulo próprio desde 19/10 —
// antes era Psicossocial › Consolidação de Grupo) — fases 3 a 8: as fontes, a padronização
// e as análises (comparativo AEP, visões, confronto, harmonização, Sim/Não).
//
// Um grupo econômico (empresa_grupos, v282) tem várias empresas e os trabalhadores
// transitam entre elas: o risco psicossocial de um setor numa empresa precisa constar
// no mesmo setor das outras. Esta tela junta a AEP e o DRPS/QPS já concluídos das
// empresas do grupo e padroniza os nomes de setor e de fator. As análises (perfil do
// setor, lacunas, confronto AEP × DRPS) saem do motor puro (`lib/psico-consolidacao/motor.ts`),
// recalculado na tela a cada mudança — nada é gravado nas abas de análise.
//
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui.

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, BarChart3, CheckSquare, FileStack, GitCompare, Grid3x3, Layers, ListChecks, Loader2, Network, Scale } from "lucide-react";
import GrupoSelect from "@/components/empresas/GrupoSelect";
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
import { montarOcorrencias, type Analise, type FiltroAnalise } from "@/components/psico-consolidacao/comum";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import { useCanEdit, useIsAdmin } from "@/lib/hooks/useUsuario";
import { useFontesDoGrupo, usePapeisEconomicos, usePsicoCatalogo, useSetoresDoGrupo } from "@/lib/hooks/usePsicoConsolidacao";
import { documentosPadrao } from "@/lib/psico-consolidacao/fontes";
import { montarEntrada } from "@/lib/psico-consolidacao/entrada";
import { nomesDasEmpresas } from "@/lib/psico-consolidacao/consolidacao-grupo";
import { consolidar } from "@/lib/psico-consolidacao/motor";
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
const SEM_FILTRO: FiltroAnalise = { empresa: "", setor: "", fator: "" };

export default function ConsolidacaoGrupoPage() {
  const { grupos, membrosPorGrupo, isLoading: carregandoGrupos } = useGruposEmpresas();
  const podeEditar = useCanEdit();
  const ehAdmin = useIsAdmin();
  const [idGrupo, setIdGrupo] = useState("");
  const [aba, setAba] = useState<Aba>("fontes");
  const [escolhidos, setEscolhidos] = useState<Set<string> | null>(null);
  const [filtro, setFiltro] = useState<FiltroAnalise>(SEM_FILTRO);
  const [incluirTrivial, setIncluirTrivial] = useState(true);

  const grupo = grupos.find((g) => g.id_grupo === idGrupo) ?? null;
  const membros = useMemo(() => membrosPorGrupo.get(idGrupo) ?? [], [membrosPorGrupo, idGrupo]);
  const idsVisiveis = useMemo(() => membros.filter((m) => m.visivel).map((m) => m.id_empresa), [membros]);

  const fontes = useFontesDoGrupo(idGrupo || null, idsVisiveis);
  const setores = useSetoresDoGrupo(idGrupo || null);
  const catalogo = usePsicoCatalogo();
  const papeis = usePapeisEconomicos(idsVisiveis);

  // Grupo novo → volta para os documentos padrão (o mais recente de cada tipo).
  useEffect(() => {
    setEscolhidos(null);
    setFiltro(SEM_FILTRO);
  }, [idGrupo]);
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
    if (!fontes.data || !catalogo.data || !setores.data || !grupo) return null;
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
    <div className="space-y-4">
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

      <div className="max-w-md">
        <GrupoSelect value={idGrupo} onChange={setIdGrupo} title="Grupo de empresas" />
        {!carregandoGrupos && grupos.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">
            Nenhum grupo cadastrado. Crie em Empresas › Grupos.
          </p>
        )}
      </div>

      {grupo && (
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
              <Loader2 className="size-4 animate-spin" /> Lendo os documentos do grupo…
            </div>
          ) : fontes.isError || setores.isError || catalogo.isError ? (
            <p className="py-16 text-center text-sm text-red-600">Erro ao carregar a consolidação deste grupo.</p>
          ) : !fontes.data ? (
            <p className="py-16 text-center text-sm text-gray-500">Nenhuma empresa deste grupo está acessível para você.</p>
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
                    idGrupo={grupo.id_grupo}
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
                    idGrupo={grupo.id_grupo}
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
              idGrupo={grupo.id_grupo}
              linhas={linhas}
              nomeEmpresa={nomeEmpresa}
              canonicos={setores.data?.canonicos ?? []}
              depara={setores.data?.depara ?? []}
              podeEditar={podeEditar}
            />
          ) : (
            <AbaFatores
              idGrupo={grupo.id_grupo}
              ignorados={grupo.psico_fatores_ignorados ?? []}
              linhas={linhas}
              fatores={catalogo.data?.fatores ?? []}
              depara={catalogo.data?.depara ?? []}
              podeEditar={podeEditar}
              ehAdmin={ehAdmin}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Filtros comuns às abas de análise (empresa, setor, fator) e o parâmetro da AEP. */
function FiltrosAnalise({
  analise,
  filtro,
  onFiltro,
  incluirTrivial,
  onIncluirTrivial,
  linhasSemFator,
}: {
  analise: Analise;
  filtro: FiltroAnalise;
  onFiltro: (f: FiltroAnalise) => void;
  incluirTrivial: boolean;
  onIncluirTrivial: (v: boolean) => void;
  linhasSemFator: number;
}) {
  const { r, nomeEmpresa } = analise;
  const empresas = [...new Set(r.setores.flatMap((s) => s.empresas))].sort((a, b) =>
    nomeEmpresa(a).localeCompare(nomeEmpresa(b), "pt-BR"),
  );
  const sel = "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm";
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filtrar empresa" value={filtro.empresa} onChange={(e) => onFiltro({ ...filtro, empresa: e.target.value })} className={sel}>
          <option value="">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e} value={e}>{nomeEmpresa(e)}</option>
          ))}
        </select>
        <select aria-label="Filtrar setor" value={filtro.setor} onChange={(e) => onFiltro({ ...filtro, setor: e.target.value })} className={sel}>
          <option value="">Todos os setores</option>
          {r.setores.map((s) => (
            <option key={s.setor} value={s.setor}>{s.setor}</option>
          ))}
        </select>
        <select aria-label="Filtrar fator" value={filtro.fator} onChange={(e) => onFiltro({ ...filtro, fator: e.target.value })} className={sel}>
          <option value="">Todos os fatores</option>
          {r.fatores.map((f) => (
            <option key={f.id_fator} value={f.id_fator}>{f.nome}</option>
          ))}
        </select>
        {(filtro.empresa || filtro.setor || filtro.fator) && (
          <button type="button" onClick={() => onFiltro(SEM_FILTRO)} className="text-xs text-gray-500 underline hover:text-gray-700">
            limpar filtros
          </button>
        )}
        <label
          className="ml-auto flex items-center gap-1.5 text-xs text-gray-600"
          title="Desmarcado: fator da AEP com nível AIHA Trivial ou Baixo não entra no perfil"
        >
          <input type="checkbox" checked={incluirTrivial} onChange={(e) => onIncluirTrivial(e.target.checked)} className="size-3.5" />
          AEP: incluir fatores Trivial/Baixo na AIHA
        </label>
      </div>
      <p className="text-[11px] text-gray-500">
        {r.fatores.length} fatores · {r.setores.length} setores padronizados ({r.setores.filter((s) => s.comum).length} comuns) ·{" "}
        {empresas.length} empresas com documento
        {linhasSemFator > 0 && (
          <span className="text-amber-700"> · {linhasSemFator} linha(s) sem fator correspondente ficaram fora (aba Fatores)</span>
        )}
      </p>
    </div>
  );
}
