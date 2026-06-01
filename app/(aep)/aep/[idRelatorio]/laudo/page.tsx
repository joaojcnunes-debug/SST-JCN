"use client";

import { use, useMemo } from "react";
import { Printer, AlertTriangle } from "lucide-react";
import { useAepRelatorio, useAepTextoPadrao, CLASS_COLOR_AEP, riscoMaximoSetor } from "@/lib/hooks/useAep";
import AssinaturaRelatorio from "@/components/ui/AssinaturaRelatorio";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import { montarValoresAep } from "@/lib/textos-padrao/variaveis-aep";
import { substituirVariaveis, formatarDataBR } from "@/lib/textos-padrao/variaveis";
import type { AepSetor, AepChecklistFisica, AepChecklistCognitiva, AepChecklistOrganizacional } from "@/lib/supabase/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function RichBlock({ html }: { html: string }) {
  if (!html?.trim()) return null;
  return <div className="prose prose-sm max-w-none text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
}

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
  ["metas",                   "Metas agressivas"],
  ["pausas",                  "Falta de pausas"],
  ["jornada_extensiva",       "Jornada extensiva"],
  ["pressao_hierarquica",     "Pressão hierárquica"],
  ["sobrecarga_operacional",  "Sobrecarga operacional"],
  ["deficit_equipe",          "Déficit de equipe"],
  ["conflito_organizacional", "Conflito organizacional"],
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
            {[setor.unidade, setor.ghe, setor.cargo, setor.funcao].filter(Boolean).join(" · ")}
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
          {setor.descricao_atividade && (
            <tr>
              <td className="bg-gray-50 px-2 py-1 font-semibold align-top">Atividades</td>
              <td className="px-2 py-1" colSpan={3}>{setor.descricao_atividade}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Triagem */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        {/* Física */}
        <div className="rounded border border-blue-200">
          <div className="bg-blue-50 px-2 py-1 font-semibold text-blue-800 text-[10px] uppercase">Ergonomia Física</div>
          {CHECKLIST_FISICA_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_fisica[k]);
            return (
              <div key={k} className="flex items-center justify-between border-t border-gray-100 px-2 py-0.5">
                <span className="text-gray-600">{l}</span>
                <span className={r.cls}>{r.label}</span>
              </div>
            );
          })}
        </div>
        {/* Cognitiva */}
        <div className="rounded border border-purple-200">
          <div className="bg-purple-50 px-2 py-1 font-semibold text-purple-800 text-[10px] uppercase">Ergonomia Cognitiva</div>
          {CHECKLIST_COG_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_cognitiva[k]);
            return (
              <div key={k} className="flex items-center justify-between border-t border-gray-100 px-2 py-0.5">
                <span className="text-gray-600">{l}</span>
                <span className={r.cls}>{r.label}</span>
              </div>
            );
          })}
        </div>
        {/* Organizacional */}
        <div className="rounded border border-amber-200">
          <div className="bg-amber-50 px-2 py-1 font-semibold text-amber-800 text-[10px] uppercase">Ergonomia Organizacional</div>
          {CHECKLIST_ORG_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_organizacional[k]);
            return (
              <div key={k} className="flex items-center justify-between border-t border-gray-100 px-2 py-0.5">
                <span className="text-gray-600">{l}</span>
                <span className={r.cls}>{r.label}</span>
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

      {/* Parecer + Recomendações */}
      {(setor.parecer_tecnico || setor.recomendacoes) && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {setor.parecer_tecnico && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Parecer Técnico Preliminar</p>
              <p className="text-gray-600 leading-relaxed">{setor.parecer_tecnico}</p>
            </div>
          )}
          {setor.recomendacoes && (
            <div>
              <p className="font-semibold text-gray-700 mb-1">Recomendações</p>
              <p className="text-gray-600 leading-relaxed">{setor.recomendacoes}</p>
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
  const { data: capitulos = [] } = useAepTextoPadrao();

  const empresa = rel?.empresas as { nome_empresa?: string; cnpj?: string | null } | null;
  const setoresComAet = rel?.setores.filter((s) => s.necessita_aet) ?? [];
  const totalRiscos = rel?.setores.reduce((a, s) => a + s.riscos.length, 0) ?? 0;

  const valoresVars = useMemo(
    () => (rel ? montarValoresAep(rel) : {}),
    [rel]
  );

  const capitulosOrdenados = [...capitulos].sort((a, b) => (a.ordem_global ?? 0) - (b.ordem_global ?? 0));
  const capitulosAntes = capitulosOrdenados.filter((c) => c.mostrar && c.tipo === "editavel" && (c.ordem_global ?? 0) < 2000);
  const capitulosDepois = capitulosOrdenados.filter((c) => c.mostrar && c.tipo === "editavel" && (c.ordem_global ?? 0) >= 2000);

  if (!rel) return null;

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
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Laudo AEP</h1>
          <p className="text-sm text-gray-500">{empresa?.nome_empresa}</p>
        </div>
        <BotaoGerarPdf
          tabelaNome="aep_relatorios"
          docId={idRelatorio}
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

      {/* Laudo */}
      <div className="mx-auto max-w-4xl bg-white px-8 py-10 shadow-sm print:shadow-none print:p-0 print:max-w-none">

        {/* Capa */}
        <div className="mb-10 border-b-4 border-emerald-700 pb-6 text-center print:mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Análise Ergonômica Preliminar</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{empresa?.nome_empresa}</h1>
          {empresa?.cnpj && <p className="mt-1 text-xs text-gray-500">CNPJ: {empresa.cnpj}</p>}
          <div className="mt-4 flex justify-center gap-6 text-xs text-gray-600">
            <span>Setores: <strong>{rel.setores.length}</strong></span>
            <span>Riscos identificados: <strong>{totalRiscos}</strong></span>
            {setoresComAet.length > 0 && (
              <span className="text-orange-600 font-semibold">
                <AlertTriangle className="inline size-3 mr-1" />
                {setoresComAet.length} setor(es) requer(em) AET
              </span>
            )}
          </div>
          {rel.data_elaboracao && (
            <p className="mt-2 text-xs text-gray-500">
              Data: {new Date(rel.data_elaboracao).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        {/* Capítulos editáveis antes das seções fixas */}
        {capitulosAntes.map((cap) => (
          <Section key={cap.id_capitulo} titulo={cap.titulo}>
            {cap.conteudo && <RichBlock html={substituirVariaveis(cap.conteudo, valoresVars)} />}
          </Section>
        ))}

        {/* Escalonamento AET — indicador global */}
        {setoresComAet.length > 0 && (
          <Section num="I" titulo="Indicadores de Necessidade de AET Completa">
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
          </Section>
        )}

        {/* Setores */}
        <Section num="II" titulo="Triagem Ergonômica por Setor">
          {rel.setores.map((setor, idx) => (
            <SetorBlock key={setor.id} setor={setor} idx={idx} />
          ))}
        </Section>

        {/* Capítulos editáveis após as seções fixas */}
        {capitulosDepois.filter((c) => c.slug_fixo === null).map((cap) => (
          <Section key={cap.id_capitulo} titulo={cap.titulo}>
            {cap.conteudo && <RichBlock html={substituirVariaveis(cap.conteudo, valoresVars)} />}
          </Section>
        ))}

        {/* Considerações finais */}
        {rel.conclusao?.trim() && (
          <Section num="III" titulo="Considerações Finais e Encaminhamentos">
            <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-line">{rel.conclusao}</p>
          </Section>
        )}

        {/* Assinatura */}
        <AssinaturaRelatorio
          nomeResponsavel={rel.responsavel_elaboracao ?? undefined}
          cargoResponsavel={rel.titulo_profissional ?? undefined}
          dataRelatorio={formatarDataBR(rel.data_elaboracao) || undefined}
          tabelaNome="aep_relatorios"
          docId={idRelatorio}
        />
      </div>
    </>
  );
}
