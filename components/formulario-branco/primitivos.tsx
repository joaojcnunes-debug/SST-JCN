"use client";

import { type ReactNode, useCallback } from "react";
import { ClipboardPen, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Formulário em Branco — casca e peças de montagem.
 *
 * Usado por `/aet/formulario-branco` e `/aep/formulario-branco`: o técnico
 * imprime o questionário completo do módulo e preenche à mão em campo, para
 * digitar no sistema depois. Cada página monta o SEU conteúdo com estas peças;
 * aqui mora só o que é comum — a barra de tela (imprimir, quantidade de
 * setores), a folha A4 e o CSS de impressão.
 *
 * Regras de impressão que valem para os dois módulos:
 * - `.fb-setor` começa em página nova — um setor por bloco, fácil de grampear;
 * - linha de tabela nunca quebra no meio (`.fb-tabela tr`), bloco marcado com
 *   `.fb-avoid` também não;
 * - a barra de tela some no papel (`print:hidden`), a folha perde sombra e
 *   margem porque `@page` já dá a margem.
 */

// ─── Casca ────────────────────────────────────────────────────────────────────

export const OPCOES_N_SETORES = [1, 2, 3, 4, 5] as const;

export function FormularioBrancoShell({
  sigla,
  titulo,
  descricao,
  nSetores,
  onNSetoresChange,
  children,
}: {
  /** "AET" ou "AEP" — vai no cabeçalho da folha e no título do PDF. */
  sigla: string;
  titulo: string;
  descricao: string;
  nSetores: number;
  onNSetoresChange: (n: number) => void;
  children: ReactNode;
}) {
  const imprimir = useCallback(() => {
    // Mesmo truque da página de Ajuda: um tick para o React assentar antes do
    // diálogo de impressão congelar a árvore.
    setTimeout(() => window.print(), 100);
  }, []);

  return (
    <div className="space-y-6">
      <style>{CSS}</style>

      {/* Barra de tela */}
      <div className="print:hidden flex flex-wrap items-start justify-between gap-4 max-w-[210mm] mx-auto">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <ClipboardPen className="size-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{titulo}</h1>
            <p className="mt-1 text-sm text-gray-500 max-w-xl">{descricao}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            Setores por impressão
            <select
              value={nSetores}
              onChange={(e) => onNSetoresChange(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {OPCOES_N_SETORES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={imprimir}
            className="shrink-0 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <Printer className="size-4" />
            Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      {/* Folha */}
      <div className="fb-folha mx-auto max-w-[210mm] rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="fb-cabecalho">
          <div className="fb-cabecalho-sigla">{sigla}</div>
          <div>
            <div className="fb-cabecalho-titulo">{titulo}</div>
            <div className="fb-cabecalho-sub">Formulário de campo para preenchimento manual · JCN Consultoria</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Peças ────────────────────────────────────────────────────────────────────

/** Seção numerada com a barra verde de título. */
export function FbSecao({
  numero,
  titulo,
  nota,
  children,
  className,
}: {
  numero?: string | number;
  titulo: string;
  nota?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("fb-secao", className)}>
      <div className="fb-secao-titulo">
        {numero !== undefined && <span className="fb-secao-numero">{numero}.</span>}
        {titulo}
      </div>
      {nota && <p className="fb-nota" style={{ margin: "4px 0 5px" }}>{nota}</p>}
      {children}
    </section>
  );
}

/** Cabeçalho de bloco de setor — cada um começa em página nova. */
export function FbSetor({
  indice,
  total,
  children,
}: {
  indice: number;
  total: number;
  children: ReactNode;
}) {
  return (
    <div className="fb-setor">
      <div className="fb-setor-faixa">
        <span>Setor {indice} de {total}</span>
        <span className="fb-setor-faixa-campo">Nome do setor: <span className="fb-campo-linha" /></span>
      </div>
      {children}
    </div>
  );
}

/** Grade de campos "rótulo + linha". */
export function FbCampos({ colunas = 2, children }: { colunas?: 1 | 2 | 3 | 4; children: ReactNode }) {
  return (
    <div className="fb-campos" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

/** Um campo de uma linha: rótulo em caixa alta + linha para escrever. */
export function FbCampo({ label, span }: { label: string; span?: number }) {
  return (
    <div className="fb-campo" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <span className="fb-campo-label">{label}</span>
      <span className="fb-campo-linha" />
    </div>
  );
}

/** Quadradinho de marcar, com rótulo opcional ao lado. */
export function FbCaixa({ label, etiqueta }: { label?: ReactNode; etiqueta?: string }) {
  return (
    <span className="fb-opcao">
      <span className="fb-caixa" aria-hidden />
      {label !== undefined && <span>{label}</span>}
      {etiqueta && <span className="fb-etiqueta">{etiqueta}</span>}
    </span>
  );
}

/** Lista horizontal de opções marcáveis (rádio ou múltipla escolha). */
export function FbOpcoes({ opcoes, titulo }: { opcoes: string[]; titulo?: string }) {
  return (
    <div className="fb-opcoes">
      {titulo && <span className="fb-campo-label" style={{ marginRight: 6 }}>{titulo}</span>}
      {opcoes.map((o) => (
        <FbCaixa key={o} label={o} />
      ))}
    </div>
  );
}

/** N linhas pautadas para texto livre. */
export function FbLinhas({ n = 4, label }: { n?: number; label?: string }) {
  return (
    <div className="fb-avoid">
      {label && <div className="fb-campo-label" style={{ marginBottom: 2 }}>{label}</div>}
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="fb-linha-livre" />
      ))}
    </div>
  );
}

/** Tabela com a moldura padrão; o chamador escreve thead/tbody. */
export function FbTabela({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn("fb-tabela", className)}>{children}</table>;
}

/** N linhas vazias de `colunas` células — para tabelas que o técnico preenche. */
export function FbLinhasVazias({
  n,
  colunas,
  altura = 24,
}: {
  n: number;
  colunas: number;
  altura?: number;
}) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: colunas }, (_, j) => (
            <td key={j} style={{ height: altura }} />
          ))}
        </tr>
      ))}
    </>
  );
}

/** Legenda de siglas (N/A, N/I…) no pé de um bloco. */
export function FbLegenda({ itens }: { itens: { sigla: string; titulo: string; texto: string }[] }) {
  return (
    <div className="fb-legenda">
      {itens.map((l) => (
        <div key={l.sigla}>
          <strong>{l.sigla}</strong> — <strong>{l.titulo}</strong>: {l.texto}
        </div>
      ))}
    </div>
  );
}

/** Bloco final de data e assinatura. */
export function FbAssinatura({ papel = "Responsável técnico" }: { papel?: string }) {
  return (
    <div className="fb-assinatura fb-avoid">
      <div className="fb-campo" style={{ maxWidth: 220 }}>
        <span className="fb-campo-label">Local e data</span>
        <span className="fb-campo-linha" />
      </div>
      <div className="fb-assinatura-linha">
        <div className="fb-campo-linha" style={{ height: 28 }} />
        <div className="fb-nota" style={{ textAlign: "center", marginTop: 2 }}>{papel} — assinatura e registro</div>
      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
.fb-folha { color: #111827; font-size: 10.5px; line-height: 1.35; }
.fb-cabecalho {
  display: flex; align-items: center; gap: 12px;
  background: linear-gradient(180deg, #0ea5e9 0%, #00563f 100%);
  color: #fff; padding: 10px 14px; border-radius: 6px;
}
.fb-cabecalho-sigla {
  font-size: 22px; font-weight: 800; letter-spacing: .06em;
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.35);
  border-radius: 6px; padding: 4px 10px;
}
.fb-cabecalho-titulo { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.fb-cabecalho-sub { font-size: 9.5px; opacity: .85; margin-top: 2px; }

.fb-secao { margin-top: 12px; }
.fb-secao-titulo {
  background: #0ea5e9; color: #fff; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; font-size: 10.5px; padding: 5px 9px; border-radius: 3px 3px 0 0;
}
.fb-secao-numero { display: inline-block; min-width: 18px; opacity: .8; }
.fb-sub {
  background: #eef7f2; color: #1e4d28; font-weight: 700; font-size: 9.5px;
  text-transform: uppercase; letter-spacing: .04em; padding: 4px 8px;
  border: 1px solid #94a3b8; border-bottom: 0; margin-top: 6px;
}

.fb-setor { margin-top: 14px; }
.fb-setor-faixa {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  border: 2px solid #0ea5e9; border-radius: 4px; padding: 6px 10px;
  font-weight: 800; font-size: 11.5px; color: #0ea5e9; text-transform: uppercase; letter-spacing: .05em;
}
.fb-setor-faixa-campo {
  display: flex; align-items: flex-end; gap: 6px; flex: 1; max-width: 420px;
  font-weight: 600; font-size: 9.5px; color: #475569; text-transform: none; letter-spacing: 0;
}

.fb-campos { display: grid; gap: 6px 14px; padding: 8px 8px 6px; border: 1px solid #94a3b8; border-top: 0; }
.fb-secao > .fb-campos:first-of-type { border-top: 0; }
.fb-campo { display: flex; align-items: flex-end; gap: 6px; min-height: 20px; }
.fb-campo-label {
  font-size: 8.5px; text-transform: uppercase; color: #475569; font-weight: 700;
  white-space: nowrap; letter-spacing: .04em;
}
.fb-campo-linha { flex: 1; display: block; border-bottom: 1px solid #64748b; height: 15px; min-width: 40px; }
.fb-linha-livre { border-bottom: 1px solid #94a3b8; height: 21px; }
.fb-bloco { border: 1px solid #94a3b8; border-top: 0; padding: 6px 8px; }

.fb-tabela { border-collapse: collapse; width: 100%; font-size: 9.8px; }
.fb-tabela th, .fb-tabela td { border: 1px solid #94a3b8; padding: 3px 6px; vertical-align: top; }
.fb-tabela th {
  background: #f0f9f4; color: #1e4d28; font-weight: 700; text-align: left;
  font-size: 8.5px; letter-spacing: .04em; text-transform: uppercase;
}
.fb-tabela th.fb-check, .fb-tabela td.fb-check { text-align: center; width: 34px; padding-left: 2px; padding-right: 2px; }
.fb-tabela td.fb-check .fb-caixa { margin: 0; }
.fb-tabela td.fb-obs { min-width: 120px; }
.fb-tabela .fb-th-opcoes { font-weight: 500; text-transform: none; letter-spacing: 0; color: #475569; display: block; font-size: 8px; margin-top: 1px; }

.fb-opcao { display: inline-flex; align-items: center; gap: 3px; margin-right: 10px; white-space: nowrap; }
.fb-opcoes { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; padding: 4px 0; }
.fb-caixa {
  display: inline-block; width: 11px; height: 11px; border: 1.3px solid #334155;
  border-radius: 2px; background: #fff; flex: none;
}
.fb-etiqueta {
  font-size: 7.5px; border: 1px solid #cbd5e1; border-radius: 999px; padding: 0 4px;
  color: #64748b; margin-left: 2px; line-height: 1.4;
}
.fb-nota { font-size: 8.8px; color: #64748b; font-style: italic; }
.fb-legenda { font-size: 8.8px; color: #475569; padding: 4px 8px; border: 1px solid #94a3b8; border-top: 0; background: #f8fafc; }

.fb-sinais, .fb-tabela td.fb-sinais { padding: 4px 8px 5px 22px; background: #fff7f7; }
.fb-sinais-titulo { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #991b1b; letter-spacing: .04em; margin-bottom: 2px; }
.fb-sinais-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 14px; }
.fb-sinais-grid .fb-opcao { white-space: normal; align-items: flex-start; margin-right: 0; }
.fb-sinais-grid .fb-caixa { margin-top: 2px; }

.fb-assinatura { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-top: 22px; }
.fb-assinatura-linha { flex: 1; max-width: 300px; }

@media print {
  @page { size: A4 portrait; margin: 1.2cm 1.1cm 1.3cm; }
  .fb-folha { box-shadow: none !important; padding: 0 !important; max-width: none !important; border: 0 !important; border-radius: 0 !important; }
  .fb-setor { break-before: page; page-break-before: always; margin-top: 0; }
  .fb-tabela tr, .fb-avoid, .fb-campos { break-inside: avoid; page-break-inside: avoid; }
  .fb-secao-titulo, .fb-sub { break-after: avoid; page-break-after: avoid; }
  thead { display: table-header-group; }
}
`;
