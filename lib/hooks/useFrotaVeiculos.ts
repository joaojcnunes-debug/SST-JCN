"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { gerarId } from "@/lib/utils";
import {
  BUCKET,
  caminhoCapa,
  caminhoCapaThumb,
  prepararImagem,
} from "@/lib/frota/fotos";
import { normalizarPlaca } from "@/lib/frota/placa";
import { erroParaUsuario } from "@/lib/frota/erro";
import { deveAtualizarKm, marcaOrigemKm, type OrigemKm } from "@/lib/frota/km";
import { guardarVeiculosCache, lerVeiculoCache, lerVeiculosCache } from "@/lib/offline/db";
import { ehErroDeRede } from "@/lib/offline/rede";
import {
  COLUNAS_LISTA_VEICULO,
  type FrotaVeiculo,
  type FrotaVeiculoLista,
} from "@/lib/frota/tipos";

/**
 * Dados do módulo Frota — tabela `frota_veiculos`, criada pela v177.
 *
 * Como em `useEquipamentos`, NÃO há filtro por empresa cliente: a frota é da
 * JCN Consultoria e o recorte é por BASE. Quem faz esse recorte é a RLS do banco
 * (`caller_unidades()` dentro de `frota_pode_veiculo`), não uma cláusula montada
 * aqui — a tela não repete uma regra que o banco já garante.
 */

const KEY_LISTA = ["frota_veiculos"] as const;
const KEY_ITEM = (id: string | null | undefined) => ["frota_veiculo", id] as const;

/** Lista enxuta, para a tela de visão geral. */
export function useFrotaVeiculosLista() {
  return useQuery({
    queryKey: [...KEY_LISTA, "lista"] as const,
    // Mesma faixa do resto do projeto: sem isto a lista é refeita a cada foco
    // de janela.
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { data, error } = await supabase
          .from("frota_veiculos")
          .select(COLUNAS_LISTA_VEICULO.join(","))
          .order("placa", { ascending: true });
        if (error) throw error;
        const lista = (data ?? []) as unknown as FrotaVeiculoLista[];
        // Copia para o aparelho enquanto AINDA HÁ REDE. É este momento — o
        // técnico abrindo a frota antes de sair da base — que torna o offline
        // possível mais tarde.
        void guardarVeiculosCache(lista);
        return lista;
      } catch (erro) {
        // Só a queda de rede autoriza servir cópia velha. Erro de permissão ou
        // de dado tem de aparecer: mostrar a lista guardada esconderia que o
        // acesso foi retirado.
        if (!ehErroDeRede(erro)) throw erro;
        const cache = await lerVeiculosCache<FrotaVeiculoLista>();
        if (cache.length === 0) throw erro;
        return [...cache].sort((a, b) => a.placa.localeCompare(b.placa));
      }
    },
  });
}

export function useFrotaVeiculo(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ITEM(id),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      try {
        const { data, error } = await supabase
          .from("frota_veiculos")
          .select("*")
          .eq("id_veiculo", id as string)
          .maybeSingle();
        if (error) throw error;
        const veiculo = (data ?? null) as unknown as FrotaVeiculo | null;
        // O registro COMPLETO, que é o que o assistente de saída precisa: sem
        // ele em cache o técnico não passa do primeiro passo em campo.
        if (veiculo) void guardarVeiculosCache([veiculo]);
        return veiculo;
      } catch (erro) {
        if (!ehErroDeRede(erro)) throw erro;
        const cache = await lerVeiculoCache<FrotaVeiculo>(id as string);
        if (!cache) throw erro;
        return cache;
      }
    },
  });
}

/**
 * O que o formulário preenche.
 *
 * `km_atual`, `km_atual_em` e `km_atual_origem` ficam de fora de propósito: eles
 * NÃO são campos de formulário. Sobem sozinhos quando uma saída ou um
 * abastecimento lança km maior — quem faz isso é `atualizarKmVeiculo()` aqui
 * embaixo. Deixá-los no form permitiria baixar o registro do veículo digitando.
 *
 * `km_cadastro` entra só na criação (ver `useCriarVeiculo`): é gravado uma vez.
 */
export type VeiculoInput = Omit<
  FrotaVeiculo,
  | "id_veiculo"
  | "km_atual"
  | "km_atual_em"
  | "km_atual_origem"
  | "foto_capa_path"
  | "foto_capa_thumb_path"
  | "criado_por"
  | "criado_em"
  | "updated_at"
>;

/** A placa já existe? Consulta pela forma normalizada, igual ao índice único. */
export async function placaJaExiste(placa: string, ignorarId?: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const alvo = normalizarPlaca(placa);
  // Não dá para comparar a expressão do índice no PostgREST, então traz as
  // placas da unidade visível e compara normalizado no cliente. A lista de
  // frota é de dezenas de linhas, não de milhares — cabe.
  const { data, error } = await supabase.from("frota_veiculos").select("id_veiculo,placa");
  if (error) throw error;
  return (data ?? []).some(
    (r: { id_veiculo: string; placa: string }) =>
      normalizarPlaca(r.placa) === alvo && r.id_veiculo !== ignorarId,
  );
}

export function useCriarVeiculo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: VeiculoInput & { capa?: File | null }) => {
      const supabase = createSupabaseBrowserClient();
      const { capa, ...dados } = input;

      if (await placaJaExiste(dados.placa)) {
        // erroParaUsuario, e não `new Error`: `mensagemErro()` só deixa passar a
        // mensagem crua de um erro com code P0001 — em qualquer outro caso ela
        // devolve o texto genérico do toast. Com `new Error`, esta frase (a
        // única que explica o que houve) morria no caminho e a pessoa via
        // "Não foi possível cadastrar o veículo." sem saber que era a placa.
        throw erroParaUsuario(`A placa ${dados.placa} já está cadastrada.`);
      }

      const id_veiculo = gerarId("VEI");
      const { data: { user } } = await supabase.auth.getUser();

      // A capa sobe ANTES do insert: se o upload falhar, não fica veículo
      // apontando para imagem que não existe. O contrário deixaria a lista com
      // quadrado quebrado e ninguém saberia por quê.
      let foto_capa_path: string | null = null;
      let foto_capa_thumb_path: string | null = null;
      if (capa) {
        const preparada = await prepararImagem(capa);
        if (preparada) {
          const pVista = caminhoCapa(id_veiculo);
          const pThumb = caminhoCapaThumb(id_veiculo);
          const [up1, up2] = await Promise.all([
            supabase.storage.from(BUCKET).upload(pVista, preparada.vista, {
              cacheControl: "3600",
              upsert: true,
              contentType: "image/jpeg",
            }),
            supabase.storage.from(BUCKET).upload(pThumb, preparada.thumb, {
              cacheControl: "3600",
              upsert: true,
              contentType: "image/jpeg",
            }),
          ]);
          if (up1.error) throw up1.error;
          // Miniatura é degradação, não erro — mesmo critério da v163.
          if (up2.error) console.warn("Miniatura da capa não gerada:", up2.error.message);
          foto_capa_path = pVista;
          foto_capa_thumb_path = up2.error ? null : pThumb;
        }
      }

      const { data, error } = await supabase
        .from("frota_veiculos")
        .insert({
          ...dados,
          id_veiculo,
          placa: dados.placa.trim(),
          foto_capa_path,
          foto_capa_thumb_path,
          criado_por: user?.email ?? null,
        } as never)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as FrotaVeiculo;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
      toast.success(`Veículo ${v.placa} cadastrado.`);
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível cadastrar o veículo.")),
  });
}

export function useAtualizarVeiculo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id_veiculo: string;
      patch: Partial<VeiculoInput>;
      capa?: File | null;
    }) => {
      const supabase = createSupabaseBrowserClient();

      if (args.patch.placa && (await placaJaExiste(args.patch.placa, args.id_veiculo))) {
        throw erroParaUsuario(
          `A placa ${args.patch.placa} já está cadastrada em outro veículo.`,
        );
      }

      const extra: Record<string, unknown> = {};
      if (args.capa) {
        const preparada = await prepararImagem(args.capa);
        if (preparada) {
          const pVista = caminhoCapa(args.id_veiculo);
          const pThumb = caminhoCapaThumb(args.id_veiculo);
          const [up1, up2] = await Promise.all([
            supabase.storage.from(BUCKET).upload(pVista, preparada.vista, {
              cacheControl: "3600",
              upsert: true,
              contentType: "image/jpeg",
            }),
            supabase.storage.from(BUCKET).upload(pThumb, preparada.thumb, {
              cacheControl: "3600",
              upsert: true,
              contentType: "image/jpeg",
            }),
          ]);
          if (up1.error) throw up1.error;
          if (up2.error) console.warn("Miniatura da capa não gerada:", up2.error.message);
          extra.foto_capa_path = pVista;
          if (!up2.error) extra.foto_capa_thumb_path = pThumb;
        }
      }

      const { data, error } = await supabase
        .from("frota_veiculos")
        .update({ ...args.patch, ...extra, updated_at: new Date().toISOString() } as never)
        .eq("id_veiculo", args.id_veiculo)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as FrotaVeiculo;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
      qc.invalidateQueries({ queryKey: KEY_ITEM(v.id_veiculo) });
      toast.success("Veículo atualizado.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível salvar.")),
  });
}

/**
 * Exclusão SEMPRE pela lixeira, por decisão do operador — "devemos sempre ter o
 * controle, e quero que registre quem apagou o veículo".
 *
 * Os dois requisitos já são atendidos pelo mecanismo que existe, e melhor do que
 * uma coluna faria. `excluirComLixeira` (lib/hooks/useLixeira.ts):
 *   • grava `registros_excluidos.excluido_por` com o e-mail de quem apagou;
 *   • guarda o RETRATO COMPLETO da linha em `dados` (jsonb), o que permite
 *     restaurar; e
 *   • chama `registrarAuditoria` com acao "excluiu".
 *
 * Uma coluna `excluido_por` em `frota_veiculos` seria pior: a linha deixa de
 * existir no DELETE, então a coluna morreria junto com a informação. O registro
 * tem de viver FORA da tabela apagada — e é exatamente onde a lixeira o põe.
 *
 * `rotuloCol: "placa"` é o que faz a entrada na lixeira dizer "RJP-2A45" em vez
 * de "VEI-4F2A9C01": quem procura o que apagou procura pela placa.
 *
 * As fotos no storage FICAM. É o que permite a restauração reabrir as imagens —
 * mesmo critério da v163.
 *
 * ── E POR QUE ELE AGORA RECUSA ANTES DE TENTAR ──────────────────────────────
 * `frota_checklists.id_veiculo` é `on delete restrict` (v177, de propósito:
 * "apagar um veículo que tem histórico de saída é erro"). A lixeira faz DELETE
 * de verdade — o snapshot é uma cópia, não um soft delete. Então o botão
 * Excluir num veículo com qualquer saída registrada SEMPRE ia bater na chave
 * estrangeira e voltar como "Não foi possível excluir", sem dizer por quê. É a
 * mesma cicatriz da v142 (excluir empresa), e ainda não apareceu aqui só porque
 * a base é nova.
 *
 * A decisão do operador foi RECUSAR E EXPLICAR — não cascatear. Veículo com
 * histórico não se apaga: o histórico é justamente o que dá valor ao cadastro
 * (prova de avaria, km rodado, custo). Quem quer tirar o carro da operação usa
 * a situação Vendido ou Inativo, que é o que essas duas situações existem para
 * fazer.
 *
 * A contagem cobre TODAS as filhas, não só a que trava no banco: abastecimento,
 * sinistro e manutenção são `cascade` e sumiriam junto sem aviso, e o snapshot
 * da lixeira guarda só a linha do veículo — restaurar traria o carro de volta
 * sem nada dentro. Recusar é a única resposta que não perde dado.
 */
export type DependenciasVeiculo = {
  saidas: number;
  abastecimentos: number;
  sinistros: number;
  manutencoes: number;
  lotacoes: number;
  /** Fora da soma de propósito — ver `total` logo abaixo. */
  fotos: number;
  /** Só o histórico de OPERAÇÃO. É este número que decide se pode excluir. */
  total: number;
};

/**
 * As cinco que travam, e a que não trava.
 *
 * A galeria fica de fora da soma: foto é retrato do carro, não registro de uso.
 * Um cadastro feito errado hoje de manhã pode perfeitamente ter ganhado três
 * fotos antes de alguém perceber o engano, e recusar a exclusão por causa delas
 * transformaria o "recusar e explicar" em "nunca dá para apagar nada". Os
 * arquivos no storage continuam onde estão de qualquer forma — política do
 * módulo desde a v163.
 */
const CONTAGENS_VEICULO = [
  ["saidas", "frota_checklists", "saída", "saídas", true],
  ["abastecimentos", "frota_abastecimentos", "abastecimento", "abastecimentos", true],
  ["sinistros", "frota_sinistros", "sinistro", "sinistros", true],
  ["manutencoes", "frota_manutencoes", "manutenção", "manutenções", true],
  ["lotacoes", "frota_lotacoes", "mudança de base", "mudanças de base", true],
  ["fotos", "frota_veiculo_fotos", "foto na galeria", "fotos na galeria", false],
] as const;

/** Conta o que está pendurado no veículo. `head: true` não traz linha nenhuma. */
export async function dependenciasDoVeiculo(id_veiculo: string): Promise<DependenciasVeiculo> {
  const supabase = createSupabaseBrowserClient();
  const contagens = await Promise.all(
    CONTAGENS_VEICULO.map(async ([, tabela]) => {
      const { count, error } = await supabase
        .from(tabela)
        .select("*", { count: "exact", head: true })
        .eq("id_veiculo", id_veiculo);
      if (error) throw error;
      return count ?? 0;
    }),
  );

  const dep = Object.fromEntries(
    CONTAGENS_VEICULO.map(([chave], i) => [chave, contagens[i]]),
  ) as Omit<DependenciasVeiculo, "total">;

  const total = CONTAGENS_VEICULO.reduce(
    (soma, [, , , , trava], i) => (trava ? soma + contagens[i] : soma),
    0,
  );
  return { ...dep, total };
}

/** "12 saídas, 3 abastecimentos e 1 sinistro" — a frase que o aviso usa. */
export function descreverDependencias(dep: DependenciasVeiculo): string {
  const partes = CONTAGENS_VEICULO.map(([chave, , singular, plural, trava]) => {
    const n = dep[chave];
    return trava && n > 0 ? `${n} ${n === 1 ? singular : plural}` : null;
  }).filter((p): p is string => p !== null);

  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/** Para a tela avisar ANTES do clique, em vez de o erro chegar depois dele. */
export function useDependenciasVeiculo(id: string | null | undefined) {
  return useQuery({
    queryKey: ["frota_veiculo_dependencias", id] as const,
    enabled: !!id,
    staleTime: 30_000,
    queryFn: () => dependenciasDoVeiculo(id as string),
  });
}

export function useExcluirVeiculo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id_veiculo: string) => {
      const dep = await dependenciasDoVeiculo(id_veiculo);
      if (dep.total > 0) {
        // erroParaUsuario, e não `new Error`: mensagemErro() engole a mensagem
        // de um Error comum e mostra só o fallback. Ver lib/frota/erro.ts.
        throw erroParaUsuario(
          `Este veículo tem ${descreverDependencias(dep)}. O histórico não é apagado junto — ` +
            `é ele que prova avaria, km rodado e custo. Para tirar o carro de operação, mude a ` +
            `situação para Vendido ou Inativo na tela de edição.`,
        );
      }

      await excluirComLixeiraPorId({
        tabela: "frota_veiculos",
        chave: "id_veiculo",
        id: id_veiculo,
        modulo: "frota",
        rotuloCol: "placa",
      });
      return id_veiculo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
      toast.success("Veículo movido para a lixeira.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}

/**
 * Sobe o registro de km do veículo — chamado pela saída e pelo abastecimento.
 *
 * SÓ SOBE, e a condição vive no WHERE, não num if do JavaScript: o `UPDATE`
 * condicional num só statement é atômico, então dois lançamentos simultâneos não
 * se atropelam. Um `select` seguido de `update` teria janela para o menor
 * sobrescrever o maior.
 */
export async function atualizarKmVeiculo(args: {
  id_veiculo: string;
  km: number;
  origem: OrigemKm;
  id_origem: string;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { data: atual, error: errLer } = await supabase
    .from("frota_veiculos")
    .select("km_cadastro,km_atual")
    .eq("id_veiculo", args.id_veiculo)
    .maybeSingle();
  if (errLer) throw errLer;
  if (!atual) return;

  const v = atual as unknown as { km_cadastro: number; km_atual: number | null };
  if (!deveAtualizarKm(v, args.km)) return;

  const { error } = await supabase
    .from("frota_veiculos")
    .update({
      km_atual: args.km,
      km_atual_em: new Date().toISOString(),
      km_atual_origem: marcaOrigemKm(args.origem, args.id_origem),
    } as never)
    .eq("id_veiculo", args.id_veiculo)
    // A trava real: só grava se ainda for maior que o que está lá. Se outra
    // saída passou na frente com km maior, este update não afeta linha nenhuma.
    .or(`km_atual.is.null,km_atual.lt.${args.km}`);
  if (error) throw error;
}
