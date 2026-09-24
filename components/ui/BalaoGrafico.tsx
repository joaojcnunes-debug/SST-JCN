"use client";

/**
 * O BALÃO DOS GRÁFICOS — um desenho só.
 *
 * Havia dois convivendo. O padrão do recharts monta cada linha como
 * "nome : valor", e as telas passavam o nome VAZIO para poder escrever a
 * unidade junto do número. O que aparece na tela, então, é literalmente
 * `: 16 documentos` — com o separador órfão na frente. Foi assim que o Sanmyo
 * viu em 08/09, no dashboard.
 *
 * O outro desenho, escrito à mão nas telas de detalhe, é o certo — e já estava
 * copiado três vezes. Este arquivo é a terceira cópia virando a única.
 *
 * A REGRA DO BALÃO: o mês (ou a pessoa) em negrito no topo, e cada medida numa
 * linha — bolinha da cor da barra, rótulo em texto secundário, número em
 * destaque à direita.
 *
 * ⚠️ A cor fica SÓ na bolinha, nunca no texto. O padrão do recharts pinta a
 * linha inteira com a cor da série, e série clara sobre fundo branco chega a
 * 1,67:1 quando o mínimo legível é 4,5:1 — foi o defeito corrigido na v0.3.571.
 * Pelo mesmo motivo nada aqui usa hex fixo: a camada noturna remapeia CLASSE,
 * não hex inline, e um `#111827` cravado vira preto no preto no escuro.
 */

/** A casca: fundo, borda e o título em negrito. */
export function BalaoGrafico({
  titulo,
  children,
}: {
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[10px] border px-3 py-2 text-xs shadow-sm"
      style={{
        borderColor: "var(--border-app)",
        background: "var(--surface)",
        color: "var(--text-strong)",
      }}
    >
      {titulo && <p className="mb-1 font-semibold">{titulo}</p>}
      {children}
    </div>
  );
}

/** Uma linha: bolinha da cor da barra + rótulo + número. */
export function LinhaBalao({
  texto,
  valor,
  cor,
}: {
  texto: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        <span className="size-2 shrink-0 rounded-full" style={{ background: cor }} />
        {texto}
      </span>
      <span className="font-semibold" style={{ color: "var(--text-strong)" }}>
        {valor}
      </span>
    </div>
  );
}

/**
 * O balão pronto dos gráficos de UMA medida — a maioria deles.
 *
 * Use como `content={<BalaoUmValor rotulo="Documentos" />}`: o recharts clona
 * o elemento e injeta `active`, `payload` e `label`.
 */
export function BalaoUmValor({
  rotulo,
  cor = "#0ea5e9",
  active,
  payload,
  label,
}: {
  /** O que o número É: "Documentos", "Concluídas". Sem unidade colada. */
  rotulo: string;
  cor?: string;
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string;
}) {
  const bruto = active ? payload?.[0]?.value : undefined;
  const valor = typeof bruto === "string" ? Number(bruto) : bruto;
  if (valor == null || Number.isNaN(valor)) return null;
  return (
    <BalaoGrafico titulo={label}>
      <LinhaBalao texto={rotulo} valor={valor} cor={cor} />
    </BalaoGrafico>
  );
}
