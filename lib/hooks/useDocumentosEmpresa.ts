"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import type { ModuloPermitido } from "@/lib/supabase/types";

/**
 * Página "Documentos" da empresa (08/10): TODOS os documentos da empresa numa
 * lista só, em sequência de data. Decisões dele em 08/10:
 * - todos os tipos, inclusive Apreciação NR-12, Questionários e Investigação;
 * - AEP/AET feitas na aba da inspeção TAMBÉM aparecem (aqui não vale o filtro
 *   da v262 — a página é da empresa, não do módulo), marcadas "da inspeção";
 * - módulo que a conta não tem NÃO some calado: a página avisa que não há
 *   permissão para visualizar (a régua é `modulos_permitidos`, a mesma do hub);
 * - a matriz NÃO puxa os documentos das filiais.
 *
 * Mora na aba "Documentos & Laudos" da ficha da empresa (decisão dele, 08/10:
 * reaproveitar a tela que já existia). A aba antiga listava só `pdfs_gerados`
 * por `empresa_id`: perdia os 97 PDFs de AEP/AET (nascem sem empresa) e todo
 * documento ainda sem PDF. Os 70 PDFs que ela mostrava de documentos JÁ
 * EXCLUÍDOS (medido em 08/10) continuam aqui, em `pdfsAvulsos`.
 *
 * Colunas conferidas na produção em 08/10, tabela a tabela.
 */

export interface DocumentoEmpresa {
  /** Chave única na lista: `<modulo>:<id>`. */
  chave: string;
  id: string;
  modulo: ModuloPermitido;
  tipo: string;
  titulo: string | null;
  /** Data do documento (inspeção, elaboração, acidente…); sem ela, a de criação. */
  data: string | null;
  status: string | null;
  responsavel: string | null;
  /** AEP/AET preenchida na aba da inspeção e ainda não enviada ao módulo. */
  daInspecao: boolean;
  rota: string;
  /** PDF mais recente gerado para este documento (assinado, se houver). */
  pdfUrl: string | null;
  pdfAssinado: boolean;
}

interface Fonte {
  modulo: ModuloPermitido;
  tipo: string;
  tabela: string;
  pk: string;
  dataCol: string;
  criadoCol: string;
  tituloCols?: string[];
  responsavelCol?: string;
  revisaoCol?: string;
  excluirStatus?: string[];
  /** A tabela não tem coluna `status` (Análise de Químicos). */
  semStatus?: boolean;
  /** Tem `id_inspecao` + `enviado_modulo_em` (AEP/AET, v262). */
  vemDaInspecao?: boolean;
  rota: (id: string) => string;
}

export const FONTES_DOCUMENTOS: Fonte[] = [
  { modulo: "painel", tipo: "Inspeção SST", tabela: "inspecoes", pk: "id_inspecao", dataCol: "data_inspecao", criadoCol: "created_at", responsavelCol: "responsavel", revisaoCol: "revisao", excluirStatus: ["DELETADA"], rota: (id) => `/inspecoes/${id}` },
  { modulo: "conformidade", tipo: "Conformidade", tabela: "relatorios_conformidade", pk: "id_relatorio", dataCol: "data_inspecao", criadoCol: "created_at", tituloCols: ["nr_titulo"], responsavelCol: "responsavel", rota: (id) => `/relatorio-conformidade/${id}` },
  { modulo: "nao_conformidade", tipo: "Não Conformidade", tabela: "relatorios_nao_conformidade", pk: "id_relatorio", dataCol: "data_inspecao", criadoCol: "created_at", tituloCols: ["titulo", "nr_titulo"], responsavelCol: "responsavel", rota: (id) => `/relatorio-nao-conformidade/${id}` },
  { modulo: "aep", tipo: "AEP — Ergonomia", tabela: "aep_relatorios", pk: "id_relatorio", dataCol: "data_elaboracao", criadoCol: "created_at", responsavelCol: "responsavel_elaboracao", vemDaInspecao: true, rota: (id) => `/aep/${id}` },
  { modulo: "aet", tipo: "AET — Ergonomia", tabela: "aet_relatorios", pk: "id_relatorio", dataCol: "data_elaboracao", criadoCol: "created_at", responsavelCol: "responsavel_elaboracao", vemDaInspecao: true, rota: (id) => `/aet/${id}` },
  { modulo: "psicossocial", tipo: "DRPS — Psicossocial", tabela: "drps_relatorios", pk: "id_relatorio", dataCol: "data_elaboracao", criadoCol: "created_at", responsavelCol: "responsavel_tecnico", revisaoCol: "revisao", excluirStatus: ["DELETADO", "DELETADA"], rota: (id) => `/psicossocial/${id}` },
  { modulo: "questionarios_psicossociais", tipo: "Questionários", tabela: "qps_aplicacoes", pk: "id_aplicacao", dataCol: "data_elaboracao", criadoCol: "criado_em", tituloCols: ["titulo"], responsavelCol: "responsavel", excluirStatus: ["DELETADO", "DELETADA"], rota: (id) => `/questionarios-psicossociais/${id}` },
  { modulo: "analise_quimicos", tipo: "Análise de Químicos", tabela: "analises_quimicos", pk: "id_analise", dataCol: "created_at", criadoCol: "created_at", tituloCols: ["titulo"], semStatus: true, rota: (id) => `/analise-quimicos/${id}` },
  { modulo: "apreciacao_maquinas", tipo: "Apreciação NR-12", tabela: "apreciacoes_maquinas", pk: "id_apreciacao", dataCol: "data_apreciacao", criadoCol: "created_at", tituloCols: ["titulo"], responsavelCol: "responsavel", rota: (id) => `/apreciacao-maquinas/${id}` },
  { modulo: "investigacao_acidente", tipo: "Investigação de Acidente", tabela: "investigacoes_acidente", pk: "id_investigacao", dataCol: "data_acidente", criadoCol: "created_at", tituloCols: ["acidentado_nome"], responsavelCol: "responsavel_tecnico", excluirStatus: ["DELETADA"], rota: (id) => `/investigacao-acidente/${id}` },
];

export interface DocumentosEmpresaResultado {
  documentos: DocumentoEmpresa[];
  /** Tipos que a conta não tem permissão de visualizar. */
  semPermissao: string[];
  /** Tipos que não carregaram (erro de consulta) — avisados, não escondidos. */
  comErro: string[];
  /**
   * PDFs gravados com esta empresa cujo documento não está na lista — na
   * medição de 08/10, todos de documentos excluídos. Só dos módulos da conta.
   */
  pdfsAvulsos: PdfAvulso[];
}

export interface PdfAvulso {
  id: string;
  tipo: string;
  titulo: string | null;
  data: string;
  responsavel: string | null;
  url: string | null;
  assinado: boolean;
}

/** `pdfs_gerados.modulo` → módulo de `modulos_permitidos` e rótulo. */
const MODULO_DO_PDF: Record<string, { modulo: ModuloPermitido; tipo: string }> = {
  inspecoes: { modulo: "painel", tipo: "Inspeção SST" },
  conformidade: { modulo: "conformidade", tipo: "Conformidade" },
  nao_conformidade: { modulo: "nao_conformidade", tipo: "Não Conformidade" },
  aep: { modulo: "aep", tipo: "AEP — Ergonomia" },
  aet: { modulo: "aet", tipo: "AET — Ergonomia" },
  drps: { modulo: "psicossocial", tipo: "DRPS — Psicossocial" },
  qps: { modulo: "questionarios_psicossociais", tipo: "Questionários" },
  analises_quimicos: { modulo: "analise_quimicos", tipo: "Análise de Químicos" },
  apreciacao_maquinas: { modulo: "apreciacao_maquinas", tipo: "Apreciação NR-12" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function urlDoPdf(p: any): string | null {
  // Bucket privado: a URL é a rota same-origin (igual a usePdfsPorEmpresa).
  const urlArquivo = !p.pdf_storage_path || p.pdf_storage_path.startsWith("pdfs-gerados/")
    ? p.pdf_url
    : `/api/pdf/gerado?path=${encodeURIComponent(p.pdf_storage_path)}`;
  return p.pdf_assinado_url || urlArquivo || null;
}

const LOTE_PDFS = 150;

function texto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function useDocumentosEmpresa(idEmpresa: string | null | undefined) {
  const permitidos = useUserStore((s) => s.user?.modulos_permitidos);
  const chaveModulos = (permitidos ?? []).join("|");
  return useQuery({
    queryKey: ["documentos-empresa", idEmpresa, chaveModulos],
    // Sem a lista de módulos não dá para decidir o que mostrar: espera o perfil.
    enabled: !!idEmpresa && !!permitidos,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<DocumentosEmpresaResultado> => {
      const supabase = createSupabaseBrowserClient();
      const doUsuario = FONTES_DOCUMENTOS.filter((f) => permitidos!.includes(f.modulo));
      const semPermissao = FONTES_DOCUMENTOS.filter((f) => !permitidos!.includes(f.modulo)).map((f) => f.tipo);
      const comErro: string[] = [];

      const porFonte = await Promise.all(
        doUsuario.map(async (f): Promise<DocumentoEmpresa[]> => {
          const cols = Array.from(new Set([
            f.pk, f.dataCol, f.criadoCol,
            ...(f.semStatus ? [] : ["status"]),
            ...(f.tituloCols ?? []),
            ...(f.responsavelCol ? [f.responsavelCol] : []),
            ...(f.revisaoCol ? [f.revisaoCol] : []),
            ...(f.vemDaInspecao ? ["id_inspecao", "enviado_modulo_em"] : []),
          ])).join(", ");
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any)
              .from(f.tabela)
              .select(cols)
              .eq("id_empresa", idEmpresa!);
            if (error) throw error;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return ((data ?? []) as any[])
              .filter((r) => !(f.excluirStatus && r.status && f.excluirStatus.includes(r.status)))
              .map((r) => {
                const id = String(r[f.pk]);
                const tituloLivre = (f.tituloCols ?? []).map((c) => texto(r[c])).find(Boolean) ?? null;
                const revisao = f.revisaoCol && r[f.revisaoCol] != null ? `Rev. ${r[f.revisaoCol]}` : null;
                return {
                  chave: `${f.modulo}:${id}`,
                  id,
                  modulo: f.modulo,
                  tipo: f.tipo,
                  titulo: tituloLivre ?? revisao,
                  data: texto(r[f.dataCol]) ?? texto(r[f.criadoCol]),
                  status: texto(r.status),
                  responsavel: f.responsavelCol ? texto(r[f.responsavelCol]) : null,
                  daInspecao: !!(f.vemDaInspecao && r.id_inspecao && !r.enviado_modulo_em),
                  rota: f.rota(id),
                  pdfUrl: null,
                  pdfAssinado: false,
                };
              });
          } catch {
            comErro.push(f.tipo);
            return [];
          }
        }),
      );
      const documentos = porFonte.flat();

      // PDFs pelo id do documento, e não por `empresa_id`: os PDFs de AET/AEP
      // nascem sem empresa (ver memória pdfs-gerados-empresa-id-nulo) e por
      // `empresa_id` não apareceriam. Fica o mais recente de cada documento.
      const ids = Array.from(new Set(documentos.map((d) => d.id)));
      const pdfPorId = new Map<string, { url: string | null; assinado: boolean; data: string }>();
      for (let i = 0; i < ids.length; i += LOTE_PDFS) {
        const { data } = await supabase
          .from("pdfs_gerados")
          .select("id_relatorio, data_geracao, pdf_url, pdf_assinado_url, pdf_storage_path, assinado")
          .in("id_relatorio", ids.slice(i, i + LOTE_PDFS));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const p of (data ?? []) as any[]) {
          const atual = pdfPorId.get(p.id_relatorio);
          if (atual && atual.data >= p.data_geracao) continue;
          pdfPorId.set(p.id_relatorio, {
            url: urlDoPdf(p),
            assinado: !!p.assinado,
            data: p.data_geracao,
          });
        }
      }
      for (const d of documentos) {
        const pdf = pdfPorId.get(d.id);
        if (pdf) {
          d.pdfUrl = pdf.url;
          d.pdfAssinado = pdf.assinado;
        }
      }

      // PDFs com esta empresa que não casaram com nenhum documento da lista.
      const idsListados = new Set(ids);
      const { data: daEmpresa } = await supabase
        .from("pdfs_gerados")
        .select("id, modulo, tipo_documento, id_relatorio, data_geracao, responsavel_tecnico, pdf_url, pdf_assinado_url, pdf_storage_path, assinado")
        .eq("empresa_id", idEmpresa!)
        .order("data_geracao", { ascending: false });
      const pdfsAvulsos: PdfAvulso[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (daEmpresa ?? []) as any[]) {
        if (p.id_relatorio && idsListados.has(p.id_relatorio)) continue;
        const m = MODULO_DO_PDF[p.modulo];
        // Módulo desconhecido ou fora da conta: não mostra (a régua é a mesma).
        if (!m || !permitidos!.includes(m.modulo)) continue;
        pdfsAvulsos.push({
          id: String(p.id),
          tipo: m.tipo,
          titulo: texto(p.tipo_documento),
          data: p.data_geracao,
          responsavel: texto(p.responsavel_tecnico),
          url: urlDoPdf(p),
          assinado: !!p.assinado,
        });
      }

      // Em sequência: o mais recente primeiro; sem data, no fim.
      documentos.sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return b.data.localeCompare(a.data);
      });

      return { documentos, semPermissao, comErro, pdfsAvulsos };
    },
  });
}
