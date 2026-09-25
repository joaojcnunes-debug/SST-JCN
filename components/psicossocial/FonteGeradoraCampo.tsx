"use client";

// Campo "Fontes Geradoras do Risco" da Análise (v262), no DRPS e no QPS:
// múltipla seleção entre as fontes padrão + catálogo, e digitação de fontes
// novas — cada vírgula (ou ;) é uma fonte. As novas também vão para o
// catálogo, para aparecerem em todos os relatórios.

import { useState } from "react";
import ComboTagInline from "@/components/drps/ComboTagInline";
import { opcoesFonte, separarFontes, unicos } from "@/lib/psicossocial/fontes";

export default function FonteGeradoraCampo({
  padrao,
  catalogo,
  valor,
  onChange,
  onNovas,
  disabled = false,
}: {
  /** Texto padrão do tópico/categoria ("a; b; c."). */
  padrao: string | null | undefined;
  /** Fontes do catálogo para este tópico/categoria. */
  catalogo: string[];
  /** Fontes escolhidas agora. */
  valor: string[];
  onChange: (fontes: string[]) => void;
  /** Fontes digitadas que ainda não estavam nas opções — o pai guarda no catálogo. */
  onNovas?: (fontes: string[]) => void;
  disabled?: boolean;
}) {
  const [novo, setNovo] = useState("");
  const opcoes = opcoesFonte(padrao, catalogo);
  const naLista = (s: string) => opcoes.some((o) => o.toLowerCase() === s.toLowerCase());
  const selecionados = valor.filter(naLista);
  const extras = valor.filter((v) => !naLista(v));

  function adicionar() {
    const digitadas = separarFontes(novo);
    if (digitadas.length === 0) return;
    // Digitou algo que já é opção (com outra grafia)? Usa a da lista.
    const resolvidas = digitadas.map((d) => opcoes.find((o) => o.toLowerCase() === d.toLowerCase()) ?? d);
    onChange(unicos([...valor, ...resolvidas]));
    const novas = resolvidas.filter((r) => !naLista(r));
    if (novas.length) onNovas?.(novas);
    setNovo("");
  }

  return (
    <ComboTagInline
      opcoes={opcoes}
      selecionados={selecionados}
      extras={extras}
      novoValor={novo}
      onToggle={(item) =>
        onChange(valor.includes(item) ? valor.filter((v) => v !== item) : [...valor, item])
      }
      onAdd={adicionar}
      onRemoveExtra={(i) => onChange(valor.filter((v) => v !== extras[i]))}
      onNovoValor={setNovo}
      placeholder="Escolher fontes ou digitar (cada vírgula é uma fonte)..."
      vazioLabel="Digite para adicionar — cada vírgula é uma fonte."
      disabled={disabled}
    />
  );
}
