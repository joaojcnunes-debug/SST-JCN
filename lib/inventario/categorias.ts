// Classificação das 3 abas/categorias do Inventário (Equipamentos · Máquinas ·
// Medição).
//
// A partir da v115 a categoria é um CAMPO EXPLÍCITO na tabela
// (`categoria_inventario`), escolhido no cadastro. Esta função lê esse campo; o
// fallback por palavra-chave/dono só existe para itens LEGADOS que ainda não
// tenham a coluna preenchida (a migration v115 já faz o backfill no banco).

import type { Maquina, CategoriaInventario } from "@/lib/supabase/types";
import { CATEGORIA_INVENTARIO_LABELS } from "@/lib/supabase/types";

export type AbaInventario = CategoriaInventario;

/** Ordem e rótulos das abas (mesma ordem pedida: Equipamentos, Máquinas, Medição). */
export const ABAS_INVENTARIO: { id: AbaInventario; label: string }[] = [
  { id: "equipamentos", label: CATEGORIA_INVENTARIO_LABELS.equipamentos },
  { id: "maquinas", label: CATEGORIA_INVENTARIO_LABELS.maquinas },
  { id: "medicoes", label: CATEGORIA_INVENTARIO_LABELS.medicoes },
];

/** Aba mostrada ao abrir o inventário (a que concentra os itens por padrão). */
export const ABA_INVENTARIO_PADRAO: AbaInventario = "maquinas";

// Fallback para itens legados sem `categoria_inventario`. Medição é a mais
// específica (checada primeiro); depois cai no critério de dono
// (interno => equipamentos; cliente => maquinas).
const RX_MEDICAO =
  /medi[çc][aã]o|medi[çc][oõ]es|medidor|calibra|lux[íi]metro|decibel|dos[íi]metro|term[oôó]metro|anem[oô]metro|balan[çc]a/i;
const RX_EQUIPAMENTO =
  /equipamento|ferramenta|mobili|comput|notebook|impressora|ve[íi]culo|el[eé]trico portat/i;

/** Categoria derivada de um item do inventário. Sempre retorna exatamente uma aba. */
export function categoriaInventario(
  m: Pick<
    Maquina,
    "categoria_inventario" | "id_empresa" | "categoria" | "tipo" | "nome"
  >,
): AbaInventario {
  // Campo explícito manda (v115+).
  if (m.categoria_inventario) return m.categoria_inventario;

  // Fallback (dados legados): palavra-chave, depois dono.
  const txt = [m.categoria, m.tipo, m.nome].filter(Boolean).join(" ");
  if (RX_MEDICAO.test(txt)) return "medicoes";
  if (RX_EQUIPAMENTO.test(txt)) return "equipamentos";
  return m.id_empresa == null ? "equipamentos" : "maquinas";
}
