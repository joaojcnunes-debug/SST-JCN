"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { hojeDataPura, intervaloDoMes } from "@/lib/escala/datas";
import type { EscalaFeriado, EscalaUnidadeConfig } from "@/lib/escala/tipos";
import type { TecnicoDeCampo } from "@/lib/dashboard/inspecoes";
import {
  mediaInspecoesPorUnidade,
  type ColaboradorDaMedia,
  type EmpresaDaMedia,
  type InspecaoDaMedia,
  type ProdUnidadeDaMedia,
  type ResultadoMedia,
} from "@/lib/produtividade/media-inspecoes";

/**
 * Inspeções por técnico por dia útil, por unidade — o dado do quadro do
 * Controle Mensal. A conta mora em `lib/produtividade/media-inspecoes`; aqui
 * só se busca e entrega.
 *
 * Sete consultas, uma por fonte. As de inspeção seguem as MESMAS regras do
 * Ver detalhe do dashboard (`app/(app)/dashboard/inspecoes-concluidas`):
 * `responsaveis` inteira (uma inspeção pode ter dois técnicos), contas do
 * painel sem Cliente, e nenhum filtro por coluna que possa ser nula.
 */
export function useMediaInspecoesUnidade(mes: number, ano: number) {
  const { inicio, fim } = intervaloDoMes(ano, mes);
  // Na chave: virou o dia, o mês em curso ganha mais um dia útil no divisor.
  const hoje = hojeDataPura();
  return useQuery<ResultadoMedia>({
    queryKey: ["produtividade", "media-inspecoes", ano, mes, hoje],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const any = sb as any;

      const [inspecoes, responsaveis, contas, empresas, unidades, config, prodUnidades, colaboradores, feriados] =
        await Promise.all([
          fetchAllRows<InspecaoDaMedia>((de, ate) =>
            sb
              .from("inspecoes")
              .select("id_inspecao, status, data_inspecao, concluida_em, created_at, tipo_criacao, id_empresa, responsavel")
              .neq("status", "DELETADA")
              // Data pura: o intervalo é texto contra texto, sem fuso.
              .gte("data_inspecao", inicio)
              .lte("data_inspecao", fim)
              .range(de, ate),
          ),
          fetchAllRows<{ id_inspecao: string; tecnico_responsavel: string | null; id_usuario: string | null }>(
            (de, ate) =>
              sb
                .from("responsaveis")
                .select("id_inspecao, tecnico_responsavel, id_usuario")
                .range(de, ate),
          ),
          sb.from("usuarios").select("id_usuario, nome").neq("perfil", "Cliente"),
          fetchAllRows<EmpresaDaMedia>((de, ate) =>
            sb.from("empresas").select("id_empresa, id_unidade").range(de, ate),
          ),
          sb.from("unidades").select("id_unidade, nome"),
          sb.from("escala_unidade_config").select("id_unidade, municipio"),
          any.from("prod_unidades").select("id, nome, id_unidade_equipe"),
          any.from("prod_colaboradores").select("id_unidade, tipo, ativo"),
          sb.from("escala_feriados").select("*").gte("data", `${ano}-01-01`).lte("data", `${ano}-12-31`),
        ]);

      for (const r of [contas, unidades, config, prodUnidades, colaboradores, feriados]) {
        if (r.error) throw new Error(r.error.message);
      }

      // Aba Responsáveis por inspeção — igual ao Ver detalhe: linha em branco
      // não credita ninguém, mesmo que tenha vínculo.
      const tecnicosDeCampo = new Map<string, TecnicoDeCampo[]>();
      for (const l of responsaveis) {
        const nome = (l.tecnico_responsavel ?? "").trim();
        if (!nome) continue;
        const item = { digitado: nome, idUsuario: l.id_usuario ?? null };
        const atual = tecnicosDeCampo.get(l.id_inspecao);
        if (atual) atual.push(item);
        else tecnicosDeCampo.set(l.id_inspecao, [item]);
      }

      const contasLimpas = ((contas.data ?? []) as { id_usuario: string | null; nome: string | null }[])
        .map((u) => ({ id_usuario: (u.id_usuario ?? "").trim(), nome: (u.nome ?? "").trim() }))
        .filter((u) => u.nome !== "");

      const municipioPor = new Map(
        ((config.data ?? []) as Pick<EscalaUnidadeConfig, "id_unidade" | "municipio">[]).map((c) => [
          c.id_unidade,
          c.municipio,
        ]),
      );

      return mediaInspecoesPorUnidade({
        ano,
        mes,
        inspecoes,
        empresas,
        unidades: ((unidades.data ?? []) as { id_unidade: string; nome: string }[]).map((u) => ({
          id_unidade: u.id_unidade,
          nome: u.nome,
          municipio: municipioPor.get(u.id_unidade) ?? null,
        })),
        prodUnidades: (prodUnidades.data ?? []) as ProdUnidadeDaMedia[],
        colaboradores: (colaboradores.data ?? []) as ColaboradorDaMedia[],
        feriados: (feriados.data ?? []) as unknown as EscalaFeriado[],
        hoje,
        tecnicos: {
          tecnicosDeCampo,
          contas: contasLimpas,
          cadastro: contasLimpas.map((c) => c.nome),
        },
      });
    },
  });
}
