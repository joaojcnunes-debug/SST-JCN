/**
 * "Exportar Excel" das páginas por empresa do Painel SST (2026-10-09):
 * Riscos Psicossociais › empresa e AEP › empresa. Fica ao lado do Exportar PDF
 * (a v0.3.733 trocou um pelo outro; a v0.3.734 voltou o PDF e manteve os dois).
 *
 * Montado no navegador com os dados que a tela JÁ carregou (mesmo padrão da
 * Auditoria e dos Equipamentos) — o que sai no arquivo é o que está na tela.
 *
 * Duas abas:
 *   1. a tabela, UMA LINHA POR RISCO/FATOR, com avaliação e setor repetidos em
 *      cada linha — é o que deixa filtrar no Excel ("todos os Altos", "só o
 *      setor X"). Medidas e agravos, que na tela são do setor, repetem também.
 *   2. "Empresa": o cadastro, como no topo da página.
 *
 * A "Confiança" da evidência da AEP fica fora: na tela ela é de uso interno.
 */

import * as XLSX from "xlsx";
import { dataBR, type AvaliacaoSinalizada, type LeituraQuestionario } from "@/lib/aep/sinalizacao";
import type { AvaliacaoRisco } from "@/lib/riscos-psicossociais/carregar";

/** Limite de caracteres de uma célula do Excel; acima disso o arquivo abre com erro. */
const LIMITE_CELULA = 32767;

type Celula = string | number;

function texto(valor: string | null | undefined): string {
  const t = (valor ?? "").trim();
  return t.length > LIMITE_CELULA ? t.slice(0, LIMITE_CELULA - 40) + " … [cortado: passou do limite do Excel]" : t;
}

/** Lista da tela numa célula: um item por linha. */
function lista(itens: string[]): string {
  return texto(itens.join("\n"));
}

/** Cadastro da empresa como a página mostra: [rótulo, valor]. */
export type CadastroXlsx = Array<[string, string | null | undefined]>;

function agora(): string {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Nome de arquivo sem acento nem símbolo: "Padaria São João" → "padaria-sao-joao". */
function slug(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "empresa"
  );
}

function abaTabela(colunas: Celula[], linhas: Celula[][], larguras: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([colunas, ...linhas]);
  ws["!cols"] = larguras.map((wch) => ({ wch }));
  if (linhas.length > 0) ws["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(colunas.length - 1)}${linhas.length + 1}` };
  return ws;
}

function abaEmpresa(titulo: string, nomeEmpresa: string, cadastro: CadastroXlsx): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([
    [titulo],
    [nomeEmpresa],
    [`Gerado em ${agora()}`],
    [],
    ...cadastro.map(([rotulo, valor]) => [rotulo, texto(valor) || "—"]),
  ]);
  ws["!cols"] = [{ wch: 24 }, { wch: 80 }];
  return ws;
}

// ─── Riscos Psicossociais (DRPS / Questionário) ─────────────────────────────

const STATUS_RISCOS: Record<string, string> = { CONCLUIDO: "Concluído", ENVIADO_CLIENTE: "Enviado ao cliente" };

export function montarXlsxRiscosPsicossociais(nomeEmpresa: string, cadastro: CadastroXlsx, avaliacoes: AvaliacaoRisco[]): XLSX.WorkBook {
  const colunas: Celula[] = [
    "Fonte", "Avaliação", "Situação", "Data", "Responsável", "Setor", "Respondentes",
    "Risco", "Resultado final", "Fonte geradora", "Medidas de controle recomendadas", "Possíveis agravos à saúde mental",
  ];
  const linhas: Celula[][] = [];
  for (const a of avaliacoes) {
    const av: Celula[] = [a.fonte, texto(a.titulo), STATUS_RISCOS[a.status] ?? a.status, dataBR(a.data), texto(a.responsavel)];
    for (const s of a.setores) {
      const medidas = lista(s.medidas) || "Não informado";
      const agravos = lista(s.agravos) || "Não informado";
      for (const f of s.fatores) {
        linhas.push([...av, texto(s.setor), s.respondentes, texto(f.nome), f.nivel, texto(f.fonteGeradora) || "—", medidas, agravos]);
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, abaTabela(colunas, linhas, [13, 34, 18, 11, 24, 28, 12, 34, 14, 34, 50, 50]), "Riscos por setor");
  XLSX.utils.book_append_sheet(wb, abaEmpresa("RISCOS PSICOSSOCIAIS", nomeEmpresa, cadastro), "Empresa");
  return wb;
}

export function baixarXlsxRiscosPsicossociais(nomeEmpresa: string, cadastro: CadastroXlsx, avaliacoes: AvaliacaoRisco[]) {
  XLSX.writeFile(montarXlsxRiscosPsicossociais(nomeEmpresa, cadastro, avaliacoes), `riscos-psicossociais-${slug(nomeEmpresa)}.xlsx`);
}

// ─── AEP (fatores psicossociais na matriz AIHA) ──────────────────────────────

const STATUS_AEP: Record<string, string> = { RASCUNHO: "Rascunho", EM_ANDAMENTO: "Em andamento", CONCLUIDO: "Concluída" };

export interface AvaliacaoAepXlsx extends AvaliacaoSinalizada {
  /** Leitura do DRPS/Questionário diante desta AEP (a mesma da tela). */
  questionario: LeituraQuestionario;
}

export function montarXlsxAepPsicossocial(nomeEmpresa: string, cadastro: CadastroXlsx, avaliacoes: AvaliacaoAepXlsx[]): XLSX.WorkBook {
  const colunas: Celula[] = [
    "Entregue ao cliente", "Inspeção", "Realizada por", "Enviada por", "DRPS/Questionário", "AET",
    "Setor", "Maior nível do setor", "Fator de risco", "Resultado final", "Probabilidade", "Severidade", "Sinais observados", "Observação",
  ];
  const linhas: Celula[][] = [];
  for (const a of avaliacoes) {
    const questionario = [a.questionario.rotulo, a.questionario.detalhe].filter(Boolean).join(" — ");
    const av: Celula[] = [
      a.data ? dataBR(a.data) : (STATUS_AEP[a.status] ?? a.status),
      a.idInspecao ?? "Sem inspeção",
      texto(a.responsavel) || "—",
      a.idInspecao ? texto(a.enviadoPor) || "—" : "Sem inspeção",
      texto(questionario),
      a.precisaAet ? "Necessária" : "Não",
    ];
    for (const s of a.setores) {
      for (const f of s.fatores) {
        linhas.push([
          ...av,
          texto(s.nome),
          s.pior ?? "—",
          texto(f.label),
          f.nivel ?? "Não calculado",
          f.probabilidade ?? "—",
          f.severidade ?? "—",
          lista(f.sinais) || "Nenhum sinal marcado",
          texto(f.observacao),
        ]);
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, abaTabela(colunas, linhas, [14, 16, 24, 24, 40, 11, 28, 14, 34, 14, 14, 14, 50, 40]), "Fatores por setor");
  XLSX.utils.book_append_sheet(wb, abaEmpresa("AEP — FATORES PSICOSSOCIAIS", nomeEmpresa, cadastro), "Empresa");
  return wb;
}

export function baixarXlsxAepPsicossocial(nomeEmpresa: string, cadastro: CadastroXlsx, avaliacoes: AvaliacaoAepXlsx[]) {
  XLSX.writeFile(montarXlsxAepPsicossocial(nomeEmpresa, cadastro, avaliacoes), `aep-psicossocial-${slug(nomeEmpresa)}.xlsx`);
}
