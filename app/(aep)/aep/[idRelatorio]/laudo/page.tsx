"use client";

import { use, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Download, Loader2 } from "lucide-react";
import { useAepRelatorio, CLASS_COLOR_AEP, riscoMaximoSetor } from "@/lib/hooks/useAep";
import TextosPadraoPrint from "@/components/textos-padrao/TextosPadraoPrint";
import HtmlConteudoAssinado from "@/components/ui/HtmlConteudoAssinado";
import { useTextosPadrao } from "@/lib/hooks/useTextosPadrao";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import AnexosManager from "@/components/anexos/AnexosManager";
import PainelCongelamentoPdf from "@/components/ui/PainelCongelamentoPdf";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { usePdfAssinado, usePdfCongelado } from "@/lib/hooks/usePdfsGerados";
import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";
import { montarValoresAep } from "@/lib/textos-padrao/variaveis-aep";
import { formatarDataBR, substituirVariaveis, substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import type { AepSetor, AepChecklistFisica, AepChecklistCognitiva, AepChecklistOrganizacional } from "@/lib/supabase/types";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ num, titulo, children }: { num?: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 print:mb-4">
      <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold uppercase tracking-wide text-emerald-800">
        {num ? `${num} – ` : ""}{titulo}
      </h2>
      {children}
    </div>
  );
}

const CHECKLIST_FISICA_LABELS: [keyof AepChecklistFisica, string][] = [
  ["postura",             "Posturas inadequadas"],
  ["repetitividade",      "Movimentos repetitivos"],
  ["levantamento_carga",  "Levantamento de cargas"],
  ["mobiliario",          "Mobiliário inadequado"],
  ["esforco_fisico",      "Esforço físico elevado"],
  ["iluminacao",          "Iluminação inadequada"],
  ["ruido",               "Ruído adverso"],
  ["vibracao",            "Vibração"],
  ["desconforto_termico", "Desconforto térmico"],
];

const CHECKLIST_COG_LABELS: [keyof AepChecklistCognitiva, string][] = [
  ["atencao_continua",    "Atenção contínua"],
  ["sobrecarga_mental",   "Sobrecarga mental"],
  ["pressao_psicologica", "Pressão psicológica"],
  ["excesso_informacoes", "Excesso de informações"],
  ["ritmo_mental",        "Ritmo mental acelerado"],
];

const CHECKLIST_ORG_LABELS: [keyof AepChecklistOrganizacional, string][] = [
  ["assedio",               "Assédio de qualquer natureza no trabalho"],
  ["falta_suporte",         "Falta de suporte / apoio no trabalho"],
  ["gestao_mudancas",       "Má gestão de mudanças organizacionais"],
  ["clareza_papel",         "Baixa clareza de papel / função"],
  ["recompensas",           "Baixas recompensas e reconhecimento"],
  ["baixo_controle",        "Baixo controle no trabalho / Falta de autonomia"],
  ["justica_organizacional","Baixa justiça organizacional"],
  ["eventos_traumaticos",   "Eventos violentos ou traumáticos"],
  ["subcarga",              "Baixa demanda no trabalho (Subcarga)"],
  ["sobrecarga",            "Excesso de demandas no trabalho (Sobrecarga)"],
  ["maus_relacionamentos",  "Maus relacionamentos no local de trabalho"],
  ["comunicacao_dificil",   "Trabalho em condições de difícil comunicação"],
  ["trabalho_remoto",       "Trabalho remoto e isolado"],
];

function labelResposta(v: string) {
  if (v === "sim") return { label: "Sim", cls: "text-red-600 font-bold" };
  if (v === "nao") return { label: "Não", cls: "text-green-700" };
  return { label: "N/A", cls: "text-gray-400" };
}

// ─── Bloco por setor ─────────────────────────────────────────────────────────

function SetorBlock({ setor, idx }: { setor: AepSetor; idx: number }) {
  const rMax = riscoMaximoSetor(setor);

  return (
    <div className="mb-8 print:mb-6 break-inside-avoid">
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-200">
        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">{idx + 1}</span>
        <div className="flex-1">
          <p className="font-bold text-emerald-900">{setor.nome_setor || "—"}</p>
          <p className="text-xs text-emerald-700">
            {[setor.unidade, setor.ghe].filter(Boolean).join(" · ")}
          </p>
        </div>
        {rMax && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CLASS_COLOR_AEP[rMax]}`}>{rMax}</span>
        )}
        {setor.necessita_aet && (
          <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
            <AlertTriangle className="size-3" /> AET necessária
          </span>
        )}
      </div>

      {/* Identificação */}
      <table className="mb-3 w-full text-xs border border-gray-200">
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="bg-gray-50 px-2 py-1 font-semibold w-1/4">Jornada</td>
            <td className="px-2 py-1">{setor.jornada || "—"}</td>
            <td className="bg-gray-50 px-2 py-1 font-semibold w-1/4">Qtd. Expostos</td>
            <td className="px-2 py-1">{setor.qtd_expostos || "—"}</td>
          </tr>
          {setor.metodo_coleta && (
            <tr className="border-b border-gray-100">
              <td className="bg-gray-50 px-2 py-1 font-semibold align-top w-1/4">Método de coleta (NR-1)</td>
              <td className="px-2 py-1" colSpan={3}>
                {setor.metodo_coleta.split(/,\s*/).filter(Boolean).map((m, i) => (
                  <div key={i}>{m}</div>
                ))}
              </td>
            </tr>
          )}
          {setor.trabalhadores_consultados && (
            <tr className="border-b border-gray-100">
              <td className="bg-gray-50 px-2 py-1 font-semibold align-top">Trabalhadores consultados</td>
              <td className="px-2 py-1" colSpan={3}>
                {setor.trabalhadores_consultados.split(/,\s*/).filter(Boolean).map((t, i) => (
                  <div key={i}>{t}</div>
                ))}
              </td>
            </tr>
          )}
          {setor.descricao_atividade && (
            <tr>
              <td className="bg-gray-50 px-2 py-1 font-semibold align-top">Atividades</td>
              <td className="px-2 py-1" colSpan={3}>{setor.descricao_atividade}</td>
            </tr>
          )}
          {setor.cargos?.length > 0 && (
            <tr>
              <td className="bg-gray-50 px-2 py-1 font-semibold align-top">Cargos do setor</td>
              <td className="px-2 py-1" colSpan={3}>
                {setor.cargos
                  .filter((c) => c.cargo?.trim())
                  .map((c) => (
                    <div key={c.id}>
                      {c.cargo}
                      {c.quantidade ? ` (${c.quantidade})` : ""}
                      {c.descricao ? ` — ${c.descricao}` : ""}
                    </div>
                  ))}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Triagem — uma ergonomia embaixo da outra */}
      <div className="mb-3 space-y-2 text-xs">
        {/* Física */}
        <div className="rounded border border-blue-200">
          <div className="bg-blue-50 px-2 py-1 font-semibold text-blue-800 text-[10px] uppercase">Ergonomia Física</div>
          {CHECKLIST_FISICA_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_fisica[k]);
            const obs = setor.observacoes_checklist?.[k];
            return (
              <div key={k} className="border-t border-gray-100 px-2 py-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{l}</span>
                  <span className={r.cls}>{r.label}</span>
                </div>
                {obs && <p className="mt-0.5 text-[10px] italic text-gray-500">Obs.: {obs}</p>}
              </div>
            );
          })}
        </div>
        {/* Cognitiva */}
        <div className="rounded border border-purple-200">
          <div className="bg-purple-50 px-2 py-1 font-semibold text-purple-800 text-[10px] uppercase">Ergonomia Cognitiva</div>
          {CHECKLIST_COG_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_cognitiva[k]);
            const obs = setor.observacoes_checklist?.[k];
            return (
              <div key={k} className="border-t border-gray-100 px-2 py-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{l}</span>
                  <span className={r.cls}>{r.label}</span>
                </div>
                {obs && <p className="mt-0.5 text-[10px] italic text-gray-500">Obs.: {obs}</p>}
              </div>
            );
          })}
        </div>
        {/* Organizacional */}
        <div className="rounded border border-amber-200">
          <div className="bg-amber-50 px-2 py-1 font-semibold text-amber-800 text-[10px] uppercase">Ergonomia Organizacional</div>
          {CHECKLIST_ORG_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_organizacional[k]);
            const obs = setor.observacoes_checklist?.[k];
            return (
              <div key={k} className="border-t border-gray-100 px-2 py-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{l}</span>
                  <span className={r.cls}>{r.label}</span>
                </div>
                {obs && <p className="mt-0.5 text-[10px] italic text-gray-500">Obs.: {obs}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Matriz de riscos */}
      {setor.riscos.length > 0 && (
        <table className="mb-3 w-full border border-gray-200 text-xs">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-2 py-1.5 font-semibold">Tipo</th>
              <th className="px-2 py-1.5 font-semibold">Agente / Risco</th>
              <th className="px-2 py-1.5 font-semibold">Classificação</th>
              <th className="px-2 py-1.5 font-semibold">Medida Preventiva</th>
            </tr>
          </thead>
          <tbody>
            {setor.riscos.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-2 py-1">{r.tipo}</td>
                <td className="px-2 py-1">{r.risco}</td>
                <td className={`px-2 py-1 font-semibold ${CLASS_COLOR_AEP[r.classificacao_risco]}`}>{r.classificacao_risco}</td>
                <td className="px-2 py-1 text-gray-600">{r.medida_preventiva || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Recomendações + Parecer — um embaixo do outro */}
      {(setor.parecer_tecnico || setor.recomendacoes) && (
        <div className="space-y-3 text-xs">
          {setor.recomendacoes && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Recomendações</p>
              <p className="text-gray-600 leading-relaxed">{setor.recomendacoes}</p>
            </div>
          )}
          {setor.parecer_tecnico && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Parecer Técnico Preliminar</p>
              <p className="text-gray-600 leading-relaxed">{setor.parecer_tecnico}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AepLaudoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel } = useAepRelatorio(idRelatorio);
  const { data: empresaFull } = useEmpresa((rel as { id_empresa?: string })?.id_empresa ?? null);
  const { data: capsAep = [] } = useTextosPadrao("aep");
  const { pdfAssinado, recarregar } = usePdfAssinado("aep_relatorios", idRelatorio);
  const { data: pdfCongelado } = usePdfCongelado("aep", idRelatorio);
  const baseCongeladaUrl = pdfCongelado?.pdf_url ?? undefined;
  const [baixando, setBaixando] = useState(false);

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    setBaixando(true);
    try {
      await baixarPdfAssinado(pdfAssinado.pdf_path, "relatorio-aep-assinado.pdf");
    } catch {
      toast.error("Erro ao baixar o PDF.");
    } finally {
      setBaixando(false);
    }
  }

  const empresa = rel?.empresas as { nome_empresa?: string; cnpj?: string | null } | null;
  const setoresComAet = rel?.setores.filter((s) => s.necessita_aet) ?? [];

  const valoresVars = useMemo(
    () => (rel ? montarValoresAep(rel) : {}),
    [rel]
  );

  // Blocos ordenados (mesma regra do corpo) + numeração espelhada do PDF.
  // Só entra no Sumário/numeração quem vira seção numerada. NÃO há capítulo de
  // assinatura no AEP — a assinatura é hardcoded no fim, sem número.
  const temConclusao = !!rel?.conclusao?.trim();
  const tituloPorSlug = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of capsAep) if (c.slug_fixo) m[c.slug_fixo] = c.titulo;
    return m;
  }, [capsAep]);

  const renderizaNumerado = useMemo(
    () =>
      (c: (typeof capsAep)[number]): boolean => {
        if (c.ativo === false) return false;
        const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
        if (ehCapa) return false;
        if (c.tipo !== "fixo") return true;
        switch (c.slug_fixo) {
          case "identificacao_empresa": return true;
          case "aep_escalonamento":     return true;
          case "aep_triagem":           return true;
          case "aep_consideracoes":     return temConclusao;
          case "aep_assinatura":        return true;
          default:                      return false; // sumario
        }
      },
    [temConclusao],
  );

  const { numPorSlug, numPorId, sumarioTitulos } = useMemo(() => {
    const blocos = [...capsAep]
      .filter((c) => c.ativo !== false)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const numPorSlug: Record<string, number> = {};
    const numPorId: Record<string, number> = {};
    let n = 0;
    for (const c of blocos) {
      if (!renderizaNumerado(c)) continue;
      n += 1;
      if (c.tipo === "fixo" && c.slug_fixo) numPorSlug[c.slug_fixo] = n;
      numPorId[c.id_capitulo] = n;
    }
    const sumarioTitulos = blocos
      .filter((c) => renderizaNumerado(c))
      .map((c) => (c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresVars)))
      .filter((t) => t && t.trim());
    return { numPorSlug, numPorId, sumarioTitulos };
  }, [capsAep, valoresVars, renderizaNumerado]);

  const numLabel = (num: number | undefined, txt: string) => (num ? `${num}. ${txt}` : txt);

  if (!rel) return null;

  const temAssinaturaFixo = capsAep.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "aep_assinatura" && c.ativo !== false,
  );

  // Assinatura: quando há capítulo "aep_assinatura", renderiza na posição dele
  // (numerada); senão, cai no fim como fallback, sem número.
  const assinaturaScreenNode = (
    <AssinaturaRelatorio
      nomeResponsavel={rel.responsavel_elaboracao ?? undefined}
      cargoResponsavel={rel.titulo_profissional ?? undefined}
      dataRelatorio={formatarDataBR(rel.data_elaboracao) || undefined}
      tabelaNome="aep_relatorios"
      docId={idRelatorio}
      hideAcoes
      seloSoQuandoAssinado
      numero={numPorSlug["aep_assinatura"]}
    />
  );

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 2.5cm 2cm 2.5cm 3cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Toolbar — não imprime */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Laudo AEP</h1>
          <p className="text-sm text-gray-500">{empresa?.nome_empresa}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pdfAssinado ? (
            <>
              <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <BadgeCheck className="size-3.5 shrink-0" />
                Assinado em {new Date(pdfAssinado.assinado_em).toLocaleDateString("pt-BR")}
              </div>
              <button
                type="button"
                onClick={handleBaixarPdf}
                disabled={baixando}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Baixar PDF Assinado
              </button>
              <BotaoAssinarPdf
                reAssinatura={true}
                defaultSignatoryName={rel?.responsavel_elaboracao ?? undefined}
                tabelaNome="aep_relatorios"
                docId={idRelatorio}
                onAssinado={recarregar}
                apiPdfUrl={`/api/pdf/aep/${idRelatorio}`}
                baseCongeladaUrl={baseCongeladaUrl}
              />
            </>
          ) : (
            <BotaoAssinarPdf
              defaultSignatoryName={rel?.responsavel_elaboracao ?? undefined}
              tabelaNome="aep_relatorios"
              docId={idRelatorio}
              onAssinado={recarregar}
              apiPdfUrl={`/api/pdf/aep/${idRelatorio}`}
              baseCongeladaUrl={baseCongeladaUrl}
            />
          )}
          <BotaoGerarPdf
            tabelaNome="aep_relatorios"
            docId={idRelatorio}
            apiPdfUrl={`/api/pdf/aep/${idRelatorio}`}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
            registrarPdf={{
              modulo: "aep",
              tipoDocumento: "Análise Ergonômica Preliminar",
              idRelatorio,
              empresaNome: empresa?.nome_empresa ?? undefined,
              empresaCnpj: empresa?.cnpj ?? undefined,
              responsavelTecnico: rel.responsavel_elaboracao ?? undefined,
            }}
          />
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-8 pt-4 print:hidden">
        <PainelCongelamentoPdf
          modulo="aep"
          idReferencia={idRelatorio}
          apiPdfUrl={`/api/pdf/aep/${idRelatorio}`}
          opts={{
            tipoDocumento: "Análise Ergonômica Preliminar",
            empresaNome: empresa?.nome_empresa ?? undefined,
            empresaCnpj: empresa?.cnpj ?? undefined,
            responsavelTecnico: rel.responsavel_elaboracao ?? undefined,
          }}
        />
      </div>

      <div className="mx-auto max-w-4xl px-8 pt-4 print:hidden">
        <EmpresaInfoPanel empresa={empresaFull ?? null} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" />
      </div>

      <div className="mx-auto max-w-4xl px-8 pt-4 print:hidden">
        <AnexosManager modulo="aep" idReferencia={idRelatorio} />
      </div>

      {/* Laudo */}
      <div data-pdf-content className="mx-auto max-w-4xl bg-white px-8 py-10 shadow-sm print:shadow-none print:p-0 print:max-w-none">

        {/* Corpo do laudo — blocos na ordem definida em Texto Padrão (textos
            editáveis + seções do sistema). Mesma ordem do PDF gerado.
            (Cabeçalho do topo removido — o laudo começa pela capa.) */}
        {[...capsAep]
          .filter((c) => c.ativo !== false)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map((c) => {
            if (c.tipo === "fixo") {
              if (c.slug_fixo === "identificacao_empresa") {
                return (
                  <div key={c.id_capitulo} className="mb-6 break-inside-avoid">
                    <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
                      {numLabel(numPorSlug["identificacao_empresa"], "Identificação da Empresa")}
                    </h2>
                    <EmpresaInfoPanel empresa={empresaFull ?? null} />
                  </div>
                );
              }
              if (c.slug_fixo === "sumario") {
                return (
                  <div key={c.id_capitulo} className="mb-6 break-inside-avoid">
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
              }
              if (c.slug_fixo === "aep_escalonamento") {
                return (
                  <Section key={c.id_capitulo} titulo={numLabel(numPorSlug["aep_escalonamento"], tituloPorSlug["aep_escalonamento"] ?? "Indicadores de Necessidade de AET Completa")}>
                    {setoresComAet.length > 0 ? (
                      <>
                        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 mb-3">
                          <p className="text-sm font-semibold text-orange-800 mb-2">
                            <AlertTriangle className="inline size-4 mr-1" />
                            Os setores abaixo apresentaram riscos que justificam elaboração de AET completa (NR-17):
                          </p>
                          <ul className="list-disc list-inside text-xs text-orange-700 space-y-1">
                            {setoresComAet.map((s) => (
                              <li key={s.id}>
                                <strong>{s.nome_setor}</strong>
                                {s.cargo && ` — ${s.cargo}`}
                                {" — "}Risco máximo: <span className="font-semibold">{riscoMaximoSetor(s)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Conforme NR-17 e NR-01 (GRO/PGR), a presença de riscos classificados como Alto ou Crítico, ou a convergência de múltiplos riscos Moderados, indica a necessidade de aprofundamento por meio da Análise Ergonômica do Trabalho completa, com avaliação postural (OWAS), análise biomecânica, medições ambientais e elaboração de laudo técnico detalhado.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Nenhum setor analisado apresentou riscos que justifiquem a elaboração de AET completa (NR-17) nesta avaliação.
                      </p>
                    )}
                  </Section>
                );
              }
              if (c.slug_fixo === "aep_triagem") {
                return (
                  <Section key={c.id_capitulo} titulo={numLabel(numPorSlug["aep_triagem"], tituloPorSlug["aep_triagem"] ?? "Triagem Ergonômica por Setor")}>
                    {rel.setores.map((setor, idx) => (
                      <SetorBlock key={setor.id} setor={setor} idx={idx} />
                    ))}
                  </Section>
                );
              }
              if (c.slug_fixo === "aep_consideracoes") {
                return rel.conclusao?.trim() ? (
                  <Section key={c.id_capitulo} titulo={numLabel(numPorSlug["aep_consideracoes"], tituloPorSlug["aep_consideracoes"] ?? "Considerações Finais e Encaminhamentos")}>
                    <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-line">{rel.conclusao}</p>
                  </Section>
                ) : null;
              }
              if (c.slug_fixo === "aep_assinatura") {
                return <div key={c.id_capitulo}>{assinaturaScreenNode}</div>;
              }
              return null;
            }
            // Texto editável — visível na tela e no print (o TextosPadraoPrint
            // fica oculto na tela por CSS, então renderizamos inline aqui).
            if (c.bg_imagem_url) {
              return (
                <TextosPadraoPrint
                  key={c.id_capitulo}
                  modulo="aep"
                  capituloId={c.id_capitulo}
                  valores={valoresVars}
                />
              );
            }
            return (
              <div key={c.id_capitulo} className="mb-6 break-inside-avoid">
                <h2 className="mb-2 border-b-2 border-emerald-700 pb-1 text-sm font-bold text-emerald-900">
                  {numLabel(numPorId[c.id_capitulo], substituirVariaveisTexto(c.titulo, valoresVars))}
                </h2>
                <HtmlConteudoAssinado
                  className="prose prose-sm max-w-none text-xs leading-relaxed text-gray-700 [&_p]:mb-2 [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1"
                  html={substituirVariaveis(c.conteudo, valoresVars)}
                />
              </div>
            );
          })}

        {/* Assinatura — só no fim quando não há capítulo "aep_assinatura" ativo. */}
        {!temAssinaturaFixo && assinaturaScreenNode}
      </div>
    </>
  );
}
