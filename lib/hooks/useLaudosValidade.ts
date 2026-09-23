"use client";

import { useMutation, useQuery, useQueryClient, type QueryFunctionContext } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { opcoesNomesDeEmpresas } from "@/lib/empresas/nomes";
import { useUserStore } from "@/lib/store";
import { fontesPermitidas, type TipoLaudo } from "@/lib/validades/fontes";

/**
 * Lista os laudos num lugar só, para cadastrar/editar a `data_validade` inline
 * (tela "Validades de Documentos"). Cada item carrega a tabela/coluna de id pra
 * salvar no registro certo.
 *
 * v0.3.636: varre só as tabelas dos módulos da conta. Antes varria as 9 para
 * todo mundo — era o que ainda vazava depois da v0.3.635 (o Início dizia "Nada
 * pendente" em cima e listava DRPS/AET/AEP com nome de empresa e link logo
 * abaixo), e era 100 % do que o log da trava por módulo continuava anotando.
 * A lista de fontes e a regra moram em `lib/validades/fontes.ts`, com teste.
 */

export type { TipoLaudo } from "@/lib/validades/fontes";

export interface LaudoValidadeItem {
  tipo: TipoLaudo;
  tabela: string;
  idCol: string;
  id: string;
  empresaNome: string | null;
  /** Data de referência do documento (elaboração/inspeção/apreciação/criação). */
  dataDoc: string | null;
  data_validade: string | null;
  href: string;
}

/** A chave. Exportada porque o `useVencimentos` observa esta MESMA entrada. */
export const KEY_LAUDOS_VALIDADE = ["laudos-validade"] as const;

/**
 * Os módulos da conta, ou `null` enquanto o perfil não chegou do banco (o
 * store não é persistido: `user` nasce nulo a cada carregamento).
 */
export function useModulosDaConta(): readonly string[] | null {
  const user = useUserStore((s) => s.user);
  return user ? user.modulos_permitidos ?? [] : null;
}

/**
 * As opções da consulta, separadas do hook para que outro observador possa
 * derivar dela sem disparar uma segunda varredura das tabelas — ver
 * `useVencimentos`, que é exatamente esta lista filtrada por `data_validade`.
 *
 * A lista de módulos entra na CHAVE: duas contas no mesmo navegador (ou uma
 * permissão trocada) não podem reaproveitar o cache uma da outra. Continua
 * começando por `KEY_LAUDOS_VALIDADE`, então o `invalidateQueries` de baixo
 * segue alcançando todas.
 */
export function opcoesLaudosValidade(modulos: readonly string[] | null) {
  const fontes = fontesPermitidas(modulos);
  return {
    queryKey: [...KEY_LAUDOS_VALIDADE, (modulos ?? []).join("|")],
    // Sem saber os módulos não dá para decidir o que varrer — espera o perfil.
    enabled: modulos !== null,
    queryFn: async ({ client }: QueryFunctionContext): Promise<LaudoValidadeItem[]> => {
      const sb = createSupabaseBrowserClient();

      // Mapa compartilhado: três consultas da tela de entrada pediam esta mesma
      // lista, byte a byte igual. Ver lib/empresas/nomes.ts.
      const nomePorEmpresa = await client.fetchQuery(opcoesNomesDeEmpresas());

      const listas = await Promise.all(
        fontes.map(async (f) => {
          let q = sb.from(f.tabela).select(`${f.idCol}, id_empresa, ${f.dataCol}, data_validade`);
          if (f.excluirStatus) q = q.neq("status", f.excluirStatus);
          const { data, error } = await q;
          if (error) return [] as LaudoValidadeItem[];
          return ((data ?? []) as unknown as Record<string, string | null>[]).map((r) => {
            const id = r[f.idCol] as string;
            const idEmpresa = r.id_empresa;
            const dataDocRaw = r[f.dataCol];
            return {
              tipo: f.tipo,
              tabela: f.tabela,
              idCol: f.idCol,
              id,
              empresaNome: idEmpresa ? nomePorEmpresa.get(idEmpresa) ?? null : null,
              dataDoc: dataDocRaw ? dataDocRaw.slice(0, 10) : null,
              data_validade: r.data_validade,
              href: f.href(id),
            };
          });
        }),
      );

      return listas
        .flat()
        .sort((a, b) =>
          (a.empresaNome ?? "~").localeCompare(b.empresaNome ?? "~", "pt-BR") ||
          a.tipo.localeCompare(b.tipo, "pt-BR"),
        );
    },
  };
}

export function useLaudosValidade() {
  const modulos = useModulosDaConta();
  const q = useQuery(opcoesLaudosValidade(modulos));
  // Consulta desligada devolve `isLoading: false` no React Query v5 — para a
  // tela isso pareceria "não há documento" em vez de "ainda estou buscando".
  // Enquanto o perfil não chega, o flag volta a dizer a verdade.
  return modulos === null ? { ...q, isLoading: true } : q;
}

export function useSalvarValidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { tabela: string; idCol: string; id: string; data_validade: string | null }) => {
      const sb = createSupabaseBrowserClient();
      // tabela dinâmica → cliente sem tipagem estática.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (sb.from(p.tabela) as any)
        .update({ data_validade: p.data_validade || null })
        .eq(p.idCol, p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Uma chave só: os vencimentos da Visão geral são um recorte DESTA lista
      // (ver useVencimentos), então invalidar aqui já os atualiza junto. A
      // chave é o PREFIXO, então alcança a entrada de qualquer conjunto de
      // módulos que esteja no cache.
      qc.invalidateQueries({ queryKey: KEY_LAUDOS_VALIDADE });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
