"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { gerarId } from "@/lib/utils";
import { atualizarKmVeiculo } from "@/lib/hooks/useFrotaVeiculos";
import {
  BUCKET,
  caminhoChecklistAngulo,
  caminhoChecklistExtra,
  prepararImagem,
} from "@/lib/frota/fotos";
import { SLUG_ANGULO, podeFinalizar, mensagemAngulosFaltando } from "@/lib/frota/angulos";
import { erroParaUsuario } from "@/lib/frota/erro";
import type {
  AnguloFoto,
  FrotaChecklist,
  FrotaChecklistFoto,
  FrotaRota,
} from "@/lib/frota/tipos";

/**
 * A SAÍDA — tabela `frota_checklists` (v177), mais as fotos por ângulo e as
 * rotas do trajeto.
 *
 * O rascunho grava a cada passo do assistente: fechar o navegador no meio da
 * captura não perde as fotos já enviadas. É por isso que quase nada é cobrado
 * enquanto o status é RASCUNHO — a cobrança inteira acontece na transição para
 * FINALIZADO, e é ali que o trigger do banco age.
 */

const KEY = ["frota_checklists"] as const;
const KEY_ITEM = (id: string | null | undefined) => ["frota_checklist", id] as const;
const KEY_FOTOS = (id: string | null | undefined) => ["frota_checklist_fotos", id] as const;
const KEY_ROTAS = (id: string | null | undefined) => ["frota_rotas", id] as const;

/** Saídas de um veículo, mais recentes primeiro. */
export function useChecklistsDoVeiculo(idVeiculo: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, "veiculo", idVeiculo] as const,
    enabled: !!idVeiculo,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_checklists")
        .select("*")
        .eq("id_veiculo", idVeiculo as string)
        .order("data_saida", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaChecklist[];
    },
  });
}

/** Todas as saídas — alimenta a aba Viagens de /frota/movimentacoes. */
export function useChecklists(filtros?: { status?: string }) {
  return useQuery({
    queryKey: [...KEY, "todas", filtros?.status ?? ""] as const,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase.from("frota_checklists").select("*");
      if (filtros?.status) q = q.eq("status", filtros.status);
      const { data, error } = await q.order("data_saida", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as FrotaChecklist[];
    },
  });
}

export function useChecklist(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ITEM(id),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_checklists")
        .select("*")
        .eq("id_checklist", id as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as FrotaChecklist | null;
    },
  });
}

export function useChecklistFotos(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_FOTOS(id),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_checklist_fotos")
        .select("*")
        .eq("id_checklist", id as string)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaChecklistFoto[];
    },
  });
}

export function useChecklistRotas(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ROTAS(id),
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_rotas")
        .select("*")
        .eq("id_checklist", id as string)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaRota[];
    },
  });
}

/**
 * Todas as rotas das saídas informadas, de uma vez.
 *
 * A linha do tempo do veículo precisa do PERCURSO, e o percurso mora em
 * `frota_rotas`, filha da saída. Buscar rota por rota daria uma consulta por
 * viagem — vinte viagens, vinte idas ao servidor. Um `in` resolve em uma.
 *
 * A chave da query inclui os ids ordenados: sem ordenar, a mesma lista chegando
 * em ordem diferente viraria duas entradas de cache com o mesmo conteúdo.
 */
export function useRotasDeChecklists(ids: string[]) {
  const chaves = [...ids].sort();
  return useQuery({
    queryKey: [...KEY, "rotas_de", chaves] as const,
    enabled: chaves.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_rotas")
        .select("*")
        .in("id_checklist", chaves)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaRota[];
    },
  });
}

/**
 * Abre o rascunho. Só o indispensável: veículo, unidade, condutor e km.
 *
 * O endereço é NOT NULL no banco, então o rascunho nasce com string vazia e o
 * passo 5 preenche. Parece feio, mas a alternativa era deixar o endereço
 * nullable e perder a garantia de que uma saída FINALIZADA sempre tem destino —
 * e é a saída finalizada que vale como registro.
 */
export function useAbrirSaida() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id_veiculo: string;
      id_unidade: string;
      condutor_nome: string;
      km_saida: number;
      avarias_constatadas?: string | null;
      observacoes?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const id_checklist = gerarId("CHK");

      const { data, error } = await supabase
        .from("frota_checklists")
        .insert({
          ...input,
          id_checklist,
          status: "RASCUNHO",
          endereco_logradouro: "",
          endereco_cidade: "",
          endereco_uf: "",
          criado_por: user?.email ?? null,
        } as never)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as FrotaChecklist;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.setQueryData(KEY_ITEM(c.id_checklist), c);
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível abrir a saída.")),
  });
}

/** Salva o passo atual do rascunho. Chamado a cada avanço do assistente. */
export function useSalvarRascunho() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_checklist: string; patch: Partial<FrotaChecklist> }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_checklists")
        .update({ ...args.patch, updated_at: new Date().toISOString() } as never)
        .eq("id_checklist", args.id_checklist)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as FrotaChecklist;
    },
    onSuccess: (c) => {
      qc.setQueryData(KEY_ITEM(c.id_checklist), c);
      qc.invalidateQueries({ queryKey: KEY });
    },
    // Sem toast de sucesso: o rascunho grava a cada passo, e um toast por passo
    // viraria ruído. Falha, sim, precisa aparecer.
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível salvar o rascunho.")),
  });
}

/**
 * Envia uma foto de ângulo. Sobe thumb + vista, gerados no navegador.
 *
 * Para os quatro ângulos obrigatórios o caminho é FIXO (frente_thumb.jpg…), com
 * upsert: refazer a foto da frente sobrescreve em vez de acumular lixo no
 * bucket. As EXTRA usam o id da foto, porque podem repetir.
 */
export function useEnviarFotoAngulo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_checklist: string; angulo: AnguloFoto; file: File }) => {
      const supabase = createSupabaseBrowserClient();
      const preparada = await prepararImagem(args.file);
      if (!preparada) {
        throw erroParaUsuario("Não foi possível ler esta imagem. Tente outra foto.");
      }

      const id_foto = gerarId("FOT");
      // Ramifica na comparação, não numa variável booleana: só assim o
      // TypeScript sabe que dentro do `else` o ângulo é um dos quatro
      // obrigatórios — e `SLUG_ANGULO` só tem slug para esses. EXTRA não tem
      // nome fixo de propósito: ela pode repetir, então usa o id da foto.
      let pThumb: string;
      let pVista: string;
      if (args.angulo === "EXTRA") {
        pThumb = caminhoChecklistExtra(args.id_checklist, id_foto, "thumb");
        pVista = caminhoChecklistExtra(args.id_checklist, id_foto, "vista");
      } else {
        pThumb = caminhoChecklistAngulo(args.id_checklist, SLUG_ANGULO[args.angulo], "thumb");
        pVista = caminhoChecklistAngulo(args.id_checklist, SLUG_ANGULO[args.angulo], "vista");
      }

      const [up1, up2] = await Promise.all([
        supabase.storage.from(BUCKET).upload(pThumb, preparada.thumb, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        }),
        supabase.storage.from(BUCKET).upload(pVista, preparada.vista, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        }),
      ]);
      if (up1.error) throw up1.error;
      if (up2.error) throw up2.error;

      // Refazer um ângulo obrigatório substitui a linha: o índice único
      // (id_checklist, angulo) where angulo <> 'EXTRA' recusaria a segunda.
      if (args.angulo !== "EXTRA") {
        await supabase
          .from("frota_checklist_fotos")
          .delete()
          .eq("id_checklist", args.id_checklist)
          .eq("angulo", args.angulo);
      }

      const { data, error } = await supabase
        .from("frota_checklist_fotos")
        .insert({
          id_foto,
          id_checklist: args.id_checklist,
          angulo: args.angulo,
          thumb_path: pThumb,
          vista_path: pVista,
          original_path: null,
        } as never)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as FrotaChecklistFoto;
    },
    onSuccess: (f) => qc.invalidateQueries({ queryKey: KEY_FOTOS(f.id_checklist) }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível enviar a foto.")),
  });
}

export function useRemoverFotoChecklist() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_foto: string; id_checklist: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("frota_checklist_fotos")
        .delete()
        .eq("id_foto", args.id_foto);
      if (error) throw error;
      return args;
    },
    onSuccess: (a) => qc.invalidateQueries({ queryKey: KEY_FOTOS(a.id_checklist) }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível remover a foto.")),
  });
}

// ─── Rotas do trajeto (filhas da saída) ─────────────────────────────────────

export function useSalvarRotas() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id_checklist: string;
      rotas: Array<Omit<FrotaRota, "id_rota" | "id_checklist" | "criado_em">>;
    }) => {
      const supabase = createSupabaseBrowserClient();
      // Substitui o conjunto inteiro: o editor de rotas é uma lista que a pessoa
      // reordena e apaga livremente, então diferenciar item por item custaria
      // mais do que regravar meia dúzia de linhas.
      const { error: errDel } = await supabase
        .from("frota_rotas")
        .delete()
        .eq("id_checklist", args.id_checklist);
      if (errDel) throw errDel;

      if (args.rotas.length === 0) return [];

      const linhas = args.rotas.map((r, i) => ({
        ...r,
        id_rota: gerarId("ROT"),
        id_checklist: args.id_checklist,
        ordem: i + 1,
      }));
      const { data, error } = await supabase
        .from("frota_rotas")
        .insert(linhas as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as FrotaRota[];
    },
    onSuccess: (_r, vars) => qc.invalidateQueries({ queryKey: KEY_ROTAS(vars.id_checklist) }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível salvar as rotas.")),
  });
}

/**
 * FINALIZA a saída.
 *
 * A checagem dos quatro ângulos acontece DUAS vezes, de propósito:
 *   • aqui, para dar mensagem amigável antes de tentar; e
 *   • no banco, pelo trigger `frota_exige_4_fotos` da v177, que é a rede para
 *     dois envios simultâneos e para qualquer chamada que não passe por aqui.
 *
 * Se o trigger recusar, a exceção dele chega como erro do update — e é essa que
 * o usuário vê, porque significa que a verificação local estava desatualizada.
 *
 * Depois de finalizar, atualiza o km do veículo. Nesta ordem: se o km falhar, a
 * saída já está registrada e o km é recuperável; o contrário deixaria o registro
 * do veículo andando sem saída que o justifique.
 */
export function useFinalizarSaida() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id_checklist: string;
      id_veiculo: string;
      km_saida: number;
      angulosPresentes: AnguloFoto[];
    }) => {
      if (!podeFinalizar(args.angulosPresentes)) {
        // erroParaUsuario: esta mensagem DIZ QUAIS fotos faltam, e era
        // justamente ela que sumia. `mensagemErro()` engole a mensagem de um
        // Error comum, então o condutor no pátio via só "Não foi possível
        // finalizar a saída" e ficava sem saber que ângulo refazer.
        throw erroParaUsuario(
          mensagemAngulosFaltando(args.angulosPresentes) ?? "Fotos faltando.",
        );
      }

      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("frota_checklists")
        .update({
          status: "FINALIZADO",
          finalizado_em: new Date().toISOString(),
          finalizado_por: user?.email ?? null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_checklist", args.id_checklist)
        .select("*")
        .single();
      if (error) throw error;

      await atualizarKmVeiculo({
        id_veiculo: args.id_veiculo,
        km: args.km_saida,
        origem: "SAIDA",
        id_origem: args.id_checklist,
      });

      return data as unknown as FrotaChecklist;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: KEY_ITEM(c.id_checklist) });
      qc.invalidateQueries({ queryKey: ["frota_veiculos"] });
      qc.invalidateQueries({ queryKey: ["frota_veiculo", c.id_veiculo] });
      toast.success("Saída finalizada.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível finalizar a saída.")),
  });
}

// ─── O RETORNO (v178) — a metade que faltava da saída ───────────────────────

/**
 * As viagens EM ABERTO: saída finalizada que ainda não voltou.
 *
 * É a consulta central do painel — "quem está com o carro agora". O filtro é
 * `status = FINALIZADO and data_retorno is null`, exatamente o índice parcial
 * criado pela v178, então ela custa quase nada mesmo com a tabela cheia.
 *
 * RASCUNHO fica de FORA de propósito. Rascunho não é veículo na rua: é registro
 * que ninguém terminou. Misturar os dois faria o painel dizer que um carro está
 * viajando quando o que houve foi alguém desistir do formulário no meio — e o
 * painel perderia a credibilidade no primeiro caso desses. Rascunho parado tem
 * o alerta dele, separado.
 */
export function useSaidasEmAberto() {
  return useQuery({
    queryKey: [...KEY, "em_aberto"] as const,
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_checklists")
        .select("*")
        .eq("status", "FINALIZADO")
        .is("data_retorno", null)
        .order("data_saida", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaChecklist[];
    },
  });
}

export type RetornoInput = {
  id_checklist: string;
  id_veiculo: string;
  /** Quando o veículo VOLTOU. Não é quando isto está sendo digitado. */
  data_retorno: string;
  /** Opcional: quem lança pode não ter o odômetro em mãos. */
  km_retorno?: number | null;
  avarias_retorno?: string | null;
  retorno_observacao?: string | null;
};

/**
 * Fecha a viagem.
 *
 * O km do retorno é OPCIONAL por decisão do operador — quem registra no sistema
 * não é necessariamente quem fez a rota, e exigir o odômetro faria a pessoa
 * inventar um número para conseguir salvar. Número inventado é pior que campo
 * vazio: ele entra na conta de consumo como se fosse medição.
 *
 * Quando ele VEM, é a leitura mais confiável que o módulo recebe: o carro
 * acabou de encostar. Por isso atualiza o registro do veículo, com a mesma
 * regra de sempre — só sobe.
 *
 * O banco valida o resto (retorno antes da saída, retorno em rascunho): trigger
 * `frota_valida_retorno` da v178. A tela repete as checagens para dar mensagem
 * amigável, mas quem garante é ele.
 */
export function useRegistrarRetorno() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: RetornoInput) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("frota_checklists")
        .update({
          data_retorno: input.data_retorno,
          km_retorno: input.km_retorno ?? null,
          avarias_retorno: input.avarias_retorno ?? null,
          retorno_observacao: input.retorno_observacao ?? null,
          retorno_por: user?.email ?? null,
          retorno_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_checklist", input.id_checklist)
        .select("*")
        .single();
      if (error) throw error;

      if (input.km_retorno != null) {
        await atualizarKmVeiculo({
          id_veiculo: input.id_veiculo,
          km: input.km_retorno,
          origem: "RETORNO",
          id_origem: input.id_checklist,
        });
      }

      return data as unknown as FrotaChecklist;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: KEY_ITEM(c.id_checklist) });
      qc.invalidateQueries({ queryKey: ["frota_veiculos"] });
      qc.invalidateQueries({ queryKey: ["frota_veiculo", c.id_veiculo] });
      toast.success("Retorno registrado. O veículo voltou para a base.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível registrar o retorno.")),
  });
}

/**
 * Reabre a viagem — desfaz um retorno lançado por engano.
 *
 * Existe porque a alternativa seria pior: sem isto, um retorno digitado na linha
 * errada só se corrige apagando a saída inteira, e junto iriam as quatro fotos
 * e o destino. O trigger da v178 limpa os campos do retorno de uma vez quando
 * `data_retorno` volta a ser nula, então não sobra meia informação.
 *
 * O km do veículo NÃO volta atrás — nunca volta, em nenhum caminho do módulo.
 * Se o odômetro subiu por um retorno errado, o número continua lá até um
 * lançamento maior passar por cima. É a decisão da v177 e ela não tem exceção.
 */
export function useReabrirViagem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_checklist: string; id_veiculo: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_checklists")
        .update({ data_retorno: null, updated_at: new Date().toISOString() } as never)
        .eq("id_checklist", args.id_checklist)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as FrotaChecklist;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: KEY_ITEM(c.id_checklist) });
      toast.success("Viagem reaberta. O veículo voltou a constar como fora.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível reabrir a viagem.")),
  });
}

/** Exclusão pela lixeira, como todo o módulo. Rótulo = o condutor. */
export function useExcluirSaida() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id_checklist: string) => {
      await excluirComLixeiraPorId({
        tabela: "frota_checklists",
        chave: "id_checklist",
        id: id_checklist,
        modulo: "frota",
        rotuloCol: "condutor_nome",
      });
      return id_checklist;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Saída movida para a lixeira.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}
