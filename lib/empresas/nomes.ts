import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * O MAPA `id_empresa → nome_empresa`, buscado UMA vez por carregamento.
 *
 * POR QUE ISTO EXISTE. Três consultas diferentes da tela de entrada pediam
 * `empresas?select=id_empresa,nome_empresa` — a captura de rede de 01/09
 * mostrou as três requisições BYTE A BYTE IGUAIS, todas 200. Não era erro, era
 * desperdício: cada uma montava o mesmo mapa para traduzir o id da empresa no
 * nome que aparece na tela.
 *
 * Agora as consumidoras chamam `client.fetchQuery(opcoesNomesDeEmpresas())`
 * dentro da própria `queryFn`. Sendo a mesma chave, o TanStack junta as
 * chamadas simultâneas numa requisição só e as seguintes saem do cache.
 *
 * 🪤 FALHA EM SILÊNCIO, DE PROPÓSITO. Devolve mapa vazio em vez de lançar, que
 * é exatamente o que as três faziam (`empRes.data ?? []`). Sem RLS para ler
 * `empresas`, a lista continua aparecendo — só que sem o nome da empresa. Um
 * `throw` aqui derrubaria a tela inteira e ainda mostraria um toast vermelho.
 */

export const KEY_EMPRESAS_NOMES = ["empresas", "nomes"] as const;

export function opcoesNomesDeEmpresas() {
  return {
    queryKey: KEY_EMPRESAS_NOMES,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, string>> => {
      const sb = createSupabaseBrowserClient();
      const { data } = await sb.from("empresas").select("id_empresa, nome_empresa");
      const mapa = new Map<string, string>();
      for (const e of (data ?? []) as { id_empresa: string; nome_empresa: string }[]) {
        mapa.set(e.id_empresa, e.nome_empresa);
      }
      return mapa;
    },
  };
}
