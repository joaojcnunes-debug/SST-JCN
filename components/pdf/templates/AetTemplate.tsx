/**
 * Template server-side do Laudo AET (NR-17) para geração via Puppeteer.
 * FRAME (passos 1-2): capa, identificação, sumário, capítulos editáveis,
 * considerações e assinatura — com numeração e quebra de página corretas.
 * Os blocos de setor (Agentes Ambientais / Análise Ergonômica / Psicossocial)
 * estão como PLACEHOLDER e serão portados nos passos 3-4.
 *
 * Restrições: sem "use client", sem hooks; apenas inline styles + um <style>.
 */

import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import { classeQuebraFixoNova, numerarCapitulos, numLabel } from "@/components/pdf/templates/shared";
import { algumaVisivel, perguntaOculta } from "@/lib/aet/checklist";
import {
  apenasSetoresExistentes,
  consolidarPiorCaso,
  mediaFatorDeLinhas,
  recalcularDasRespostas,
  zonaFromMedia,
} from "@/lib/aet/consolidar-psi";
import { ROTULO_ACOES_GERAIS, agruparAcoesPorSetor } from "@/lib/aet/acoes";
import { formatarPrazoAcao } from "@/lib/acoes/prazo";
import { htmlVazio, textoParaHtml } from "@/lib/texto-rico";
import type { AetAcao, Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveis, substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";

interface AetRiscoLike {
  id: string;
  tipo?: string | null;
  risco?: string | null;
  intensidade_concentracao?: string | null;
  tecnica_metodologia?: string | null;
  epi_ca?: string | null;
  epi_eficaz?: string | null;
  classificacao_risco?: string | null;
}
interface AetCargoLike { nome?: string | null; descricao?: string | null }

/** Aceita o formato ANTIGO de `cargos`: texto com um cargo por linha, de antes
 *  de virar lista de objetos. Sem isto, `cargos.map` estourava e a rota do PDF
 *  devolvia 500 — o laudo simplesmente não gerava. Espelha `normalizarCargos`
 *  de lib/hooks/useAet.ts, que é "use client" e não pode ser importado aqui. */
function normalizarCargos(raw: unknown): AetCargoLike[] {
  if (Array.isArray(raw)) return raw as AetCargoLike[];
  if (typeof raw === "string" && raw.trim())
    return raw.split("\n").map((n) => n.trim()).filter(Boolean).map((nome) => ({ nome, descricao: "" }));
  return [];
}
export interface AetSetorLike {
  id: string;
  nome_setor?: string | null;
  maquinas_equipamentos?: string | null;
  descricao_atividade?: string | null;
  cargos?: AetCargoLike[];
  riscos?: AetRiscoLike[];
  owas?: Record<string, number[]> | null;
  checklist?: Record<string, string> | null;
  respostas_extras?: Record<string, string> | null;
  /** Registros fotográficos do setor (máx. 6 na tela). Já existiam no editor e
   *  na prévia do laudo desde sempre — 38 fotos só no laudo da NOVAPARECIDA —
   *  mas o template do PDF nunca conheceu o campo e as descartava em silêncio. */
  fotos?: string[] | null;
  parecer_tecnico?: string | null;
  recomendacoes?: string | null;
  /** Terceiro texto de análise do setor. Existia no editor e na prévia desde
   *  sempre, mas o template do PDF nunca o conheceu — 24 dos 26 setores da base
   *  tinham conteúdo aqui e ele era descartado em silêncio. */
  demais_condicoes?: string | null;
}

interface AetOwasOpcao { value: number; label: string }
/** Config de OWAS já com a imagem resolvida (absoluta/assinada) pela rota. */
export interface AetOwasCfg { id: string; slug: string; titulo: string; opcoes: AetOwasOpcao[]; imagem: string | null }

const SLUG_TO_OWAS_FIELD: Record<string, string> = {
  costas: "posturas_costas",
  bracos: "posturas_bracos",
  pernas: "posturas_pernas",
  esforco: "esforco",
};

export interface AetChecklistPerguntaLike { slug: string; secao?: string | null; label: string; oculta?: boolean | null }

// Labels padrão do checklist (fallback quando não há custom no banco). Espelha
// CHECKLIST_PERGUNTAS_PADRAO de useAet.ts (que é "use client").
const CHECKLIST_PADRAO: AetChecklistPerguntaLike[] = [
  { slug: "levantamento_acima_limite", secao: "Postura", label: "Há registros de levantamento, transporte e descarga de materiais nesta atividade acima do limite recomendado?" },
  // Estava FALTANDO aqui: `pergunta()` cai no slug quando nao acha o rotulo, e
  // "trabalho_predominante" saia CRU no laudo, 1x por setor (17x no da
  // NOVAPARECIDA). O rotulo e o mesmo de OWAS_SELECTS_PADRAO (useAet.ts) — este
  // campo e um select do OWAS, nao uma pergunta do checklist, e por isso passou
  // batido. E ele que a pergunta seguinte chama de "a resposta anterior".
  { slug: "trabalho_predominante", secao: "Postura", label: "O trabalho executado durante aos chamados decorrentes do dia-dia, são realizados preponderantemente de qual forma?" },
  { slug: "pausas_descanso", secao: "Postura", label: 'Caso a resposta anterior seja "em pé" a empresa oferece pausas para descanso ou disponibiliza cadeiras do tipo semi-sentado?' },
  { slug: "uso_cadeira", secao: "Postura", label: "Para execução das atividades do dia-dia é disponibilizado o uso de cadeira?" },
  { slug: "cadeira_adequada", secao: "Postura", label: "A cadeira é estofada e revestida, possui base giratória, assento com altura ajustável, ajustes de altura e inclinação, bordas arredondadas e formato anatômico?" },
  { slug: "monitor", secao: "Postura", label: "A atividade necessita uso de monitor fixo sobre a mesa; caso positivo, este apresenta regulagens de altura e inclinação?" },
  { slug: "organizacao_trabalho", secao: "Organização do Trabalho", label: "As normas de produção (equipamentos, modo operatório, segurança e qualidade) devem estar descritas nas instruções internas de trabalho, elaboradas pela empresa." },
  { slug: "exigencia_levantamento", secao: "Exigência de Tempo", label: "Há registros de levantamento, transporte e descarga de materiais nesta atividade acima do limite recomendado?" },
  { slug: "ritmo_por_demanda", secao: "Ritmo de Trabalho", label: "O ritmo de trabalho é determinado pela demanda de trabalho?" },
  { slug: "pausas_formais", secao: "Adoção de Rodízios - Ergonômico", label: "Há pausas formais durante o ciclo de trabalho?" },
  { slug: "rodizios_sistematizados", secao: "Adoção de Rodízios - Ergonômico", label: "Há rodízios sistematizados entre os postos de trabalho?" },
];

const SLUGS_PADRAO = new Set([
  "levantamento_acima_limite", "trabalho_predominante", "pausas_descanso",
  "uso_cadeira", "cadeira_adequada", "monitor", "organizacao_trabalho",
  "exigencia_levantamento", "ritmo_por_demanda", "pausas_formais", "rodizios_sistematizados",
]);

function CheckSep({ title }: { title: string }) {
  return <div className="aet-chk-sep"><p>{title}</p></div>;
}
function CheckRow({ label, value }: { label: string; value: string }) {
  const sim = value === "sim";
  const na = value === "nao_aplica";
  return (
    <div className="aet-chk-row">
      <span className="lbl">{label}</span>
      <span className={sim ? "aet-chk-tag aet-chk-tag--sim" : "aet-chk-tag aet-chk-tag--off"}>
        {sim ? "Sim" : na ? "N/A" : "Não"}
      </span>
    </div>
  );
}
function CheckSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="aet-chk-row">
      <span className="lbl">{label}</span>
      <span className="aet-chk-tag aet-chk-tag--sim">{value || "—"}</span>
    </div>
  );
}

const CLASS_COLOR_HEX: Record<string, { bg: string; cor: string }> = {
  "Trivial": { bg: "#dcfce7", cor: "#166534" },
  "De Atenção": { bg: "#fef9c3", cor: "#854d0e" },
  "Moderado": { bg: "#ffedd5", cor: "#9a3412" },
  "Alto": { bg: "#fee2e2", cor: "#991b1b" },
  "Crítico": { bg: "#fecaca", cor: "#7f1d1d" },
};

export interface AetTemplateProps {
  relatorio: {
    setores: AetSetorLike[];
    consideracoes_finais: string | null;
  };
  empresa: Partial<Empresa> | null;
  capitulos: TextoPadraoCapitulo[];
  owasConfig: AetOwasCfg[];
  checklistPerguntas: AetChecklistPerguntaLike[];
  fatoresConfig: AetFatorConfigLike[];
  fatoresPerguntas: AetFatorPerguntaLike[];
  qpsRespostas: AetQpsRespostaLike[];
  fatoresPsi: AetFatorPsiLike[];
  qpsMeta: AetQpsMetaLike | null;
  /** Plano de Ação 5W2H (aet_acoes, v207). Vazio → o capítulo não imprime. */
  acoes?: AetAcao[];
  valoresVars: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

const STYLE_BLOCK = `
* { box-sizing: border-box; }
/* ── REGRA GERAL DE QUEBRA ────────────────────────────────────────────────────
   Módulo que abriria no pé da folha vai INTEIRO para a próxima. Aqui ficam as
   regras que valem para o documento todo; as específicas de cada bloco estão
   junto do bloco. Nunca menos de 2 linhas de um parágrafo de um lado da virada
   — linha solta na folha seguinte é o que mais faz o laudo parecer quebrado. */
p, li { orphans: 2; widows: 2; }
/* Linha de tabela não parte no meio, e o cabeçalho nunca fica sozinho no pé
   (o thead do Chromium já se repete a cada folha). */
table { page-break-inside: auto; }
thead { page-break-after: avoid; break-after: avoid; }
tr { page-break-inside: avoid; break-inside: avoid; }
.textos-padrao-capitulo { margin-bottom: 18pt; page-break-inside: auto; }
.textos-padrao-capitulo--nova-pagina { page-break-before: always; }
.textos-padrao-capitulo--continua    { page-break-before: auto; margin-top: 16pt; }
/* Capa no estilo DRPS (img 100%, sem full-bleed → não corta caixas na borda) */
.tp-capa { page: capa; position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.tp-capa img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; z-index: 0; }
.tp-capa .caixa { position: absolute; z-index: 1; white-space: pre-wrap; line-height: 1.3; }
.textos-padrao-capitulo-titulo {
  font-size: 14pt; font-weight: 700; color: #1e4d28;
  border-bottom: 2px solid #0ea5e9; padding-bottom: 4px; margin-bottom: 12pt;
  /* Faltava — a secao do sistema (.aet-sec-titulo) ja tinha, esta nao. Ajuda,
     mas o Chromium honra mal break-after em titulo: nao e garantia. */
  page-break-after: avoid; break-after: avoid;
}
.textos-padrao-capitulo-conteudo { font-size: 12pt; color: #1f2937; line-height: 1.5; text-align: justify; }
.textos-padrao-capitulo-conteudo p { margin: 0 0 12pt; text-indent: 1.25cm; text-align: justify; }
/* Subtítulo dentro do capítulo também não abre no pé da folha. */
.textos-padrao-capitulo-conteudo h1,
.textos-padrao-capitulo-conteudo h2,
.textos-padrao-capitulo-conteudo h3 { page-break-after: avoid; break-after: avoid; }
.textos-padrao-capitulo-conteudo h1 { font-size: 14pt; font-weight: 700; color: #1e4d28; margin: 18pt 0 6pt; }
.textos-padrao-capitulo-conteudo h2 { font-size: 13pt; font-weight: 700; color: #1e4d28; margin: 14pt 0 6pt; }
.textos-padrao-capitulo-conteudo h3 { font-size: 12pt; font-weight: 700; color: #1e4d28; margin: 12pt 0 4pt; }
.textos-padrao-capitulo-conteudo ul, .textos-padrao-capitulo-conteudo ol { margin: 0 0 12pt 1.25cm; padding: 0; }
.textos-padrao-capitulo-conteudo li { margin: 2pt 0; }
.textos-padrao-capitulo-conteudo img { max-width: 100%; height: auto; border-radius: 4px; margin: 8pt 0; }
.textos-padrao-capitulo-conteudo table { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 10pt; }
.textos-padrao-capitulo-conteudo th, .textos-padrao-capitulo-conteudo td { border: 1px solid #999; padding: 5px 7px; vertical-align: top; }
.textos-padrao-capitulo-conteudo th { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: left; }
/* Seções AET */
.aet-sec-titulo { font-size: 14pt; font-weight: 700; color: #1e4d28; border-bottom: 2px solid #0ea5e9; padding-bottom: 4px; margin: 0 0 12pt; page-break-after: avoid; break-after: avoid; }
.aet-sub { font-size: 12pt; font-weight: 700; color: #1e4d28; margin: 14pt 0 6pt; page-break-after: avoid; break-after: avoid; }
.aet-fixo { page-break-before: always; }
.aet-fixo--continua { page-break-before: auto; }
.aet-conc p { font-size: 12pt; line-height: 1.6; text-align: justify; color: #1f2937; margin: 0 0 12pt; white-space: pre-line; }
/* Plano de Ação 5W2H (v207). Mesma tabela do laudo da Investigação de
   Acidente, em retrato: 9 colunas a 8px cabem nos 160mm úteis. O setor entra
   como LINHA DE GRUPO, não como coluna — a 10ª coluna não cabia. A tabela pode
   virar a página (tr não parte, thead se repete). */
.aet-plano { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4px; }
.aet-plano th { border-bottom: 1.5px solid #0ea5e9; border-right: 1px solid #e5e7eb; padding: 4px 5px; text-align: left; color: #0ea5e9; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; background: #f0fdf4; }
.aet-plano td { border-bottom: 1px solid #eef0f2; border-right: 1px solid #f3f4f6; padding: 4px 5px; color: #111827; font-size: 8px; vertical-align: top; word-break: break-word; }
.aet-plano td.grupo { background: #374151; color: #fff; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border: 0; }
/* A linha de grupo não fica sozinha no pé da folha: viaja com a 1ª ação. */
.aet-plano tr.grupo { page-break-after: avoid; break-after: avoid; }
/* Blocos de setor */
/* SEM overflow:hidden: estes blocos atravessam a quebra de pagina e o Chromium
   CORTA o que passa da primeira pagina quando a caixa clipa o conteudo. O
   recorte das pontas era so estetico (arredondar a barra escura do topo), e o
   proprio .aet-setor-head faz isso agora com o seu border-radius. */
/* O bloco do setor PODE partir entre paginas — de proposito. Medido no laudo de
   17 setores da NOVAPARECIDA, com o mesmo Puppeteer da rota:
     bloco inteiro indivisivel  -> 124 folhas, 5 delas terminando com 54-67%
     bloco podendo partir       -> 120 folhas, nenhuma folha de miolo pela metade
   O que o "indivisivel" comprava era o cabecalho orfao, e isso agora sai mais
   barato com .aet-setor-abre (abaixo): tabela de risco virando a pagina e um
   documento tecnico normal; barra de setor sozinha no pe da folha nao e. */
.aet-setor-bloco { border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 14pt; page-break-inside: auto; }
/* Grupo indivisivel: barra do setor + ficha de identificacao. E a MENOR unidade
   que resolve o cabecalho orfao — page-break-after na propria barra o Chromium
   ignora (ja tentado na v0.3.523), e prender o bloco inteiro custa as 5 folhas
   pela metade acima. */
.aet-setor-abre { page-break-inside: avoid; break-inside: avoid; }
.aet-setor-head { background: #374151; padding: 7px 12px; border-radius: 5px 5px 0 0; }
.aet-setor-head .t { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #fff; margin: 0; }
.aet-setor-head .s { font-size: 10px; color: #d1d5db; margin: 2px 0 0; }
.aet-setor-tab { width: 100%; border-collapse: collapse; font-size: 11px; }
.aet-setor-tab td, .aet-setor-tab th { border: 1px solid #e5e7eb; padding: 4px 8px; vertical-align: top; color: #374151; }
.aet-setor-info td.k { width: 160px; background: #f9fafb; font-weight: 600; color: #4b5563; }
.aet-riscos th { background: #f3f4f6; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #4b5563; text-align: left; }
.aet-riscos tr:nth-child(even) { background: #f9fafb; }
.aet-placeholder { border: 1px dashed #cbd5e1; background: #f8fafc; color: #64748b; padding: 16px; border-radius: 8px; font-size: 11px; }
/* OWAS */
/* Idem: sem overflow:hidden. Este bloco cresceu com a explicacao dos fatores e
   passou a atravessar paginas — era ele que estava sendo cortado na virada. */
.aet-analise { border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 14pt; page-break-inside: auto; }
/* Zera a margem pendurada no fim do setor (a quebra ja separa do proximo). */
.aet-setor-quebra > .aet-analise:last-child,
.aet-setor-quebra > .aet-setor-bloco:last-child { margin-bottom: 0; }
/* Fecha o setor antes de abrir o próximo. NÃO está em uso: custava 14 folhas
   pela metade no laudo de 17 setores. Mantida para reativar em uma linha. */
.aet-setor-quebra { page-break-before: always; break-before: page; }
/* Explicação de cada fator psicossocial, logo abaixo da tabela do setor.
   Layout de BLOCO, nunca flex: o Chromium nao parte container flex entre
   paginas — os cartoes eram empurrados inteiros, deixando a pagina anterior
   pela metade. Espacamento por margem, nao por gap. */
.aet-psi-obs { padding: 8pt 10pt 10pt; }
.aet-psi-obs-card { border: 1px solid #e5e7eb; border-radius: 5px; padding: 7pt 9pt; margin-bottom: 6pt; page-break-inside: avoid; }
.aet-psi-obs-card:last-child { margin-bottom: 0; }
/* No capitulo agrupado o bloco nao esta dentro da moldura do setor. */
.aet-psi-obs--agrupado { padding: 0; }
.aet-psi-obs-tit { font-size: 10pt; font-weight: 700; color: #374151; margin: 0 0 3pt; }
/* Titulo e cartoes viajam juntos: sozinho, o titulo ficava no pe da folha com
   uma CAIXA VAZIA de meia pagina embaixo (a moldura da analise seguia aberta e
   os cartoes desciam inteiros). O bloco tem ~450px e cabe com folga em A4. */
/* Titulo e cartoes viajam juntos. Sozinho, o titulo ficava no pe da folha com
   uma CAIXA VAZIA de meia pagina embaixo: a moldura da analise seguia aberta e
   os 4 cartoes desciam inteiros. O bloco tem ~450px e cabe com folga em A4;
   quando nao cabe no resto da folha, desce inteiro e a folha fecha limpa no fim
   da tabela de riscos. */
.aet-owas-wrap { padding: 10px 14px; page-break-inside: avoid; break-inside: avoid; }
.aet-owas-tit { margin: 0 0 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; page-break-after: avoid; break-after: avoid; }
/* NAO usar grid aqui. Medido no laudo da NOVAPARECIDA: a 2a fileira do grid caia
   em cima da virada de pagina e o Chromium mandava o CONTEUDO de uma celula para
   a folha anterior deixando a MOLDURA VAZIA na seguinte — uma caixa em branco no
   meio do laudo. Mesma familia da armadilha do flex: container de grid/flex nao
   parte direito entre paginas. Com inline-block a quebra cai ENTRE os cartoes, e
   cada cartao e indivisivel. 2 colunas de 48% cabem nos ~576px uteis. */
.aet-owas-grid { font-size: 0; }
.aet-owas-card { display: inline-block; vertical-align: top; width: 48.5%; margin: 0 0 10px; font-size: 11px; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 6px; padding: 10px; page-break-inside: avoid; break-inside: avoid; }
.aet-owas-card:nth-child(odd) { margin-right: 2.5%; }
.aet-owas-card h4 { margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
.aet-owas-row { display: flex; gap: 10px; }
.aet-owas-opts { flex: 1; }
.aet-owas-opt { display: flex; align-items: flex-start; gap: 6px; margin: 3px 0; }
.aet-owas-chk { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border-radius: 3px; border: 1px solid #9ca3af; font-size: 9px; line-height: 1; }
.aet-owas-chk--on { background: #374151; border-color: #374151; color: #fff; }
.aet-owas-img { width: 96px; flex-shrink: 0; }
.aet-owas-img img { width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 4px; }
/* Checklist */
.aet-chk-wrap { padding: 10px 14px; border-top: 1px solid #f3f4f6; }
.aet-chk-box { border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 8px; padding: 12px; }
/* "CHECKLIST ERGONÔMICO" não fica sozinho no pé com a caixa começando só na
   folha seguinte — foi o último caso que sobrou no laudo de 17 setores. */
.aet-chk-tit { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 0 0 6px; page-break-after: avoid; break-after: avoid; }
/* "POSTURA", "RITMO DE TRABALHO"… nunca ficam sozinhos no pé da folha. */
.aet-chk-sep { border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px; page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid; }
.aet-chk-sep:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
.aet-chk-sep p { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; margin: 0 0 4px; }
/* Uma pergunta e a sua resposta são indivisíveis: a tarja não pode virar a
   folha sem o texto que ela responde. */
.aet-chk-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; page-break-inside: avoid; break-inside: avoid; }
.aet-chk-row .lbl { flex: 1; font-size: 11px; line-height: 1.35; color: #374151; }
.aet-chk-tag { flex-shrink: 0; border-radius: 4px; padding: 1px 8px; font-size: 10px; font-weight: 600; }
.aet-chk-tag--sim { background: #1f2937; color: #fff; }
.aet-chk-tag--off { background: #fff; border: 1px solid #e5e7eb; color: #9ca3af; }
/* Registros fotográficos do setor. NÃO é flex de propósito: o Chromium não parte
   container flex entre páginas, então uma segunda fileira que não coubesse
   empurraria as DUAS para a folha seguinte e deixaria meia página em branco.
   Com inline-block a quebra acontece ENTRE as fileiras — a primeira fica, a
   segunda desce. Espaçamento por margem, não por gap (que é de flex/grid).
   176px × 3 + margens = 546px, dentro dos ~576px úteis (160mm de área impressa
   menos o padding do .aet-chk-wrap). Cada foto é indivisível pela sua altura
   fixa; o que não pode partir é a legenda do seu retrato. */
.aet-fotos { font-size: 0; }
.aet-fotos .f { display: inline-block; vertical-align: top; width: 176px; margin: 0 6px 6px 0; page-break-inside: avoid; break-inside: avoid; }
.aet-fotos img { display: block; width: 176px; height: 99px; object-fit: cover; border: 1px solid #d1d5db; border-radius: 4px; }
.aet-fotos .leg { font-size: 8px; color: #6b7280; text-align: center; margin: 2px 0 0; line-height: 1.2; }
.aet-rich { font-size: 11px; line-height: 1.55; color: #374151; }
.aet-rich p { margin: 0 0 6px; }
.aet-rich > *:last-child { margin-bottom: 0; }
.aet-rich img { max-width: 100%; height: auto; }
.aet-rich ul, .aet-rich ol { margin: 0 0 6px 1.2em; padding: 0; }
.aet-rich table { border-collapse: collapse; width: 100%; font-size: 10px; margin: 6px 0; }
.aet-rich th, .aet-rich td { border: 1px solid #cbd5e1; padding: 4px 6px; }
`;

function SectionTitulo({ titulo }: { titulo: string }) {
  return <h2 className="aet-sec-titulo">{titulo}</h2>;
}

/** Tabela de riscos por setor (portado do laudo, com estilo inline/CSS). */
function SetorRiscosBlock({ setor, idx }: { setor: AetSetorLike; idx: number }) {
  const cargos = normalizarCargos(setor.cargos);
  const riscos = setor.riscos ?? [];
  const COLS = ["Tipo", "Agente / Risco", "Intensidade / Conc.", "Técnica / Metodologia", "EPI (CA)", "EPI Eficaz", "Classificação"];
  return (
    <div className="aet-setor-bloco">
      {/* A barra escura do setor e a ficha de identificação viajam juntas: é o
          grupo que não pode partir. As tabelas de risco, essas sim, podem virar
          a página — é o que evita a folha terminando pela metade. */}
      <div className="aet-setor-abre">
      <div className="aet-setor-head">
        <p className="t">Setor {idx + 1}: {setor.nome_setor || "—"}</p>
        {cargos.length > 0 && (
          <p className="s">{cargos.map((c) => c.nome).filter(Boolean).join(" · ")}</p>
        )}
        </div>
        <table className="aet-setor-tab aet-setor-info">
          <tbody>
            {setor.maquinas_equipamentos && (
              <tr><td className="k">Máquinas e Equipamentos</td><td>{setor.maquinas_equipamentos.split("\n").filter(Boolean).join(" · ")}</td></tr>
            )}
            {setor.descricao_atividade && (
              <tr><td className="k">Descrição da Atividade</td><td>{setor.descricao_atividade}</td></tr>
            )}
            {cargos.filter((c) => c.descricao).map((cargo, i) => (
              <tr key={i}><td className="k">{cargo.nome}</td><td>{cargo.descricao}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {riscos.length > 0 ? (
        <table className="aet-setor-tab aet-riscos">
          <thead><tr>{COLS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {riscos.map((r) => {
              const cls = CLASS_COLOR_HEX[r.classificacao_risco ?? ""] ?? { bg: "#f3f4f6", cor: "#374151" };
              return (
                <tr key={r.id}>
                  <td>{r.tipo}</td>
                  <td>{r.risco}</td>
                  <td>{r.intensidade_concentracao}</td>
                  <td>{r.tecnica_metodologia}</td>
                  <td>{r.epi_ca}</td>
                  <td>{r.epi_eficaz}</td>
                  <td className="aet-class" style={{ background: cls.bg, color: cls.cor }}>{r.classificacao_risco}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p style={{ padding: "8px 12px", fontSize: 11, fontStyle: "italic", color: "#9ca3af", margin: 0 }}>
          Nenhum agente / risco identificado neste setor.
        </p>
      )}
    </div>
  );
}

/** Cards OWAS de um setor (posturas selecionadas + imagem de referência). */
function BlocoOwas({ setor, owasConfig }: { setor: AetSetorLike; owasConfig: AetOwasCfg[] }) {
  const owas = setor.owas ?? {};
  const temOwas = owasConfig.some((cat) => {
    const field = SLUG_TO_OWAS_FIELD[cat.slug];
    return field && (owas[field] ?? []).length > 0;
  });
  if (!temOwas) return null;
  return (
    <div className="aet-owas-wrap">
      <p className="aet-owas-tit">OWAS — Análise de Posturas</p>
      <div className="aet-owas-grid">
        {owasConfig.map((cat) => {
          const field = SLUG_TO_OWAS_FIELD[cat.slug];
          if (!field) return null;
          const selected = (owas[field] ?? []) as number[];
          return (
            <div key={cat.id} className="aet-owas-card">
              <h4>{cat.titulo}</h4>
              <div className="aet-owas-row">
                <div className="aet-owas-opts">
                  {cat.opcoes.map((opt) => {
                    const on = selected.includes(opt.value);
                    return (
                      <div key={opt.value} className="aet-owas-opt">
                        <span className={on ? "aet-owas-chk aet-owas-chk--on" : "aet-owas-chk"}>{on ? "✓" : ""}</span>
                        <span style={{ fontSize: 11, color: on ? "#111827" : "#9ca3af", lineHeight: 1.3 }}>{opt.label}</span>
                      </div>
                    );
                  })}
                </div>
                {cat.imagem && (
                  <div className="aet-owas-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cat.imagem} alt={`Referência OWAS: ${cat.titulo}`} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Checklist ergonômico de um setor (Postura, Tempo, Ritmo, Rodízios, Organização). */
function BlocoChecklist({ setor, perguntas }: { setor: AetSetorLike; perguntas: AetChecklistPerguntaLike[] }) {
  const checklist = setor.checklist ?? {};
  const pergunta = (slug: string) =>
    perguntas.find((p) => p.slug === slug)?.label ?? CHECKLIST_PADRAO.find((p) => p.slug === slug)?.label ?? slug;
  const lbl = (slug: string) => perguntas.find((p) => p.slug === slug)?.label ?? slug;
  const secaoDe = (slug: string) => perguntas.find((p) => p.slug === slug)?.secao ?? "";
  // v209: pergunta excluída na tela de configuração não sai no PDF, e a seção
  // que ficou sem nenhuma linha não imprime título. Mesma régua da prévia.
  const oculta = (slug: string) => perguntaOculta(perguntas, slug);
  const secaoTemLinha = (slugs: string[], extras: unknown[]) =>
    algumaVisivel(perguntas, slugs) || extras.length > 0;
  const customExtras = Object.entries(setor.respostas_extras ?? {}).filter(([slug]) => !SLUGS_PADRAO.has(slug));
  const extrasDeSecao = (secao: string) => customExtras.filter(([slug]) => secaoDe(slug) === secao);
  const extrasAdocao = customExtras.filter(([slug]) => secaoDe(slug).startsWith("Adoção"));
  const extrasSemSecao = customExtras.filter(([slug]) => {
    const s = secaoDe(slug);
    return s !== "Postura" && s !== "Exigência de Tempo" && s !== "Ritmo de Trabalho" && !s.startsWith("Adoção") && s !== "Organização do Trabalho";
  });
  return (
    <div className="aet-chk-wrap">
      <div className="aet-chk-box">
        <p className="aet-chk-tit">Checklist Ergonômico</p>
        <CheckSep title="Postura" />
        {!oculta("levantamento_acima_limite") && <CheckRow label={pergunta("levantamento_acima_limite")} value={checklist.levantamento_acima_limite ?? ""} />}
        <CheckSelect label={pergunta("trabalho_predominante")} value={checklist.trabalho_predominante ?? ""} />
        {!oculta("pausas_descanso") && <CheckRow label={pergunta("pausas_descanso")} value={checklist.pausas_descanso ?? ""} />}
        {!oculta("uso_cadeira") && <CheckRow label={pergunta("uso_cadeira")} value={checklist.uso_cadeira ?? ""} />}
        {!oculta("cadeira_adequada") && <CheckRow label={pergunta("cadeira_adequada")} value={checklist.cadeira_adequada ?? ""} />}
        {!oculta("monitor") && <CheckRow label={pergunta("monitor")} value={checklist.monitor ?? ""} />}
        {extrasDeSecao("Postura").map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
        {secaoTemLinha(["exigencia_levantamento"], extrasDeSecao("Exigência de Tempo")) && (
          <>
            <CheckSep title="Exigência de Tempo" />
            {!oculta("exigencia_levantamento") && <CheckRow label={pergunta("exigencia_levantamento")} value={checklist.exigencia_levantamento ?? ""} />}
            {extrasDeSecao("Exigência de Tempo").map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
          </>
        )}
        {secaoTemLinha(["ritmo_por_demanda"], extrasDeSecao("Ritmo de Trabalho")) && (
          <>
            <CheckSep title="Ritmo de Trabalho" />
            {!oculta("ritmo_por_demanda") && <CheckRow label={pergunta("ritmo_por_demanda")} value={checklist.ritmo_por_demanda ?? ""} />}
            {extrasDeSecao("Ritmo de Trabalho").map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
          </>
        )}
        {secaoTemLinha(["pausas_formais", "rodizios_sistematizados"], extrasAdocao) && (
          <>
            <CheckSep title="Adoção de Rodízios — Ergonômico" />
            {!oculta("pausas_formais") && <CheckRow label={pergunta("pausas_formais")} value={checklist.pausas_formais ?? ""} />}
            {!oculta("rodizios_sistematizados") && <CheckRow label={pergunta("rodizios_sistematizados")} value={checklist.rodizios_sistematizados ?? ""} />}
            {extrasAdocao.map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
          </>
        )}
        {!oculta("organizacao_trabalho") && (
          <>
            <CheckSep title="Organização do Trabalho" />
            <p style={{ fontSize: 11, fontStyle: "italic", lineHeight: 1.5, color: "#4b5563", margin: 0 }}>{pergunta("organizacao_trabalho")}</p>
          </>
        )}
        {extrasSemSecao.length > 0 && (
          <>
            <CheckSep title="Perguntas Adicionais" />
            {extrasSemSecao.map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
          </>
        )}
      </div>
    </div>
  );
}

/** Registros fotográficos do setor — mesma posição da prévia do laudo: depois
 *  do checklist e antes do Parecer Técnico, com o mesmo teto de 6 fotos. */
function BlocoFotos({ setor }: { setor: AetSetorLike }) {
  const fotos = (setor.fotos ?? []).filter(Boolean).slice(0, 6);
  if (fotos.length === 0) return null;
  return (
    <div className="aet-chk-wrap">
      <p className="aet-owas-tit">Registros Fotográficos</p>
      <div className="aet-fotos">
        {fotos.map((url, i) => (
          <div key={i} className="f">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Registro fotográfico ${i + 1} do setor ${setor.nome_setor ?? ""}`} />
            <p className="leg">Foto {i + 1} de {fotos.length}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 13 Fatores Psicossociais (QPS) ───────────────────────────────────────────
type ZonaPsi = "verde" | "amarela" | "laranja" | "vermelha";
export interface AetFatorConfigLike { codigo: string; nome: string }
export interface AetFatorPerguntaLike { codigo_fator: string; ordem: number; logica?: string | null }
export interface AetQpsRespostaLike { id_setor: string; codigo_fator: string; pergunta_ordem: number; resposta: number }
export interface AetFatorPsiLike { id_setor: string; codigo_fator: string; avaliado?: boolean; zona?: ZonaPsi | null; media?: number | null; observacao?: string | null; pergunta_critica?: string | null }
export interface AetQpsMetaLike {
  n_respondentes?: number | null; total_elegivel?: number | null;
  periodo_inicio?: string | null; periodo_fim?: string | null;
  modo_aplicacao?: string | null; tecnico_aplicador?: string | null; observacao_geral?: string | null;
}

const ZONA_BG: Record<string, string> = { verde: "#E8F5E9", amarela: "#FFF9C4", laranja: "#FFE0B2", vermelha: "#FFEBEE" };
const ZONA_FG: Record<string, string> = { verde: "#1B5E20", amarela: "#F57F17", laranja: "#E65100", vermelha: "#C62828" };

function nivelPgrFromZona(zona: ZonaPsi | null | undefined): string {
  if (zona === "vermelha") return "Crítico";
  if (zona === "laranja") return "Alto";
  if (zona === "amarela") return "Moderado";
  if (zona === "verde") return "Trivial";
  return "—";
}
/** Média do fator no setor — a conta mora em lib/aet/consolidar-psi.ts, um lugar
 *  só para as quatro telas (preenchimento, psicossocial, prévia e PDF). */
const calcMediaSetor = mediaFatorDeLinhas;
function ZonaTag({ zona }: { zona: ZonaPsi | null | undefined }) {
  if (!zona) return <>—</>;
  return (
    <span style={{ borderRadius: 4, padding: "1px 8px", fontSize: 10, fontWeight: 700, background: ZONA_BG[zona], color: ZONA_FG[zona] }}>
      {zona.charAt(0).toUpperCase() + zona.slice(1)}
    </span>
  );
}

/** Tabela de 13 fatores psicossociais de UM setor (médias QPS + zona + nível PGR). */
function BlocoFatoresSetor({
  setor, fatoresConfig, fatoresPerguntas, qpsRespostas, fatoresPsi,
}: {
  setor: AetSetorLike;
  fatoresConfig: AetFatorConfigLike[];
  fatoresPerguntas: AetFatorPerguntaLike[];
  qpsRespostas: AetQpsRespostaLike[];
  fatoresPsi: AetFatorPsiLike[];
}) {
  const psiRows = fatoresConfig
    .filter((f) => f.codigo !== "F13")
    .map((f) => {
      const media = calcMediaSetor(fatoresPerguntas, qpsRespostas, setor.id, f.codigo);
      if (media === null) return null;
      return { f, media, zona: zonaFromMedia(media) };
    })
    .filter((x): x is { f: AetFatorConfigLike; media: number; zona: ZonaPsi | null } => x !== null);
  // F13 não tem média (zona é escolhida à mão) — e é POR SETOR desde a v135.
  const f13 = fatoresPsi.find(
    (fp) => fp.id_setor === setor.id && fp.codigo_fator === "F13" && fp.avaliado && fp.zona,
  );
  if (psiRows.length === 0 && !f13) return null;

  // Explicação de cada fator DESTE setor — espelha o bloco "Observações por
  // fator" da tela. Sem isto o PDF imprimia a tabela e engolia o texto que
  // explica a pontuação; ele só existia agrupado no capítulo psicossocial,
  // longe do setor a que pertence.
  const nomeF13 = fatoresConfig.find((fc) => fc.codigo === "F13")?.nome ?? "Proteção da segurança física";
  const observacoes = [
    ...psiRows.map(({ f }) => ({ codigo: f.codigo, nome: f.nome })),
    // A tela pula o F13 aqui, mas a tabela acima IMPRIME a linha do F13 — e 20
    // das 23 linhas de F13 da base têm texto. Deixar de fora imprimiria uma
    // pontuação sem explicação nenhuma.
    ...(f13 ? [{ codigo: "F13", nome: nomeF13 }] : []),
  ]
    .map((f) => {
      const fp = fatoresPsi.find((p) => p.id_setor === setor.id && p.codigo_fator === f.codigo);
      return fp && !htmlVazio(fp.observacao) ? { ...f, html: fp.observacao as string } : null;
    })
    .filter((x): x is { codigo: string; nome: string; html: string } => x !== null);

  return (
    <div className="aet-chk-wrap">
      <p className="aet-owas-tit">Fatores Psicossociais — QPS</p>
      <table className="aet-setor-tab aet-riscos">
        <thead><tr>{["Cód.", "Fator", "Média", "Zona", "Nível PGR"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {psiRows.map(({ f, media, zona }) => (
            <tr key={f.codigo}>
              <td style={{ fontWeight: 700 }}>{f.codigo}</td>
              <td>{f.nome}</td>
              <td style={{ textAlign: "center" }}>{media.toFixed(2)}</td>
              <td><ZonaTag zona={zona} /></td>
              <td>{nivelPgrFromZona(zona)}</td>
            </tr>
          ))}
          {f13 && (
            <tr>
              <td style={{ fontWeight: 700 }}>F13</td>
              <td>{fatoresConfig.find((fc) => fc.codigo === "F13")?.nome ?? "Proteção da segurança física"}</td>
              <td style={{ textAlign: "center" }}>—</td>
              <td><ZonaTag zona={f13.zona} /></td>
              <td>{nivelPgrFromZona(f13.zona)}</td>
            </tr>
          )}
        </tbody>
      </table>
      {observacoes.length > 0 && (
        <div className="aet-psi-obs">
          {observacoes.map((o) => (
            <div key={o.codigo} className="aet-psi-obs-card">
              <p className="aet-psi-obs-tit">{o.codigo} — {o.nome}</p>
              <div className="aet-rich" dangerouslySetInnerHTML={{ __html: o.html }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Os três textos de análise do setor (HTML do editor), na mesma ordem da tela:
 *  Parecer Técnico → Recomendações → Demais Condições Avaliadas. */
function BlocoParecerRecom({ setor }: { setor: AetSetorLike }) {
  const textos: Array<{ titulo: string; html?: string | null }> = [
    { titulo: "Parecer Técnico", html: setor.parecer_tecnico },
    { titulo: "Recomendações", html: setor.recomendacoes },
    { titulo: "Demais Condições Avaliadas", html: setor.demais_condicoes },
  ].filter((t) => !htmlVazio(t.html));

  if (textos.length === 0) return null;
  return (
    <>
      {textos.map((t) => (
        <div key={t.titulo} className="aet-chk-wrap">
          <p className="aet-owas-tit">{t.titulo}</p>
          <div className="aet-rich" dangerouslySetInnerHTML={{ __html: t.html! }} />
        </div>
      ))}
    </>
  );
}

export default function AetTemplate({
  relatorio: rel,
  empresa,
  capitulos,
  owasConfig,
  checklistPerguntas,
  fatoresConfig,
  fatoresPerguntas,
  qpsRespostas,
  fatoresPsi,
  qpsMeta,
  acoes = [],
  valoresVars,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: AetTemplateProps) {
  const temSetores = (rel.setores?.length ?? 0) > 0;
  const consideracoes = (rel.consideracoes_finais ?? "").trim();

  const blocosOrdenados = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const tituloPorSlug: Record<string, string> = {};
  for (const c of capitulos) if (c.slug_fixo) tituloPorSlug[c.slug_fixo] = c.titulo;

  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "aet_agentes_ambientais": return temSetores;
      case "aet_analise_ergonomica": return temSetores;
      case "aet_psicossocial": return fatoresPsi.some((f) => f.avaliado);
      case "aet_plano_acao": return acoes.length > 0;
      case "aet_consideracoes_finais": return !!consideracoes;
      case "aet_assinatura": return true;
      default: return false; // sumario
    }
  }

  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  const sumarioTitulos = blocosOrdenados
    .filter((c) => renderizaNumerado(c))
    .map((c) => (c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresVars)))
    .filter((t) => t && t.trim());

  function renderEditavel(c: TextoPadraoCapitulo) {
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";

    // Capa: estilo DRPS (img 100% + caixas posicionadas), evita o corte da borda.
    if (ehCapa) {
      return (
        <div key={c.id_capitulo} className="tp-capa">
          {c.bg_imagem_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bg" src={c.bg_imagem_url} alt="" />
          )}
          {(c.caixas_texto ?? []).map((cx) => (
            <div
              key={cx.id}
              className="caixa"
              style={{
                left: `${cx.x}%`,
                top: `${cx.y}%`,
                width: `${cx.w ?? 40}%`,
                fontSize: cx.fontSize ?? 16,
                fontWeight: cx.bold ? 700 : 400,
                color: cx.color ?? "#ffffff",
                textAlign: (cx.align ?? "left") as React.CSSProperties["textAlign"],
              }}
            >
              {substituirVariaveisTexto(cx.conteudo, valoresVars)}
            </div>
          ))}
        </div>
      );
    }

    const orientacao = c.orientacao ?? "retrato";
    const novaPagina = (c.quebra_pagina ?? "nova") === "nova";
    const conteudo = substituirVariaveis(c.conteudo, valoresVars);
    const titulo = numLabel(numPorId[c.id_capitulo], substituirVariaveisTexto(c.titulo, valoresVars));
    const classes = [
      "textos-padrao-capitulo",
      orientacao === "paisagem" ? "textos-padrao-capitulo--paisagem" : "textos-padrao-capitulo--retrato",
      novaPagina ? "textos-padrao-capitulo--nova-pagina" : "textos-padrao-capitulo--continua",
    ].join(" ");
    return (
      <article key={c.id_capitulo} className={classes}>
        <h2 className="textos-padrao-capitulo-titulo">{titulo}</h2>
        <div className="textos-padrao-capitulo-conteudo" dangerouslySetInnerHTML={{ __html: conteudo }} />
      </article>
    );
  }

  // Seção por setor: tabela de riscos (passo 3, real) + análise OWAS/checklist
  // (passo 4, ainda placeholder). comAnalise controla o sub-bloco de análise.
  function secaoSetores(slug: string, rotulo: string, intro: string | null, comAnalise: boolean) {
    return (
      <>
        <SectionTitulo titulo={numLabel(numPorSlug[slug], tituloPorSlug[slug] ?? rotulo)} />
        {intro && (
          <p style={{ marginBottom: 12, fontSize: 11, color: "#374151", borderLeft: "2px solid #cbd5e1", paddingLeft: 12 }}>
            {intro}
          </p>
        )}
        {rel.setores.map((s, i) => (
          // No capítulo com análise, cada setor começa em página nova (menos o
          // primeiro, que segue o título da seção). Sem isso a análise de um
          // setor emendava no bloco do setor seguinte e o Parecer aparecia
          // solto, longe do setor a que pertence.
          // SEM quebra forçada por setor. Ela existiu na v0.3.522 para "fechar o
          // setor 1 antes do 2", mas medido no laudo da NOVAPARECIDA custava 14
          // folhas terminando pela metade (3 delas com 83-85% em branco, só com
          // o cartão do F13). Os setores voltam a correr em sequência; quem
          // impede o setor de abrir órfão no pé da página é o page-break-after
          // do .aet-setor-head. Para retomar a separação: className="aet-setor-quebra".
          <div key={s.id} style={{ marginBottom: 16 }}>
            <SetorRiscosBlock setor={s} idx={i} />
            {comAnalise && (
              <div className="aet-analise" style={{ marginTop: 8 }}>
                <BlocoOwas setor={s} owasConfig={owasConfig} />
                <BlocoChecklist setor={s} perguntas={checklistPerguntas} />
                {/* Mesma ordem da prévia: checklist → fotos → parecer. */}
                <BlocoFotos setor={s} />
                <BlocoParecerRecom setor={s} />
                <BlocoFatoresSetor
                  setor={s}
                  fatoresConfig={fatoresConfig}
                  fatoresPerguntas={fatoresPerguntas}
                  qpsRespostas={qpsRespostas}
                  fatoresPsi={fatoresPsi}
                />
              </div>
            )}
          </div>
        ))}
      </>
    );
  }

  function secaoPsicossocial(intro: string | null) {
    const nomeSetor = (idSetor: string) =>
      rel.setores.find((s) => s.id === idSetor)?.nome_setor?.trim() || "Setor sem nome";

    // v135: uma linha por (setor, fator). Descarta setores já excluídos do laudo
    // — sem isso um setor apagado ainda puxaria o quadro geral para a pior zona.
    const existentes = apenasSetoresExistentes(
      fatoresPsi.filter((f) => f.avaliado),
      rel.setores.map((s) => s.id),
    );

    // Média e zona RECALCULADAS das respostas — este quadro era o único lugar
    // que imprimia o valor gravado, e `media` é numeric(3,1) na produção: saía
    // "4.30" onde a tabela por setor, logo acima no mesmo PDF, imprime "4.25".
    // O porquê inteiro está em lib/aet/consolidar-psi.ts.
    const avaliados = recalcularDasRespostas(existentes, fatoresPerguntas, qpsRespostas);

    // Quadro geral: cada fator na condição mais desfavorável entre os setores.
    const geral = consolidarPiorCaso(avaliados);

    // Análise detalhada: uma entrada por (fator, setor) — o texto do técnico é
    // de um setor específico e deixa de ser repetido para todos.
    const comAnalise = avaliados
      // A "Pergunta Crítica" deixou de ser impressa: era a pergunta de pior
      // score do próprio fator, que já consta no corpo do laudo. O dado segue
      // gravado em `pergunta_critica` — só não sai mais no documento.
      .filter((f) => !htmlVazio(f.observacao))
      .sort(
        (a, b) =>
          a.codigo_fator.localeCompare(b.codigo_fator) ||
          nomeSetor(a.id_setor).localeCompare(nomeSetor(b.id_setor)),
      );

    const multiSetor = rel.setores.length > 1;
    const temDados = qpsMeta && (qpsMeta.n_respondentes != null || qpsMeta.periodo_inicio || qpsMeta.modo_aplicacao || qpsMeta.tecnico_aplicador);
    const fmtData = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
    return (
      <>
        <SectionTitulo titulo={numLabel(numPorSlug["aet_psicossocial"], tituloPorSlug["aet_psicossocial"] ?? "Fatores Psicossociais (QPS)")} />
        {intro && (
          <p style={{ marginBottom: 10, fontSize: 11, color: "#374151", borderLeft: "2px solid #cbd5e1", paddingLeft: 12 }}>{intro}</p>
        )}
        <p style={{ fontSize: 11, lineHeight: 1.55, color: "#374151", margin: "0 0 12px", textAlign: "justify" }}>
          {/* Texto IGUAL ao da prévia (PsicossocialSections em aet/[id]/laudo).
              Estava encurtado aqui — sumia a origem do instrumento e a adaptação
              ao Brasil, que é justamente a parte que fundamenta o método. */}
          A avaliação dos fatores psicossociais foi realizada por meio do instrumento QPS Nordic (Questionário de
          Fatores Psicossociais no Trabalho), desenvolvido pelos institutos nórdicos de saúde ocupacional e
          adaptado à realidade brasileira. O instrumento contempla 13 fatores relacionados às condições
          psicossociais do trabalho, classificados em zonas de risco: verde (baixo), amarela (moderado),
          laranja (elevado) e vermelha (crítico).
        </p>

        {temDados && (
          <>
            <h3 className="aet-sub">Dados da Aplicação</h3>
            <table className="aet-setor-tab aet-setor-info" style={{ marginBottom: 12 }}>
              <tbody>
                {qpsMeta!.n_respondentes != null && (
                  <tr><td className="k">Respondentes</td><td>{qpsMeta!.n_respondentes}{qpsMeta!.total_elegivel ? ` de ${qpsMeta!.total_elegivel} elegíveis` : ""}</td></tr>
                )}
                {(qpsMeta!.periodo_inicio || qpsMeta!.periodo_fim) && (
                  <tr><td className="k">Período</td><td>{fmtData(qpsMeta!.periodo_inicio)}{qpsMeta!.periodo_fim ? ` a ${fmtData(qpsMeta!.periodo_fim)}` : ""}</td></tr>
                )}
                {qpsMeta!.modo_aplicacao && <tr><td className="k">Modo de Aplicação</td><td>{qpsMeta!.modo_aplicacao}</td></tr>}
                {qpsMeta!.tecnico_aplicador && <tr><td className="k">Técnico Aplicador</td><td>{qpsMeta!.tecnico_aplicador}</td></tr>}
                {qpsMeta!.observacao_geral && <tr><td className="k">Observações</td><td>{qpsMeta!.observacao_geral}</td></tr>}
              </tbody>
            </table>
          </>
        )}

        {geral.length > 0 && (
          <>
            <h3 className="aet-sub">Resultado Geral por Fator</h3>
            {multiSetor && (
              <p style={{ margin: "0 0 6px", fontSize: 10, color: "#6b7280" }}>
                Consolidado dos setores avaliados pelo pior caso: cada fator é apresentado na
                condição mais desfavorável encontrada entre os setores. O detalhamento por setor
                consta no capítulo de Análise Ergonômica.
              </p>
            )}
            <table className="aet-setor-tab aet-riscos" style={{ marginBottom: 12 }}>
              <thead><tr>{["Cód.", "Fator", "Média", "Zona de Risco", "Nível PGR"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {geral.map((g) => {
                  const cfg = fatoresConfig.find((f) => f.codigo === g.codigo_fator);
                  return (
                    <tr key={g.codigo_fator}>
                      <td style={{ fontWeight: 700 }}>{g.codigo_fator}</td>
                      <td>{cfg?.nome ?? g.codigo_fator}</td>
                      <td style={{ textAlign: "center" }}>{g.media != null ? g.media.toFixed(2) : "—"}</td>
                      <td><ZonaTag zona={g.zona} /></td>
                      <td>{nivelPgrFromZona(g.zona)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {comAnalise.length > 0 && (
          <>
            <h3 className="aet-sub">Análise Detalhada por Fator</h3>
            {/* Bloco (nao flex) e cada cartao inteiro: aqui os cartoes partiam
                na virada de pagina, abrindo a folha seguinte no meio da frase. */}
            <div className="aet-psi-obs aet-psi-obs--agrupado">
              {comAnalise.map((fp) => {
                const cfg = fatoresConfig.find((f) => f.codigo === fp.codigo_fator);
                return (
                  <div key={`${fp.id_setor}:${fp.codigo_fator}`} className="aet-psi-obs-card">
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#374151" }}>
                      {fp.codigo_fator} — {cfg?.nome ?? fp.codigo_fator} <ZonaTag zona={fp.zona} />
                    </p>
                    {multiSetor && (
                      <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 600, color: "#6b7280" }}>
                        Setor: {nomeSetor(fp.id_setor)}
                      </p>
                    )}
                    {!htmlVazio(fp.observacao) && (
                      <div
                        className="aet-rich"
                        style={{ margin: 0 }}
                        dangerouslySetInnerHTML={{ __html: textoParaHtml(fp.observacao) }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  }

  // Plano de Ação 5W2H — agrupado pelos setores do laudo, na ordem deles
  // (lib/aet/acoes: a MESMA função da tela e da prévia).
  function secaoPlanoAcao(intro: string | null) {
    const grupos = agruparAcoesPorSetor(acoes, rel.setores);
    const heads = ["Prior.", "O quê", "Por quê", "Como", "Onde", "Quem", "Quando", "Quanto", "Status"];
    const cols = ["6%", "16%", "14%", "13%", "9%", "10%", "13%", "9%", "10%"];
    const PRIO_COR: Record<string, string> = { Critica: "#b91c1c", Alta: "#c2410c", Media: "#b45309", Baixa: "#047857" };
    const STATUS_COR: Record<string, string> = { Pendente: "#b45309", "Em Andamento": "#1d4ed8", Concluida: "#047857", Cancelada: "#6b7280" };
    return (
      <>
        <SectionTitulo titulo={numLabel(numPorSlug["aet_plano_acao"], tituloPorSlug["aet_plano_acao"] ?? "Plano de Ação (5W2H)")} />
        {intro && (
          <p style={{ marginBottom: 10, fontSize: 11, color: "#374151", borderLeft: "2px solid #cbd5e1", paddingLeft: 12 }}>{intro}</p>
        )}
        <table className="aet-plano">
          <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
          <thead>
            <tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <React.Fragment key={g.setor?.id ?? "__gerais"}>
                <tr className="grupo">
                  <td className="grupo" colSpan={heads.length}>
                    {g.setor
                      ? `Setor ${rel.setores.indexOf(g.setor) + 1}: ${g.setor.nome_setor?.trim() || "—"}`
                      : ROTULO_ACOES_GERAIS}
                  </td>
                </tr>
                {g.acoes.map((a) => (
                  <tr key={a.id_acao}>
                    <td style={{ color: PRIO_COR[a.prioridade] ?? PRIO_COR.Media, fontWeight: 700 }}>{a.prioridade}</td>
                    <td style={{ fontWeight: 600 }}>{a.what_acao}</td>
                    <td>{a.why_justificativa || "—"}</td>
                    <td>{a.how_metodo || "—"}</td>
                    <td>{a.where_local || "—"}</td>
                    <td>{a.who_responsavel || "—"}</td>
                    <td>{formatarPrazoAcao(a.when_prazo) || "—"}</td>
                    <td>{a.how_much_custo || "—"}</td>
                    <td style={{ color: STATUS_COR[a.status] ?? STATUS_COR.Pendente, fontWeight: 700 }}>{a.status}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "aet_assinatura" && c.ativo !== false,
  );

  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["aet_assinatura"]}
    />
  );

  function renderBloco(c: TextoPadraoCapitulo) {
    if (c.tipo !== "fixo") return renderEditavel(c);

    const intro = c.conteudo ? substituirVariaveisTexto(c.conteudo, valoresVars) : null;
    let conteudoFixo: React.ReactNode = null;
    switch (c.slug_fixo) {
      case "identificacao_empresa":
        // Datas vindas de `valoresVars` — o MESMO dicionário de {{...}}, já
        // formatado em dd/mm/aaaa, para o bloco e a variável nunca divergirem.
        conteudoFixo = (
          <SecaoIdentificacaoEmpresa
            empresa={empresa}
            numero={numPorSlug["identificacao_empresa"]}
            datasDocumento={{
              dataElaboracao: valoresVars["data_elaboracao"],
              dataValidade: valoresVars["data_validade"],
            }}
          />
        );
        break;
      case "sumario":
        conteudoFixo = <SecaoSumario titulos={sumarioTitulos} />;
        break;
      case "aet_agentes_ambientais":
        conteudoFixo = temSetores ? secaoSetores("aet_agentes_ambientais", "Agentes Ambientais para as Áreas Operacionais", intro, false) : null;
        break;
      case "aet_analise_ergonomica":
        conteudoFixo = temSetores ? secaoSetores("aet_analise_ergonomica", "Análises Ergonômicas do Trabalho", intro, true) : null;
        break;
      case "aet_psicossocial":
        conteudoFixo = fatoresPsi.some((f) => f.avaliado) ? secaoPsicossocial(intro) : null;
        break;
      case "aet_plano_acao":
        conteudoFixo = acoes.length > 0 ? secaoPlanoAcao(intro) : null;
        break;
      case "aet_consideracoes_finais":
        conteudoFixo = consideracoes ? (
          <div className="aet-conc">
            <SectionTitulo titulo={numLabel(numPorSlug["aet_consideracoes_finais"], tituloPorSlug["aet_consideracoes_finais"] ?? "Considerações Finais")} />
            {/* Rich text do editor (com <p>...</p>) — renderizar como HTML igual ao parecer/recomendações,
                senão as tags saem literais no PDF. */}
            <div className="aet-rich" dangerouslySetInnerHTML={{ __html: consideracoes }} />
          </div>
        ) : null;
        break;
      case "aet_assinatura":
        conteudoFixo = folhaNode;
        break;
      default:
        conteudoFixo = null;
    }
    return conteudoFixo ? (
      <div key={c.id_capitulo} className={classeQuebraFixoNova(c)} data-slug={c.slug_fixo ?? undefined}>
        {conteudoFixo}
      </div>
    ) : null;
  }

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />
      {blocosOrdenados.map((c) => renderBloco(c))}
      {!temAssinaturaFixo && (
        <FolhaAssinaturas
          signatarios={signatarios}
          empresa={folhaEmpresa}
          dataHoraAssinatura={dataHoraAssinatura}
          identificadorDocumento={identificadorDocumento}
        />
      )}
    </>
  );
}
