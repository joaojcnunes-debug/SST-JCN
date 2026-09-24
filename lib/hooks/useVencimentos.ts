"use client";

import { useQuery } from "@tanstack/react-query";
import {
  opcoesLaudosValidade,
  useModulosDaConta,
  type LaudoValidadeItem,
} from "@/lib/hooks/useLaudosValidade";
import { derivarVencimentos } from "@/lib/vencimentos/derivar";

/**
 * Agrega os laudos que têm `data_validade` informada e classifica por
 * vencimento: vencidos (data < hoje) e vencendo (hoje .. +60 dias). Usado na
 * seção "Vencimentos" da Visão geral. Respeita o RLS do usuário e, desde a
 * v0.3.636, só enxerga os módulos da conta (`lib/validades/fontes.ts`) — esta
 * lista mostrava título de empresa e link de documento de módulo alheio.
 *
 * NÃO BUSCA NADA. Observa a MESMA entrada de cache do `useLaudosValidade` e
 * recorta o que precisa no `select` — os dois varriam as mesmas tabelas, e
 * na tela de entrada, onde rodam juntos, isso custava 10 requisições repetidas.
 * A conta de vencido/vencendo mora em `lib/vencimentos/derivar.ts`, com teste.
 */
export type { VencimentoItem, VencimentosData } from "@/lib/vencimentos/derivar";

/**
 * Identidade ESTÁVEL, no escopo do módulo. Uma seta inline aqui seria uma
 * função nova a cada render, e o TanStack reexecutaria o `select` sobre a
 * lista inteira toda vez — o mesmo tipo de armadilha que fazia o cursor pular
 * nos modais.
 */
const paraVencimentos = (laudos: LaudoValidadeItem[]) => derivarVencimentos(laudos);

export function useVencimentos() {
  const modulos = useModulosDaConta();
  const q = useQuery({
    ...opcoesLaudosValidade(modulos),
    select: paraVencimentos,
  });
  // Mesma espera do `useLaudosValidade`: consulta desligada não é lista vazia.
  return modulos === null ? { ...q, isLoading: true } : q;
}
