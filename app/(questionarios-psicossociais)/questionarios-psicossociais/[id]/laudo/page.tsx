"use client";

import React, { useMemo, useState, use } from "react";
import Link from "next/link";
import { BadgeCheck, Download, FileEdit, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { usePdfAssinado, usePdfCongelado } from "@/lib/hooks/usePdfsGerados";
import BotaoAssinarPdf from "@/components/ui/BotaoAssinarPdf";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import AnexosManager from "@/components/anexos/AnexosManager";
import PainelCongelamentoPdf from "@/components/ui/PainelCongelamentoPdf";
import EmpresaInfoPanel from "@/components/empresas/EmpresaInfoPanel";
import QpsTemplate from "@/components/pdf/templates/QpsTemplate";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useUserStore } from "@/lib/store";
import {
  useQpsAllPerguntas,
  useQpsAplicacao,
  useQpsCategorias,
  useQpsProbabilidades,
  useQpsRespondentes,
  useQpsTipos,
} from "@/lib/hooks/useQuestionarios";
import {
  useQpsMonitoramento,
  useQpsPlanoAcao5w2h,
  useQpsPlanoMedidas,
  useQpsRevisao,
} from "@/lib/hooks/useQpsGestao";
import { useTextosPadrao } from "@/lib/hooks/useTextosPadrao";
import { useSignedUrls } from "@/lib/hooks/useSignedUrl";
import { extrairPathStorage } from "@/lib/storage/signed-url";
import { QPS_LAUDO_TABELA, QPS_MODULO_PDF, montarLaudoQps } from "@/lib/qps/laudo";
import { montarValoresVariaveisQps } from "@/lib/qps/variaveis";
import { INSTRUMENTO_QAP } from "@/lib/qps/gestao";
import { ehSupervisor } from "@/lib/hooks/useUsuario";

/**
 * Laudo da QAP (v226) — a barra de ações do DRPS (assinar, gerar, congelar,
 * anexos) e, como prévia, O PRÓPRIO TEMPLATE DO PDF renderizado no navegador
 * com o mesmo `montarLaudoQps`. Não há uma segunda implementação da prévia:
 * o que se vê aqui é o que o Puppeteer imprime (lição da AET: prévia e PDF
 * escritos duas vezes divergem).
 */

const IMG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi;

function srcsDoHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const out = new Set<string>();
  const re = new RegExp(IMG_SRC_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.add(m[2]);
  return [...out];
}

function trocarSrcs(html: string | null | undefined, mapa: Map<string, string>): string | null | undefined {
  if (!html || mapa.size === 0) return html;
  return html.replace(new RegExp(IMG_SRC_RE.source, "gi"), (tag: string, aspas: string, src: string) => {
    const nova = mapa.get(src);
    return nova ? tag.replace(`${aspas}${src}${aspas}`, `${aspas}${nova}${aspas}`) : tag;
  });
}

export default function LaudoQpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUserStore((s) => s.user);
  const isAdmin = ehSupervisor(user); // v229
  const apiPdfUrl = `/api/pdf/qps/${id}`;

  const { data: ap } = useQpsAplicacao(id);
  const { data: empresa } = useEmpresa(ap?.id_empresa);
  const { data: tipos = [] } = useQpsTipos();
  const { data: categorias = [] } = useQpsCategorias(ap?.id_tipo ?? null);
  const { data: perguntas = [] } = useQpsAllPerguntas(ap?.id_tipo ?? null);
  const { data: respondentes = [] } = useQpsRespondentes(id);
  const { data: probabilidades = [] } = useQpsProbabilidades(id);
  const anoMedidas = new Date().getFullYear();
  const { data: planoMedidas = null } = useQpsPlanoMedidas(id, anoMedidas);
  const { data: monitoramentos = [] } = useQpsMonitoramento(id);
  const { data: revisao = null } = useQpsRevisao(id);
  const { data: planoAcaoLinhas = [] } = useQpsPlanoAcao5w2h(id);
  const { data: capitulos = [] } = useTextosPadrao("qps");
  const tipo = tipos.find((t) => t.id_tipo === ap?.id_tipo) ?? null;

  const { pdfAssinado, recarregar } = usePdfAssinado(QPS_LAUDO_TABELA, id);
  const { data: pdfCongelado } = usePdfCongelado(QPS_MODULO_PDF, id);
  const baseCongeladaUrl = pdfCongelado?.pdf_url ?? undefined;
  const [baixando, setBaixando] = useState(false);

  // Imagens do bucket (capa dos capítulos, <img> das conclusões) precisam de
  // URL assinada na tela — o análogo do assinarCapitulos/assinarImagensHtml da rota.
  const srcsBrutas = useMemo(() => {
    const set = new Set<string>();
    for (const c of capitulos) {
      if (c.bg_imagem_url) set.add(c.bg_imagem_url);
      for (const s of srcsDoHtml(c.conteudo)) set.add(s);
    }
    for (const html of Object.values(ap?.conclusoes_por_setor ?? {})) {
      for (const s of srcsDoHtml(html)) set.add(s);
    }
    return [...set].filter((s) => !!extrairPathStorage(s, "fotos"));
  }, [capitulos, ap?.conclusoes_por_setor]);
  const assinadas = useSignedUrls(srcsBrutas, "fotos");
  const mapaSrc = useMemo(() => {
    const m = new Map<string, string>();
    srcsBrutas.forEach((s, i) => {
      const a = assinadas[i]?.data;
      if (a) m.set(s, a);
    });
    return m;
  }, [srcsBrutas, assinadas]);

  const capitulosAssinados = useMemo(
    () =>
      capitulos.map((c) => ({
        ...c,
        bg_imagem_url: c.bg_imagem_url ? (mapaSrc.get(c.bg_imagem_url) ?? c.bg_imagem_url) : c.bg_imagem_url,
        conteudo: trocarSrcs(c.conteudo, mapaSrc) ?? null,
      })),
    [capitulos, mapaSrc],
  );

  const laudo = useMemo(() => {
    if (!ap) return null;
    const conclusoes = ap.conclusoes_por_setor
      ? Object.fromEntries(Object.entries(ap.conclusoes_por_setor).map(([k, v]) => [k, trocarSrcs(v, mapaSrc) ?? ""]))
      : ap.conclusoes_por_setor;
    return montarLaudoQps({
      aplicacao: { ...ap, conclusoes_por_setor: conclusoes ?? null },
      tipo,
      categorias,
      perguntas,
      respondentes,
      probabilidades,
    });
  }, [ap, tipo, categorias, perguntas, respondentes, probabilidades, mapaSrc]);

  const valores = useMemo(
    () =>
      montarValoresVariaveisQps({
        empresa,
        aplicacao: ap,
        tipoNome: tipo?.nome ?? null,
        totalRespondentes: respondentes.length,
        extras: {
          usuario_logado: user?.nome ?? "",
          tipo_relatorio: `${INSTRUMENTO_QAP.sigla} — ${INSTRUMENTO_QAP.nome}`,
          formacao_responsavel: "Psicólogo(a)",
        },
      }),
    [empresa, ap, tipo?.nome, respondentes.length, user?.nome],
  );

  const crp = (ap?.crp ?? "").trim();
  const signatarios: Signatario[] = [
    {
      nomeCompleto: ap?.responsavel ?? "",
      cargo: "Psicólogo(a)",
      registroProfissional: crp ? `CRP ${crp}` : null,
      cpf: null,
      funcaoNoDocumento: "Responsável Técnico — JCN Consultoria SST",
      assinadoDigitalmente: false,
    },
  ];
  const shortId = id.replace(/-/g, "").slice(0, 8);
  const identificadorDocumento = `${INSTRUMENTO_QAP.sigla}-${new Date().getFullYear()}-${shortId}`;

  const planoAcao = planoAcaoLinhas.map((l) => ({
    ordem: l.ordem,
    acao: l.acao,
    justificativa: l.justificativa,
    onde: l.onde,
    prazo: l.prazo,
    responsavel: l.responsavel,
    como: l.como,
    quanto_custa: l.quanto_custa,
    status: l.status,
  }));

  async function handleBaixarPdf() {
    if (!pdfAssinado) return;
    setBaixando(true);
    try {
      await baixarPdfAssinado(pdfAssinado.pdf_path, "laudo-qap-assinado.pdf");
    } catch {
      toast.error("Não foi possível baixar o PDF.");
    } finally {
      setBaixando(false);
    }
  }

  const podeImprimir = !!ap && respondentes.length > 0;
  const temEditaveis = capitulos.some((c) => c.tipo !== "fixo" && c.ativo !== false);
  const registro = {
    tipoDocumento: `${INSTRUMENTO_QAP.sigla} — ${INSTRUMENTO_QAP.nome}`,
    empresaId: ap?.id_empresa ?? undefined,
    empresaNome: empresa?.nome_empresa ?? undefined,
    empresaCnpj: empresa?.cnpj ?? undefined,
    responsavelTecnico: ap?.responsavel ?? undefined,
  };

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold text-gray-900">Laudo {INSTRUMENTO_QAP.sigla}</h1>
        <p className="text-sm text-gray-600">
          {ap?.titulo ?? "Carregando..."}
          {empresa ? ` · ${empresa.nome_empresa}` : ""}
        </p>
      </div>

      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
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
              reAssinatura
              defaultSignatoryName={ap?.responsavel ?? undefined}
              apiPdfUrl={apiPdfUrl}
              baseCongeladaUrl={baseCongeladaUrl}
              tabelaNome={QPS_LAUDO_TABELA}
              docId={id}
              onAssinado={recarregar}
            />
          </>
        ) : (
          <BotaoAssinarPdf
            defaultSignatoryName={ap?.responsavel ?? undefined}
            apiPdfUrl={apiPdfUrl}
            baseCongeladaUrl={baseCongeladaUrl}
            tabelaNome={QPS_LAUDO_TABELA}
            docId={id}
            onAssinado={recarregar}
          />
        )}
        <BotaoGerarPdf
          apiPdfUrl={apiPdfUrl}
          tabelaNome={QPS_LAUDO_TABELA}
          docId={id}
          disabled={!podeImprimir}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
          registrarPdf={{ modulo: QPS_MODULO_PDF, idRelatorio: id, ...registro }}
        />
      </div>

      {!temEditaveis && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 print:hidden">
          <span>
            Este laudo ainda não tem capa, introdução nem metodologia: são capítulos de Texto Padrão do
            módulo QAP (os do DRPS descrevem o DRPS e por isso não foram copiados). Enquanto não existirem,
            o PDF sai só com as seções geradas (identificação, análise por setor, planos, assinatura).
          </span>
          {isAdmin && (
            <Link
              href="/questionarios-psicossociais/texto-padrao"
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              <FileEdit className="size-3.5" /> Texto Padrão da QAP
            </Link>
          )}
        </div>
      )}

      <div className="pt-1 print:hidden">
        <PainelCongelamentoPdf modulo={QPS_MODULO_PDF} idReferencia={id} apiPdfUrl={apiPdfUrl} opts={registro} />
      </div>

      <div className="pt-1 print:hidden">
        <EmpresaInfoPanel empresa={empresa ?? null} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" />
      </div>

      <div className="pt-1 print:hidden">
        <AnexosManager modulo={QPS_MODULO_PDF} idReferencia={id} />
      </div>

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
          Nenhum respondente importado — não é possível gerar o laudo.
        </div>
      ) : laudo ? (
        // Prévia = o template do PDF. Fundo branco fixo de propósito: é uma folha.
        <div className="qps-laudo-previa mx-auto max-w-[210mm] overflow-x-auto rounded border border-gray-300 bg-white p-[12mm] text-gray-900 shadow-sm">
          <style>{`
            .qps-laudo-previa { font-family: Inter, Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.55; color: #111827; }
            .qps-laudo-previa .textos-padrao-capitulo--nova-pagina,
            .qps-laudo-previa .drps-setor-bloco { border-top: 1px dashed #cbd5e1; padding-top: 14px; margin-top: 14px; }
            .qps-laudo-previa .tp-capa { width: 100%; height: auto; aspect-ratio: 210 / 297; }
          `}</style>
          <QpsTemplate
            laudo={laudo}
            empresa={empresa ?? null}
            planoMedidas={planoMedidas}
            monitoramentos={monitoramentos}
            revisao={revisao}
            anoMedidas={anoMedidas}
            capitulos={capitulosAssinados}
            valores={valores}
            signatarios={signatarios}
            folhaEmpresa={empresa ? { razaoSocial: empresa.nome_empresa, cnpj: empresa.cnpj ?? "" } : null}
            dataHoraAssinatura=""
            identificadorDocumento={identificadorDocumento}
            planoAcao={planoAcao}
          />
          <p className="mt-6 text-center text-[9px] text-gray-500">
            Prévia do laudo — o PDF é gerado no servidor com estes mesmos dados. Documento gerado pelo
            SST JCN Consultoria em {new Date().toLocaleDateString("pt-BR")}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
