"use client";

import { NIVEIS_ORDENADOS, ROTULO_ALCANCE, eixosDoNivel, rotuloNivel, type GestaoNivel } from "@/lib/gestao/niveis";

/**
 * Escolha do nível de acesso (v304) — agrupado pelo que a pessoa VÊ e, em cada grupo, o que ela
 * FAZ. A opção repete o alcance ("Todas as tarefas · ver e editar") porque o select fechado só
 * mostra a opção, não o grupo. Sem `value` mostra "Escolha o nível…": conceder exige escolher
 * (antes vinha marcado o nível máximo com o rótulo "Visualizador total").
 */
export default function SeletorNivel({
  value,
  onChange,
  disabled,
  title,
  className,
}: {
  value: GestaoNivel | "";
  onChange: (n: GestaoNivel) => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      title={title}
      onChange={(e) => e.target.value && onChange(e.target.value as GestaoNivel)}
      className={className}
    >
      {!value && <option value="">Escolha o nível…</option>}
      {(["todas", "proprias"] as const).map((alcance) => (
        <optgroup key={alcance} label={ROTULO_ALCANCE[alcance]}>
          {NIVEIS_ORDENADOS.filter((n) => eixosDoNivel(n).alcance === alcance).map((n) => (
            <option key={n} value={n}>
              {rotuloNivel(n)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Legenda dos níveis (texto curto para o topo do modal). */
export function LegendaNiveis() {
  return (
    <p className="rounded-md bg-gray-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-600">
      <strong>Nível = o que vê + o que faz.</strong> <em>Todas as tarefas</em> do quadro ou <em>só as próprias</em> (em que a
      pessoa está vinculada ou que criou); e <em>só ver</em>, <em>ver e comentar</em> ou <em>ver e editar</em>. &quot;Todas as
      tarefas · ver e editar&quot; é o nível máximo.
    </p>
  );
}
