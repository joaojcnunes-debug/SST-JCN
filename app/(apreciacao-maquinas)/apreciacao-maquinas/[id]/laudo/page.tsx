"use client";

import React, { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Download, Loader2, AlertTriangle } from "lucide-react";
import { usePdfAssinado, usePdfCongelado } from "@/lib/hooks/usePdfsGerados";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import AnexosManager from "@/components/anexos/AnexosManager";
import PainelCongelamentoPdf from "@/components/ui/PainelCongelamentoPdf";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useMaquina } from "@/lib/hooks/useInventarioMaquinas";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import StorageImg from "@/components/ui/StorageImg";
import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
import { useTextosPadrao } from "@/lib/hooks/useTextosPadrao";
import { montarValoresEmpresa, formatarDataBR, substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { useApreciacaoMaquina, useAcoesApreciacao } from "@/lib/hooks/useApreciacoesMaquinas";
import { useRiscosHrn } from "@/lib/hooks/useRiscosHrn";
import { useFichasMaquina } from "@/lib/hooks/useFichasMaquina";
import { agruparFichasPorSetor } from "@/lib/supabase/types";
import {
  POD_HRN_LABELS,
  FEP_HRN_LABELS,
  GPD_HRN_LABELS,
  CLASSIFICACAO_HRN_LABELS,
  calcularIndiceHrn,
  type PodHrn,
  type FepHrn,
  type GpdHrn,
  type ClassificacaoRiscoHrn,
} from "@/lib/supabase/types";
import ItemApreciacaoCard from "@/components/apreciacao-maquinas/ItemApreciacaoCard";
import PlanoAcaoTable from "@/components/apreciacao-maquinas/PlanoAcaoTable";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";
import {
  CATEGORIAS_NR12_LABELS,
  CATEGORIAS_NR12_ORDEM,
  type CategoriaNR12,
} from "@/lib/apreciacao-maquinas/catalogo-nr12";
import type { ApreciacaoMaquinaItem } from "@/lib/supabase/types";

export default function LaudoApreciacaoMaquinasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useApreciacaoMaquina(id);
  const { data: empresas = [] } = useEmpresas();
  const { data: maquinaVinculada } = useMaquina(data?.apreciacao.id_maquina ?? null);

  const apreciacao = data?.apreciacao;
  const itens = data?.itens ?? [];

  const { data: riscosHrn = [] } = useRiscosHrn(id);
  const { data: fichas = [] } = useFichasMaquina(id);
  const { data: acoesLaudo = [] } = useAcoesApreciacao(id);
  // Plano de Ação só entra no laudo quando há ação COM conteúdo (igual ao PDF/DRPS).
  const acoesComConteudo = acoesLaudo.filter((a) =>
    [a.what_acao, a.why_justificativa, a.where_local, a.when_prazo, a.who_responsavel, a.how_metodo, a.how_much_custo]
      .some((v) => (v ?? "").trim().length > 0),
  );
  const { pdfAssinado, recarregar } = usePdfAssinado("apreciacoes_maquinas", id);
  const { data: pdfCongelado } = usePdfCongelado("apreciacao_maquinas", id);
  const baseCongeladaUrl = pdfCongelado?.pdf_url ?? undefined;
  const [baixando, setBaixando] = useState(false);

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    setBaixando(true);
    try {
      await baixarPdfAssinado(pdfAssinado.pdf_path, "relatorio-assinado.pdf");
    } catch { toast.error("Erro ao baixar o PDF."); }
    finally { setBaixando(false); }
  }

  const empresa = useMemo(() => {
    if (!apreciacao) return null;
    return empresas.find((e) => e.id_empresa === apreciacao.id_empresa) ?? null;
  }, [empresas, apreciacao]);

  const empresaNome = empresa?.nome_empresa ?? "—";

  const maquinaNome =
    maquinaVinculada?.nome ?? apreciacao?.maquina_descricao ?? "Máquina";

  const itensPorCategoria = useMemo(() => {
    const grupos: Record<string, ApreciacaoMaquinaItem[]> = {};
    itens.forEach((i) => {
      const cat = i.item_categoria;
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(i);
    });
    return CATEGORIAS_NR12_ORDEM.map((cat) => ({
      categoria: cat as CategoriaNR12,
      label: CATEGORIAS_NR12_LABELS[cat as CategoriaNR12],
      itens: grupos[cat] ?? [],
    })).filter((g) => g.itens.length > 0);
  }, [itens]);

  const valoresTextosPadrao = useMemo((): Record<string, string> => {
    if (!apreciacao) return {};
    return {
      ...montarValoresEmpresa(empresa),
      titulo: apreciacao.titulo ?? "",
      maquina_nome: maquinaNome,
      setor: apreciacao.setor ?? "",
      responsavel: apreciacao.responsavel ?? "",
      responsavel_empresa: apreciacao.responsavel_empresa ?? "",
      cidade: apreciacao.cidade ?? "",
      data_apreciacao: formatarDataBR(apreciacao.data_apreciacao),
      data_atual: new Date().toLocaleDateString("pt-BR"),
      total_itens: String(itens.length),
      total_nao_conforme: String(itens.filter((i) => i.situacao === "NAO_CONFORME").length),
      risco_residual: apreciacao.risco_residual ?? "",
      carimbo: apreciacao.responsavel ?? "",
      importado: formatarDataBR(apreciacao.created_at),
    };
  }, [apreciacao, empresa, maquinaNome, itens]);

  const { data: capitulosAp = [] } = useTextosPadrao("apreciacao_maquinas");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error || !apreciacao) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href="/apreciacao-maquinas"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="size-4" />
          Apreciação não encontrada.
        </div>
      </div>
    );
  }

  // Título cadastrado de cada seção fixa (p/ cabeçalho numerado no corpo).
  const tituloPorSlugAp: Record<string, string> = {};
  for (const c of capitulosAp) if (c.slug_fixo) tituloPorSlugAp[c.slug_fixo] = c.titulo;

  // A ficha da máquina (seção 4 do laudo) só renderiza quando tem o que mostrar.
  // Mesmo predicado do PDF — se divergir, tela e PDF numeram seções diferentes.
  const temConclusaoAp = !!(
    apreciacao.conclusao_tecnica
    || apreciacao.recomendacoes
    || riscosHrn.length > 0
    || fichas.length > 0
  );

  // Só entra no Sumário/numeração quem vira seção numerada (mesmo predicado do PDF).
  const renderizaNumeradoAp = (c: (typeof capitulosAp)[number]): boolean => {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "apreciacao_checklist":  return true;
      case "apreciacao_risco":      return temConclusaoAp;
      case "apreciacao_plano":      return acoesComConteudo.length > 0;
      case "apreciacao_assinatura": return true;
      default:                      return false; // sumario, apreciacao_identificacao
    }
  };

  const blocosAp = [...capitulosAp]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const numPorSlugAp: Record<string, number> = {};
  const numPorIdAp: Record<string, number> = {};
  {
    let n = 0;
    for (const c of blocosAp) {
      if (!renderizaNumeradoAp(c)) continue;
      n += 1;
      if (c.tipo === "fixo" && c.slug_fixo) numPorSlugAp[c.slug_fixo] = n;
      numPorIdAp[c.id_capitulo] = n;
    }
  }
  const numLabelAp = (num: number | undefined, txt: string) => (num ? `${num}. ${txt}` : txt);

  const temAssinaturaFixoAp = capitulosAp.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "apreciacao_assinatura" && c.ativo !== false,
  );

  const assinaturaScreenNode = (
    <div className="print:break-inside-avoid">
      <AssinaturaRelatorio
        nomeResponsavel={apreciacao.responsavel ?? undefined}
        dataRelatorio={formatarDataBR(apreciacao.data_apreciacao) || undefined}
        tabelaNome="apreciacoes_maquinas"
        docId={id}
        hideAcoes
        numero={numPorSlugAp["apreciacao_assinatura"]}
      />
    </div>
  );

  // Seções do sistema (reusadas nos dois modos de render).
  const checklistScreenNode = (
    <section className="space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
        {numLabelAp(numPorSlugAp["apreciacao_checklist"], tituloPorSlugAp["apreciacao_checklist"] ?? "Checklist NR-12")}
      </h2>
      {itensPorCategoria.map((grupo) => (
        <div key={grupo.categoria} className="space-y-2 print:break-inside-avoid">
          <h3 className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-700 print:bg-transparent print:border-b print:border-orange-300 print:rounded-none print:text-orange-900">
            {grupo.label} <span className="text-orange-500/70">({grupo.itens.length})</span>
          </h3>
          <div className="space-y-2">
            {grupo.itens.map((it) => (
              <ItemApreciacaoCard key={it.id_item} item={it} disabled={true} compacto />
            ))}
          </div>
        </div>
      ))}
    </section>
  );

  /** Célula de risco: fatores por extenso + "índice · CLASSIFICAÇÃO". */
  const celulaRisco = (
    pod: string | null,
    fep: string | null,
    gpd: string | null,
    classificacao: string | null,
  ) => {
    const fatores = [
      pod ? POD_HRN_LABELS[pod as PodHrn] : null,
      fep ? FEP_HRN_LABELS[fep as FepHrn] : null,
      gpd ? GPD_HRN_LABELS[gpd as GpdHrn] : null,
    ].filter(Boolean).join(" · ");
    const indice = calcularIndiceHrn(pod, fep, gpd);
    const nome = classificacao
      ? CLASSIFICACAO_HRN_LABELS[classificacao as ClassificacaoRiscoHrn]
      : null;
    const resumo = [indice !== null ? String(indice) : null, nome ? nome.toUpperCase() : null]
      .filter(Boolean).join(" · ");
    if (!fatores && !resumo) return <span className="text-gray-400">—</span>;
    return (
      <>
        {fatores}
        {fatores && resumo ? <br /> : null}
        {resumo ? <span className="font-mono font-bold">{resumo}</span> : null}
      </>
    );
  };

  // Riscos agrupados por máquina — uma consulta só, agrupada aqui.
  const riscosPorFicha = new Map<string, typeof riscosHrn>();
  for (const r of riscosHrn) {
    const k = r.id_ficha ?? "";
    if (!riscosPorFicha.has(k)) riscosPorFicha.set(k, []);
    riscosPorFicha.get(k)!.push(r);
  }
  const { grupos: gruposFichas, seqDe } = agruparFichasPorSetor(fichas);

  // Ficha da máquina — mesmo conteúdo e mesma ordem do PDF (seção 4 do laudo).
  const conclusaoScreenNode = temConclusaoAp ? (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:rounded-none print:border-gray-300 print:p-0 print:shadow-none">
      <h2 className="mb-2 border-b-2 border-orange-600 pb-1 text-sm font-bold uppercase tracking-wider text-orange-800">
        {numLabelAp(numPorSlugAp["apreciacao_risco"], tituloPorSlugAp["apreciacao_risco"] ?? "Apreciação de Risco")}
      </h2>

      {gruposFichas.length === 0 && (
        <p className="mb-3 text-xs italic text-gray-500">
          Nenhuma máquina cadastrada neste laudo.
        </p>
      )}

      {gruposFichas.map((grupo) => (
        <div key={grupo.setor} className="mb-4">
          <p className="mb-2 border-b border-orange-200 pb-0.5 text-[11px] font-bold uppercase tracking-wider text-orange-700">
            Setor: {grupo.setor} ({grupo.fichas.length})
          </p>

          {grupo.fichas.map((f) => {
            const riscos = riscosPorFicha.get(f.id_ficha) ?? [];
            const operadores = (f.operadores ?? [])
              .map((o) => [o.nome, o.cargo].filter(Boolean).join(" — "))
              .filter(Boolean)
              .join("; ");
            const campos: [string, string | null][] = [
              ["Tipo", f.tipo],
              ["Fabricante", f.fabricante],
              ["Modelo", f.modelo],
              ["Nº de Série", f.serie],
              ["Ano", f.ano],
              ["Capacidade", f.capacidade],
              ["Setor", f.setor],
            ];

            return (
              <div key={f.id_ficha} className="mb-4 break-inside-avoid">
                <p className="mb-1 text-sm font-bold text-gray-900">
                  {seqDe(f)}. {f.maquina_descricao || f.equipamento || "Máquina"}
                </p>

                <div className="mb-2 grid grid-cols-2 border-l border-t border-gray-200 sm:grid-cols-4 lg:grid-cols-7 print:grid-cols-7">
                  {campos.map(([k, v]) => (
                    <div key={k} className="min-w-0 border-b border-r border-gray-200 px-2 py-1">
                      <span className="block text-[9px] font-bold uppercase tracking-wide text-gray-500">{k}</span>
                      <span className="block break-words text-xs text-gray-900 print:text-[9pt]">
                        {v && v.trim() ? v : "—"}
                      </span>
                    </div>
                  ))}
                </div>

                {f.foto_urls.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {f.foto_urls.slice(0, 3).map((url, i) => (
                      <StorageImg
                        key={`${url}-${i}`}
                        stored={url}
                        alt={`Foto de ${f.maquina_descricao ?? "máquina"}`}
                        className="h-28 w-40 rounded border border-gray-300 object-cover"
                      />
                    ))}
                  </div>
                )}

                {operadores && (
                  <p className="mb-1 text-xs text-gray-900 print:text-[9.5pt]">
                    <span className="font-bold">Operadores / Responsáveis: </span>{operadores}
                  </p>
                )}

                {f.constatacoes_inspecao && (
                  <p className="mb-2 whitespace-pre-wrap text-xs text-gray-900 print:text-[9.5pt]">
                    <span className="font-bold">Constatações da inspeção: </span>
                    {f.constatacoes_inspecao}
                  </p>
                )}

                {riscos.length > 0 && (
                  <div className="mb-2 overflow-x-auto">
                    <table className="w-full table-fixed border-collapse text-[11px] print:text-[8.5pt]">
                      <thead>
                        <tr className="bg-orange-50 text-left text-[9px] uppercase tracking-wide text-orange-900 print:text-[7.5pt]">
                          <th className="w-[13%] border border-gray-300 px-1.5 py-1 font-bold">Perigo</th>
                          <th className="w-[21%] border border-gray-300 px-1.5 py-1 font-bold">Origem / Consequências</th>
                          <th className="w-[9%] border border-gray-300 px-1.5 py-1 font-bold">Item NR-12</th>
                          <th className="w-[14%] border border-gray-300 px-1.5 py-1 font-bold">Risco Inicial</th>
                          <th className="w-[29%] border border-gray-300 px-1.5 py-1 font-bold">Medidas de Controle</th>
                          <th className="w-[14%] border border-gray-300 px-1.5 py-1 font-bold">Risco Residual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riscos.map((r) => {
                          const origem = [r.origem, r.potenciais_consequencias].filter(Boolean).join(" → ");
                          const itens = (r.itens_nr12 ?? (r.item_nr12 ? [r.item_nr12] : [])).join("; ");
                          const temSeparadas = !!(r.medidas_engenharia || r.medidas_administrativas);
                          return (
                            <tr key={r.id_risco} className="align-top break-inside-avoid">
                              <td className="border border-gray-200 px-1.5 py-1 break-words">{r.tipo_perigo || "—"}</td>
                              <td className="border border-gray-200 px-1.5 py-1 break-words">{origem || "—"}</td>
                              <td className="border border-gray-200 px-1.5 py-1 break-words">{itens || "—"}</td>
                              <td className="border border-gray-200 px-1.5 py-1 break-words">
                                {celulaRisco(r.pod, r.fep, r.gpd, r.classificacao_risco)}
                              </td>
                              <td className="border border-gray-200 px-1.5 py-1 break-words">
                                {temSeparadas ? (
                                  <>
                                    {r.medidas_engenharia && (
                                      <>
                                        <span className="text-[9px] font-bold uppercase text-gray-600">Eng.:</span>{" "}
                                        {r.medidas_engenharia}
                                        {r.medidas_administrativas ? <br /> : null}
                                      </>
                                    )}
                                    {r.medidas_administrativas && (
                                      <>
                                        <span className="text-[9px] font-bold uppercase text-gray-600">Adm.:</span>{" "}
                                        {r.medidas_administrativas}
                                      </>
                                    )}
                                  </>
                                ) : (
                                  r.medidas_preventivas || "—"
                                )}
                                {r.categoria_seguranca && (
                                  <>
                                    <br />
                                    <span className="text-[9px] font-bold uppercase text-gray-600">Cat. segurança:</span>{" "}
                                    {r.categoria_seguranca}
                                  </>
                                )}
                              </td>
                              <td className="border border-gray-200 px-1.5 py-1 break-words">
                                {celulaRisco(r.pod_residual, r.fep_residual, r.gpd_residual, r.classificacao_residual)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {f.parecer_tecnico && (
                  <p className="whitespace-pre-wrap text-xs text-gray-900 print:text-[9.5pt]">
                    <span className="font-bold">Parecer técnico: </span>{f.parecer_tecnico}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {apreciacao.conclusao_tecnica && (
        <div className="mb-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Parecer técnico</p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-900 print:text-[9.5pt]">{apreciacao.conclusao_tecnica}</p>
        </div>
      )}
      {apreciacao.recomendacoes && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Recomendações finais</p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-900 print:text-[9.5pt]">{apreciacao.recomendacoes}</p>
        </div>
      )}
    </section>
  ) : null;

  const planoScreenNode = acoesComConteudo.length > 0 ? (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:rounded-none print:border-gray-300 print:p-0 print:shadow-none print:break-inside-avoid">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-700">
        {numLabelAp(numPorSlugAp["apreciacao_plano"], tituloPorSlugAp["apreciacao_plano"] ?? "Plano de Ação")}
      </h2>
      <PlanoAcaoTable idApreciacao={apreciacao.id_apreciacao} apreciacao={apreciacao} itens={itens} readOnly={true} />
    </section>
  ) : null;

  // Títulos do sumário — só capítulos que viram seção numerada (mesmo predicado do PDF).
  const sumarioTitulos = blocosAp
    .filter((c) => renderizaNumeradoAp(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresTextosPadrao),
    )
    .filter((t) => t && t.trim());

  const identificacaoEmpresaScreenNode = (
    <div className="mb-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
        {numLabelAp(numPorSlugAp["identificacao_empresa"], "Identificação da Empresa")}
      </h2>
      <EmpresaInfoPanel empresa={empresa ?? null} />
    </div>
  );

  const sumarioScreenNode = (
    <div className="mb-6 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
        Sumário
      </h2>
      <ol className="space-y-1">
        {sumarioTitulos.map((t, i) => (
          <li key={i} className="flex items-baseline gap-2 border-b border-dotted border-gray-300 py-0.5 text-xs text-gray-700">
            <span className="min-w-5 font-bold text-emerald-800">{i + 1}.</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );

  function renderSecaoApScreen(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return identificacaoEmpresaScreenNode;
      case "sumario":               return sumarioScreenNode;
      case "apreciacao_checklist":  return checklistScreenNode;
      case "apreciacao_risco":      return conclusaoScreenNode;
      case "apreciacao_plano":      return planoScreenNode;
      case "apreciacao_assinatura": return assinaturaScreenNode;
      default:                      return null; // apreciacao_identificacao (dados no cabeçalho)
    }
  }

  const temFixosAp = capitulosAp.some((c) => c.tipo === "fixo");
  const corpoScreen = temFixosAp ? (
    blocosAp.map((c) =>
      c.tipo === "fixo" ? (
        <div key={c.id_capitulo} data-slug={c.slug_fixo ?? undefined}>
          {renderSecaoApScreen(c.slug_fixo ?? "")}
        </div>
      ) : (
        <TextosPadraoPrint key={c.id_capitulo} modulo="apreciacao_maquinas" capituloId={c.id_capitulo} valores={valoresTextosPadrao} numero={numPorIdAp[c.id_capitulo]} />
      ),
    )
  ) : (
    <>
      <TextosPadraoPrint modulo="apreciacao_maquinas" valores={valoresTextosPadrao} posicao="inicio" />
      {checklistScreenNode}
      {conclusaoScreenNode}
      {planoScreenNode}
      <TextosPadraoPrint modulo="apreciacao_maquinas" valores={valoresTextosPadrao} posicao="fim" />
    </>
  );

  return (
    // Sem `force-light`: esta tela acompanha o tema do app. O branco fixo aqui
    // cansava a vista de quem passa o dia no laudo — e a ilha clara nao e
    // necessaria para a impressao, que ja sai clara porque o ThemeManager tira
    // o `.dark` no `beforeprint`. O PDF tambem nao depende dela: e montado no
    // servidor (/api/pdf/apreciacao/[id]), nao capturado desta tela.
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-3">
      {/* CSS de impressão */}
      <style>{`
        @media print {
          /* Antes: 3cm de margem esquerda + 12pt. Sobrava 16cm de área útil em
             A4 e a tabela de risco (6 colunas) não cabia. Alinhado às margens
             que o PDF do Puppeteer já usa. */
          @page { size: A4; margin: 18mm 15mm 18mm 18mm; }
          body { font-size: 10pt; line-height: 1.35; }
        }
      `}</style>

      {/* Toolbar — não imprime */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/apreciacao-maquinas/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Editar apreciação
        </Link>
      </div>

      {/* Botões PDF — sticky, não imprime */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
        {pdfAssinado ? (
          <>
            <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              <BadgeCheck className="size-3.5 shrink-0" />
              Assinado em {new Date(pdfAssinado.assinado_em).toLocaleDateString("pt-BR")}
            </div>
            <button type="button" onClick={handleBaixarPdf} disabled={baixando}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Baixar PDF Assinado
            </button>
            <BotaoAssinarPdf reAssinatura={true} defaultSignatoryName={apreciacao.responsavel ?? undefined} apiPdfUrl={`/api/pdf/apreciacao/${id}`} baseCongeladaUrl={baseCongeladaUrl} tabelaNome="apreciacoes_maquinas" docId={id} onAssinado={recarregar} />
          </>
        ) : (
          <BotaoAssinarPdf defaultSignatoryName={apreciacao.responsavel ?? undefined} apiPdfUrl={`/api/pdf/apreciacao/${id}`} baseCongeladaUrl={baseCongeladaUrl} tabelaNome="apreciacoes_maquinas" docId={id} onAssinado={recarregar} />
        )}
        <BotaoGerarPdf
          apiPdfUrl={`/api/pdf/apreciacao/${id}`}
          tabelaNome="apreciacoes_maquinas"
          docId={id}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          registrarPdf={{
            modulo: "apreciacao_maquinas",
            tipoDocumento: "Apreciação de Máquinas NR-12",
            idRelatorio: id,
            empresaId: apreciacao.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: apreciacao.responsavel ?? undefined,
          }}
        />
      </div>

      <div className="px-4 pt-3">
        <PainelCongelamentoPdf
          modulo="apreciacao_maquinas"
          idReferencia={id}
          apiPdfUrl={`/api/pdf/apreciacao/${id}`}
          opts={{
            tipoDocumento: "Apreciação de Máquinas NR-12",
            empresaId: apreciacao.id_empresa ?? undefined,
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: apreciacao.responsavel ?? undefined,
          }}
        />
      </div>

      <div className="px-4 pt-3 print:hidden">
        <EmpresaInfoPanel empresa={empresa ?? null} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" />
      </div>

      <div className="px-4 pt-3">
        <AnexosManager modulo="apreciacao_maquinas" idReferencia={id} />
      </div>

      {/* Logo JCN Consultoria */}
      <RelatorioPrintHeader
        titulo={`Apreciação NR-12 — ${maquinaNome}`}
        subtitulo={empresaNome}
        terciario={
          apreciacao.data_apreciacao
            ? new Date(apreciacao.data_apreciacao + "T00:00").toLocaleDateString("pt-BR")
            : null
        }
      />

      {/* Observações gerais (mesma posição do PDF: antes do corpo). */}
      {apreciacao.observacoes_gerais && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm print:rounded-none print:border-gray-300 print:p-0 print:shadow-none print:break-inside-avoid">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Observações Gerais</p>
          <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">{apreciacao.observacoes_gerais}</p>
        </section>
      )}

      {/* Corpo do laudo — ordem unificada (sistema + editáveis) ou layout legado.
          (Cabeçalho do topo removido — o laudo começa pela capa, como no NC.) */}
      {corpoScreen}

      {/* Assinatura — só no fim quando não há capítulo "apreciacao_assinatura" ativo. */}
      {!temAssinaturaFixoAp && assinaturaScreenNode}
    </div>
  );
}
