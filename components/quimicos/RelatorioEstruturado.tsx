"use client";

import type { AnaliseQuimico, Empresa } from "@/lib/supabase/types";

/**
 * Reconstroi a lista de componentes a partir dos campos singulares que
 * o backend guarda separados por "; ". Útil pra exibir como tabela.
 *
 * Ex: nome_quimico = "Tolueno; Acetona; Xileno"
 *     numero_cas   = "108-88-3; 67-64-1; 1330-20-7"
 *  → 3 componentes alinhados.
 */
function reconstruirComponentes(a: AnaliseQuimico) {
  const split = (s: string | null): string[] => {
    if (!s) return [];
    // Separa por "; " ou ";" — tolera ambos
    return s.split(/;\s*/).map((x) => x.trim()).filter(Boolean);
  };

  const nomes = split(a.nome_quimico);
  const cass = split(a.numero_cas);
  const formulas = split(a.formula_quimica);
  const concs = split(a.concentracao);

  const max = Math.max(nomes.length, cass.length, formulas.length, concs.length);
  if (max <= 1) return null; // só 1 (ou nenhum) componente — não vira tabela

  const linhas = [];
  for (let i = 0; i < max; i++) {
    linhas.push({
      nome: nomes[i] || null,
      cas: cass[i] || null,
      formula: formulas[i] || null,
      concentracao: concs[i] || null,
    });
  }
  return linhas;
}

/**
 * Relatório técnico estruturado da Análise de Químicos.
 *
 * Em vez de pedir pra IA gerar 12 seções de prosa (caro em tokens), a IA
 * devolve só o bloco CONCLUSAO_RAPIDA (campos estruturados). Este componente
 * monta o documento completo a partir desses campos + os dados de entrada
 * do usuário + dados da empresa.
 *
 * O resultado é:
 *  - Layout padronizado (sempre igual entre análises) → consistência para
 *    auditoria de PPP/LTCAT.
 *  - Tokens economizados: ~3.000 tokens por análise (output cai de 4k pra 1k).
 *  - Resposta da IA mais rápida (3-6s vs 8-15s).
 */
export default function RelatorioEstruturado({
  analise,
  empresa,
}: {
  analise: AnaliseQuimico;
  empresa: Empresa | null;
}) {
  const c = analise.conclusao_rapida ?? {};
  const componentes = reconstruirComponentes(analise);

  return (
    <article className="space-y-5">
      {/* 1. IDENTIFICAÇÃO */}
      <Secao titulo="1. Identificação do Agente Químico">
        <DataGrid
          items={[
            { label: "Empresa", value: empresa?.nome_empresa },
            { label: "CNPJ", value: empresa?.cnpj },
            { label: "Produto / Título da análise", value: analise.titulo },
            { label: "Forma física", value: analise.forma_fisica },
            // Quando há vários componentes, esses 4 campos são exibidos
            // na tabela abaixo (vinculados por linha). No DataGrid mostramos
            // só os singulares como fallback (1 componente).
            ...(componentes
              ? []
              : [
                  { label: "Nome químico", value: analise.nome_quimico },
                  { label: "Número CAS", value: analise.numero_cas },
                  { label: "Fórmula química", value: analise.formula_quimica },
                  { label: "Concentração", value: analise.concentracao },
                ]),
          ]}
        />

        {/* Tabela de componentes (mistura) — linhas vinculadas */}
        {componentes && (
          <div className="mt-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-600">
              Componentes da mistura ({componentes.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-verde-border bg-verde-primary px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-white">
                      #
                    </th>
                    <th className="border border-verde-border bg-verde-primary px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-white">
                      Nome Químico
                    </th>
                    <th className="border border-verde-border bg-verde-primary px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-white">
                      Número CAS
                    </th>
                    <th className="border border-verde-border bg-verde-primary px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-white">
                      Fórmula
                    </th>
                    <th className="border border-verde-border bg-verde-primary px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-white">
                      Concentração
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {componentes.map((row, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600">
                        {idx + 1}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-sm text-gray-900">
                        {row.nome ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 font-mono text-sm text-gray-900">
                        {row.cas ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-sm text-gray-900">
                        {row.formula ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-sm text-gray-900">
                        {row.concentracao ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Secao>

      {/* 2. CONDIÇÕES DE USO */}
      {analise.condicoes_uso && (
        <Secao titulo="2. Condições de Uso Informadas">
          <DataGrid
            items={[
              { label: "Atividade / Processo", value: analise.condicoes_uso.atividade },
              { label: "Frequência de exposição", value: analise.condicoes_uso.frequencia },
              { label: "Duração por turno", value: analise.condicoes_uso.duracao },
              { label: "Tipo de ventilação", value: analise.condicoes_uso.ventilacao },
              {
                label: "Geração de névoa/vapor",
                value: analise.condicoes_uso.geracao_nevoa_vapor,
              },
              {
                label: "EPIs já utilizados",
                value: analise.condicoes_uso.epis_utilizados,
              },
            ]}
          />
        </Secao>
      )}

      {/* 3. INSALUBRIDADE (NR-15) */}
      <Secao titulo="3. Análise de Insalubridade (NR-15)">
        <DataGrid
          items={[
            { label: "É insalubre?", value: c.insalubridade_nr15, destaque: true },
            { label: "Grau", value: c.insalubridade_grau, destaque: true },
            { label: "Anexo aplicável", value: c.insalubridade_anexo },
            { label: "Limite de exposição", value: c.limite_exposicao },
          ]}
        />
        <Fundamentacao texto={c.insalubridade_fundamentacao} />
      </Secao>

      {/* 4. PERICULOSIDADE (NR-16) */}
      <Secao titulo="4. Análise de Periculosidade (NR-16)">
        <DataGrid
          items={[
            {
              label: "Caracteriza periculosidade?",
              value: c.periculosidade_nr16,
              destaque: true,
            },
          ]}
        />
      </Secao>

      {/* 5. APOSENTADORIA ESPECIAL */}
      <Secao titulo="5. Aposentadoria Especial e Enquadramento Previdenciário">
        <DataGrid
          items={[
            {
              label: "Contempla aposentadoria especial?",
              value: c.aposentadoria_especial,
              destaque: true,
            },
            { label: "Tempo de exposição", value: c.aposentadoria_tempo },
            { label: "Decreto 3.048 (Anexo IV)", value: c.decreto_3048 },
            { label: "Código GFIP", value: c.codigo_gfip },
            { label: "eSocial Tab.24 (S-2240)", value: c.esocial_tab24 },
          ]}
        />
      </Secao>

      {/* 6. CARCINOGENICIDADE */}
      <Secao titulo="6. Carcinogenicidade">
        <DataGrid
          items={[
            {
              label: "Classificado como carcinogênico?",
              value: c.carcinogenico,
              destaque: true,
            },
          ]}
        />
      </Secao>

      {/* 7. ÓLEO MINERAL (se aplicável) */}
      {c.oleo_mineral && c.oleo_mineral.toUpperCase() !== "N/A" && (
        <Secao titulo="7. Óleo Mineral — Classificação">
          <Bloco texto={c.oleo_mineral} />
        </Secao>
      )}

      {/* 8. CONTROLES — EPI / EPC / MEDIDAS */}
      <Secao titulo="8. Medidas de Controle Indicadas">
        <CardLista titulo="EPIs Necessários" texto={c.epi_necessarios} cor="sky" />
        <CardLista titulo="EPCs Necessários" texto={c.epc_necessarios} cor="sky" />
        <CardLista
          titulo="Medidas de Controle (administrativas e de engenharia)"
          texto={c.medidas_controle}
          cor="emerald"
        />
      </Secao>

      {/* 9. EMERGÊNCIA */}
      <Secao titulo="9. Procedimentos de Emergência e Primeiros Socorros">
        <Bloco texto={c.emergencia_acidente} destacar />
      </Secao>

      {/* 10. AVALIAÇÃO QUANTITATIVA / MEDIÇÃO */}
      <Secao titulo="10. Avaliação Quantitativa / Medição Ambiental">
        <DataGrid
          items={[
            {
              label: "Necessita medição?",
              value: c.medicao_necessaria,
              destaque: true,
            },
            { label: "Metodologia", value: c.metodologia },
          ]}
        />
        <CardLista titulo="Procedimento de medição" texto={c.como_medir} cor="violet" />
      </Secao>

      {/* 11. RESUMO TÉCNICO */}
      <Secao titulo="11. Resumo Técnico para PPP/LTCAT">
        <Bloco texto={c.resumo_tecnico} destacar />
      </Secao>

      {/* 12. QUADRO DECISÓRIO */}
      <Secao titulo="12. Quadro Decisório (Resumo Geral)">
        <QuadroDecisorio c={c} />
      </Secao>
    </article>
  );
}

// =====================================================
// Subcomponentes
// =====================================================

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-2 border-b-2 border-verde-primary pb-1 text-base font-bold text-verde-primary">
        {titulo}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

interface DataItem {
  label: string;
  value?: string | null;
  destaque?: boolean;
}

function DataGrid({ items }: { items: DataItem[] }) {
  const visiveis = items.filter((i) => i.value && i.value.trim().length > 0);
  if (visiveis.length === 0) return null;

  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {visiveis.map((item, idx) => (
          <tr
            key={idx}
            className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
          >
            <td className="border border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600 align-top w-[40%]">
              {item.label}
            </td>
            <td
              className={`border border-gray-200 px-3 py-1.5 align-top ${
                item.destaque ? "font-semibold" : ""
              }`}
            >
              {formatValor(item.value, item.destaque)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Converte tokens-sentinela da IA em texto legível pro usuário final.
 * Mantém o mesmo significado mas tira o visual de placeholder técnico.
 */
function humanize(value: string): string {
  return value
    .replace(/CONSULTAR_TABELA_OFICIAL/gi, "Consultar tabela oficial")
    .replace(/CONSULTAR_DECRETO_VIGENTE/gi, "Consultar decreto vigente")
    .replace(/CONSULTAR_TABELA_GFIP/gi, "Consultar tabela GFIP")
    .replace(/\bINCONCLUSIVO\b/g, "Inconclusivo");
}

function formatValor(value: string | null | undefined, destaque?: boolean) {
  if (!value) return <span className="text-gray-400">—</span>;
  const v = humanize(value.trim());
  if (!destaque) {
    return <span className="break-words text-gray-900">{v}</span>;
  }

  const upper = v.toUpperCase();
  let cor = "text-gray-900";
  if (upper.startsWith("SIM")) cor = "text-emerald-700";
  else if (upper.startsWith("NÃO") || upper.startsWith("NAO")) cor = "text-red-700";
  else if (
    upper.includes("INCONCLUSIVO") ||
    upper.includes("CONSULTAR")
  )
    cor = "text-amber-700";

  return <span className={`break-words ${cor}`}>{v}</span>;
}

function Fundamentacao({ texto }: { texto?: string }) {
  if (!texto || !texto.trim()) return null;
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
        Fundamentação
      </p>
      <p className="mt-1 leading-relaxed break-words">{humanize(texto)}</p>
    </div>
  );
}

function Bloco({ texto, destacar }: { texto?: string; destacar?: boolean }) {
  if (!texto || !texto.trim()) {
    return (
      <p className="text-sm italic text-gray-400">Não informado pela análise.</p>
    );
  }
  const conteudo = humanize(texto);
  if (destacar) {
    return (
      <div className="rounded-md border-l-4 border-verde-primary bg-verde-light/30 p-3 text-sm leading-relaxed text-gray-900 break-words">
        {conteudo}
      </div>
    );
  }
  return (
    <p className="text-sm leading-relaxed text-gray-900 whitespace-pre-wrap break-words">
      {conteudo}
    </p>
  );
}

function CardLista({
  titulo,
  texto,
  cor,
}: {
  titulo: string;
  texto?: string;
  cor: "sky" | "emerald" | "violet";
}) {
  if (!texto || !texto.trim() || texto.toUpperCase() === "N/A") {
    return null;
  }

  const cores = {
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
  };

  // Quebra por ; ou bullet pra virar lista, se houver
  const itens = texto
    .split(/[;•]\s*/)
    .map((s) => humanize(s.trim()))
    .filter((s) => s.length > 0);

  return (
    <div className={`rounded-md border p-3 text-sm ${cores[cor]}`}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-80">
        {titulo}
      </p>
      {itens.length > 1 ? (
        <ul className="ml-4 list-disc space-y-0.5 leading-relaxed break-words">
          {itens.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      ) : (
        <p className="leading-relaxed break-words">{humanize(texto)}</p>
      )}
    </div>
  );
}

function QuadroDecisorio({ c }: { c: NonNullable<AnaliseQuimico["conclusao_rapida"]> }) {
  const linhas = [
    { item: "Precisa de medição?", valor: c.medicao_necessaria },
    { item: "É insalubre (NR-15)?", valor: c.insalubridade_nr15 },
    { item: "Grau de insalubridade", valor: c.insalubridade_grau },
    { item: "Aposentadoria especial", valor: c.aposentadoria_especial },
    { item: "Tempo de exposição (aposentadoria)", valor: c.aposentadoria_tempo },
    { item: "Decreto 3.048 (Anexo IV)", valor: c.decreto_3048 },
    { item: "Código GFIP", valor: c.codigo_gfip },
    { item: "Código eSocial Tab.24", valor: c.esocial_tab24 },
    { item: "Carcinogenicidade", valor: c.carcinogenico },
    { item: "Periculosidade NR-16", valor: c.periculosidade_nr16 },
    { item: "Óleo mineral (se aplicável)", valor: c.oleo_mineral },
    { item: "Metodologia de medição", valor: c.metodologia },
  ].filter((l) => l.valor && l.valor.trim().length > 0);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="border border-verde-border bg-verde-primary px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-white">
            Item
          </th>
          <th className="border border-verde-border bg-verde-primary px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-white">
            Conclusão
          </th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
              {l.item}
            </td>
            <td className="border border-gray-200 px-3 py-1.5 text-sm text-gray-900">
              {formatValor(l.valor, true)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
