"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";
import type {
  ColaboradorChabra,
  EquipamentoDevolucao,
  EquipamentoDevolucaoItem,
  EquipamentoEntrega,
  EquipamentoEntregaItem,
  EstadoRetorno,
} from "@/lib/supabase/types";

/**
 * Entrega e devolução de equipamento a colaborador — a metade que faltava.
 *
 * O BANCO JÁ ESTAVA PRONTO E NINGUÉM SABIA. As tabelas `colaboradores_chabra`,
 * `equipamentos_entregas(+itens+assinaturas)` e `equipamentos_devolucoes(+itens)`
 * e as RPCs `equipamento_registrar_entrega` / `equipamento_registrar_devolucao`
 * foram aplicadas em produção com as v166/v167. Uma busca por qualquer um
 * desses nomes em `app/`, `components/` e `lib/` devolvia ZERO ocorrências: o
 * backend inteiro estava sem porta de entrada, e por isso `equipamentos_entregas`
 * tinha 0 linhas enquanto `equipamentos` tinha 115.
 *
 * ⚠️ A REGRA QUE MAIS SURPREENDE quem lê a tela: a validação de verdade está na
 * RPC, não aqui. Ela recusa colaborador de outra base, aparelho que já está com
 * alguém, saldo insuficiente e devolução avariada sem descrição. Este arquivo
 * repete algumas dessas checagens só para o erro aparecer ANTES do envio — a
 * palavra final é sempre do banco, que é quem enxerga o estado de agora.
 */

const KEY_COLAB = ["colaboradores-chabra"] as const;
const KEY_ENTREGAS = ["equipamentos-entregas"] as const;
const KEY_DEVOLUCOES = ["equipamentos-devolucoes"] as const;

/** Mesma faixa do resto do módulo: sem isto a lista refaz a cada foco de janela. */
const STALE = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Roster de colaboradores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pessoas que podem receber equipamento numa base.
 *
 * NÃO é a tabela `usuarios`. O roster existe justamente para quem não tem login
 * no painel — que é a maioria de quem retira equipamento. Quem tem login também
 * entra aqui, como pessoa, não como credencial.
 */
export function useColaboradores(idUnidade: string | null | undefined, apenasAtivos = true) {
  return useQuery({
    queryKey: [...KEY_COLAB, idUnidade ?? "TODAS", apenasAtivos] as const,
    staleTime: STALE,
    queryFn: async (): Promise<ColaboradorChabra[]> => {
      const sb = createSupabaseBrowserClient();
      let q = sb.from("colaboradores_chabra").select("*").order("nome");
      if (idUnidade) q = q.eq("id_unidade", idUnidade);
      if (apenasAtivos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ColaboradorChabra[];
    },
  });
}

export type ColaboradorInput = {
  id_unidade: string;
  nome: string;
  cpf?: string | null;
  matricula?: string | null;
  cargo?: string | null;
  setor?: string | null;
  email?: string | null;
};

export function useCriarColaborador() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (input: ColaboradorInput): Promise<string> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("colaboradores_chabra")
        .insert({ ...input, criado_por: user?.email ?? null } as never)
        .select("id_colaborador")
        .single();
      if (error) throw error;
      return (data as unknown as { id_colaborador: string }).id_colaborador;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_COLAB });
      toast.success("Colaborador cadastrado.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível cadastrar o colaborador.")),
  });
}

export function useAtualizarColaborador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_colaborador: string; patch: Partial<ColaboradorInput> & { ativo?: boolean } }) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("colaboradores_chabra")
        .update({ ...p.patch, updated_at: new Date().toISOString() } as never)
        .eq("id_colaborador", p.id_colaborador);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_COLAB });
      toast.success("Colaborador atualizado.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível atualizar o colaborador.")),
  });
}

/**
 * Todos os usuários da plataforma — a outra metade de "quem pode receber".
 *
 * O roster `colaboradores_chabra` cobre quem NÃO tem login (a maioria de quem
 * retira equipamento em campo). Mas a maior parte de quem recebe notebook,
 * monitor e headset **tem** login, e obrigar a redigitar essas 55 pessoas num
 * segundo cadastro é trabalho duplicado com duas versões da verdade.
 *
 * A RLS deixa: a policy de `select` em `usuarios` é `true` para autenticado —
 * então o seletor funciona para qualquer perfil, não só admin.
 *
 * `Cliente` fica de fora: é perfil de portal externo, não gente da JCN Consultoria.
 */
export type UsuarioPlataforma = {
  id_usuario: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  cpf: string | null;
};

export function useUsuariosPlataforma() {
  return useQuery({
    queryKey: ["usuarios-plataforma"] as const,
    staleTime: STALE,
    queryFn: async (): Promise<UsuarioPlataforma[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("usuarios")
        .select("id_usuario, nome, email, cargo, cpf")
        .eq("ativo_sistema", true)
        .neq("perfil", "Cliente")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as UsuarioPlataforma[];
    },
  });
}

/**
 * Ponte entre o usuário da plataforma e o roster que a RPC exige.
 *
 * ⚠️ A RPC `equipamento_registrar_entrega` recusa destinatário que não esteja em
 * `colaboradores_chabra` **daquela base e ativo** — é regra do banco, não da
 * tela. Então escolher um usuário na lista não basta: é preciso existir a linha
 * de roster correspondente.
 *
 * POR QUE ISTO NÃO É O "SEED" QUE FOI DESCARTADO. Semear as 55 pessoas de uma
 * vez foi rejeitado porque `usuarios.unidades` é um ARRAY: 40 dos 55 têm zero ou
 * mais de uma base, e a entrega exige base única — não havia como escolher. Aqui
 * a base não é adivinhada: é a que a pessoa selecionou na tela, no ato. A
 * ambiguidade simplesmente não existe, e a linha nasce só para quem de fato
 * recebeu alguma coisa.
 *
 * Procura por e-mail (chave lógica de usuário no projeto inteiro) e depois por
 * nome, para não criar duplicata de alguém já cadastrado à mão.
 */
export function useGarantirColaborador() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  return useMutation({
    mutationFn: async (p: {
      id_unidade: string;
      usuario: UsuarioPlataforma;
    }): Promise<string> => {
      const sb = createSupabaseBrowserClient();

      /**
       * ⚠️ O casamento é feito AQUI, não por `ilike` no servidor.
       *
       * `ilike` trata `_` e `%` VINDOS DO VALOR como coringa: um e-mail
       * `joao_silva@chabra.com.br` casaria com `joaoXsilva@...` e a entrega
       * seria registrada para a pessoa errada — em silêncio, num documento
       * assinado. Hoje nenhum dos 55 usuários tem `_` ou `%` no nome ou no
       * e-mail, mas isso é sorte, não garantia: basta um cadastro novo.
       *
       * A base tem dezenas de linhas, não milhares. Trazer as candidatas e
       * comparar em minúsculas é exato, previsível e barato.
       */
      const { data: daBase, error: erroBusca } = await sb
        .from("colaboradores_chabra")
        .select("id_colaborador, ativo, nome, email")
        .eq("id_unidade", p.id_unidade);
      if (erroBusca) throw erroBusca;

      const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
      const alvoEmail = norm(p.usuario.email);
      const alvoNome = norm(p.usuario.nome);
      const linhas = (daBase ?? []) as unknown as {
        id_colaborador: string;
        ativo: boolean;
        nome: string;
        email: string | null;
      }[];

      const existente =
        (alvoEmail ? linhas.find((l) => norm(l.email) === alvoEmail) : undefined) ??
        linhas.find((l) => norm(l.nome) === alvoNome) ??
        null;

      if (existente) {
        // Reativar em silêncio desfaria uma decisão de quem desativou. Melhor
        // dizer o que está acontecendo e onde resolver.
        if (!existente.ativo) {
          throw new Error(
            `${p.usuario.nome} está cadastrado nesta base como INATIVO. Reative em "Colaboradores" antes de entregar equipamento.`,
          );
        }
        return existente.id_colaborador;
      }

      /**
       * ⚠️ O CPF NÃO É COPIADO, de propósito.
       *
       * `uniq_colab_chabra_cpf` é UNIQUE **global** sobre os dígitos do CPF
       * (índice parcial, só quando preenchido), enquanto o roster é por BASE.
       * Uma pessoa que receba equipamento em duas bases precisa de duas linhas
       * — e a segunda bateria no índice, devolvendo erro cru do Postgres em
       * cima de alguém com um notebook na mão.
       *
       * É tensão de projeto da v166, não desta ponte: `id_unidade` na chave do
       * roster e CPF único no mundo não fecham. Hoje o ponto é inalcançável
       * (nenhum dos 55 usuários tem CPF preenchido), e deixar de copiar mantém
       * assim. Quem precisar do CPF impresso preenche pela tela Colaboradores,
       * na base onde a pessoa de fato está — e aí a decisão é de gente, com o
       * erro do índice aparecendo num cadastro, não numa entrega.
       */
      const { data, error } = await sb
        .from("colaboradores_chabra")
        .insert({
          id_unidade: p.id_unidade,
          nome: p.usuario.nome,
          cargo: p.usuario.cargo,
          email: p.usuario.email,
          criado_por: user?.email ?? null,
        } as never)
        .select("id_colaborador")
        .single();
      if (error) throw error;
      return (data as unknown as { id_colaborador: string }).id_colaborador;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_COLAB }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Aparelhos disponíveis / em posse
// ─────────────────────────────────────────────────────────────────────────────

/** Recorte de `equipamentos` que as telas de entrega e devolução desenham. */
export type AparelhoPosse = {
  id_equipamento: string;
  id_unidade: string;
  nome: string;
  tipo: string | null;
  fabricante: string | null;
  modelo: string | null;
  numero_serie: string | null;
  numero_patrimonio: string | null;
  status: string;
  id_colaborador: string | null;
  entregue_em: string | null;
};

const COLUNAS_POSSE =
  "id_equipamento,id_unidade,nome,tipo,fabricante,modelo,numero_serie,numero_patrimonio,status,id_colaborador,entregue_em";

/**
 * Aparelhos livres numa base — os que podem ser entregues agora.
 *
 * "Livre" é `id_colaborador is null`. BAIXADA fica de fora porque entregar um
 * bem baixado é erro de cadastro, não uma entrega; os demais status entram,
 * inclusive MANUTENCAO — mandar um aparelho para o técnico consertar também é
 * uma saída da base e merece termo.
 */
export function useAparelhosLivres(idUnidade: string | null | undefined, habilitado = true) {
  return useQuery({
    queryKey: ["equipamentos-livres", idUnidade ?? "—"] as const,
    enabled: habilitado && !!idUnidade,
    staleTime: STALE,
    queryFn: async (): Promise<AparelhoPosse[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("equipamentos")
        .select(COLUNAS_POSSE)
        .eq("id_unidade", idUnidade!)
        .is("id_colaborador", null)
        .neq("status", "BAIXADA")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as AparelhoPosse[];
    },
  });
}

/** O que está com uma pessoa. É a resposta de "o que o Fulano tem em mãos" e a
 *  fonte da tela de devolução — e do termo de desligamento, quando existir. */
export function useAparelhosDoColaborador(idColaborador: string | null | undefined) {
  return useQuery({
    queryKey: ["equipamentos-do-colaborador", idColaborador ?? "—"] as const,
    enabled: !!idColaborador,
    staleTime: STALE,
    queryFn: async (): Promise<AparelhoPosse[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("equipamentos")
        .select(COLUNAS_POSSE)
        .eq("id_colaborador", idColaborador!)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as AparelhoPosse[];
    },
  });
}

/** Periférico / item por quantidade que está com uma pessoa: o que ela retirou
 *  menos o que já devolveu, por produto. Não existe linha em `equipamentos`
 *  para isso — a posse mora em `equipamentos_entregas_itens` (id_catalogo sem
 *  id_equipamento) e sai por `equipamentos_devolucoes_itens`. Nasceu em
 *  21/09/2026 com a retirada de periféricos; sem ele, um headset entregue não
 *  tinha como voltar. */
export type EstoqueEmPosse = {
  id_catalogo: string;
  nome: string;
  tipo: string | null;
  unidade_medida: string | null;
  quantidade: number;
};

export function useEstoqueDoColaborador(idColaborador: string | null | undefined) {
  return useQuery({
    queryKey: ["equipamentos-estoque-do-colaborador", idColaborador ?? "—"] as const,
    enabled: !!idColaborador,
    staleTime: STALE,
    queryFn: async (): Promise<EstoqueEmPosse[]> => {
      const sb = createSupabaseBrowserClient();
      const [ent, dev] = await Promise.all([
        sb
          .from("equipamentos_entregas_itens")
          .select("id_catalogo, quantidade, nome_equipamento, entrega:equipamentos_entregas!inner(id_colaborador, status)")
          .is("id_equipamento", null)
          .not("id_catalogo", "is", null)
          .eq("entrega.id_colaborador", idColaborador!),
        sb
          .from("equipamentos_devolucoes_itens")
          .select("id_catalogo, quantidade, devolucao:equipamentos_devolucoes!inner(id_colaborador)")
          .is("id_equipamento", null)
          .not("id_catalogo", "is", null)
          .eq("devolucao.id_colaborador", idColaborador!),
      ]);
      if (ent.error) throw ent.error;
      if (dev.error) throw dev.error;
      type LinhaEnt = { id_catalogo: string; quantidade: number; nome_equipamento: string | null; entrega: { status: string | null } | null };
      type LinhaDev = { id_catalogo: string; quantidade: number };
      const saldo = new Map<string, { nome: string | null; qtd: number }>();
      for (const r of (ent.data ?? []) as unknown as LinhaEnt[]) {
        if (r.entrega?.status === "cancelada") continue;
        const cur = saldo.get(r.id_catalogo) ?? { nome: r.nome_equipamento, qtd: 0 };
        cur.qtd += Number(r.quantidade) || 0;
        saldo.set(r.id_catalogo, cur);
      }
      for (const r of (dev.data ?? []) as unknown as LinhaDev[]) {
        const cur = saldo.get(r.id_catalogo);
        if (cur) cur.qtd -= Number(r.quantidade) || 0;
      }
      const ids = [...saldo.entries()].filter(([, v]) => v.qtd > 0).map(([k]) => k);
      if (ids.length === 0) return [];
      const { data: cat, error } = await sb
        .from("equipamentos_catalogo")
        .select("id_catalogo, nome, tipo, unidade_medida")
        .in("id_catalogo", ids);
      if (error) throw error;
      const info = new Map((cat ?? []).map((c) => [(c as { id_catalogo: string }).id_catalogo, c as { nome: string; tipo: string | null; unidade_medida: string | null }]));
      return ids
        .map((id) => ({
          id_catalogo: id,
          nome: info.get(id)?.nome ?? saldo.get(id)?.nome ?? id,
          tipo: info.get(id)?.tipo ?? null,
          unidade_medida: info.get(id)?.unidade_medida ?? null,
          quantidade: saldo.get(id)!.qtd,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}
// ─────────────────────────────────────────────────────────────────────────────
// Entrega (retirada)
// ─────────────────────────────────────────────────────────────────────────────

/** Item de entrega: ou um ativo identificado, ou uma quantidade de catálogo. */
export type ItemEntregaInput =
  | { id_equipamento: string }
  | { id_catalogo: string; quantidade: number };

export function useEntregas(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY_ENTREGAS, idUnidade ?? "TODAS"] as const,
    staleTime: STALE,
    queryFn: async (): Promise<EquipamentoEntrega[]> => {
      const sb = createSupabaseBrowserClient();
      let q = sb.from("equipamentos_entregas").select("*").order("criado_em", { ascending: false }).limit(200);
      if (idUnidade) q = q.eq("id_unidade", idUnidade);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoEntrega[];
    },
  });
}

export function useEntregaItens(idEntrega: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY_ENTREGAS, "itens", idEntrega ?? "—"] as const,
    enabled: !!idEntrega,
    queryFn: async (): Promise<EquipamentoEntregaItem[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("equipamentos_entregas_itens")
        .select("*")
        .eq("id_entrega", idEntrega!);
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoEntregaItem[];
    },
  });
}

/**
 * Registra a entrega. Devolve o `id_entrega`, que é o que a tela usa para abrir
 * o termo em PDF logo em seguida — sem esse retorno a pessoa teria de procurar
 * a linha no histórico para imprimir o papel que ela acabou de gerar.
 */
export function useRegistrarEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id_unidade: string;
      id_colaborador: string;
      data_entrega: string;
      responsavel: string | null;
      observacao: string | null;
      itens: ItemEntregaInput[];
    }): Promise<string> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("equipamento_registrar_entrega", {
        p_id_unidade: p.id_unidade,
        p_id_colaborador: p.id_colaborador,
        p_data_entrega: p.data_entrega,
        p_responsavel: p.responsavel,
        p_observacao: p.observacao,
        p_itens: p.itens,
      } as never);
      if (error) throw error;
      return String(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_ENTREGAS });
      qc.invalidateQueries({ queryKey: ["equipamentos-livres"] });
      qc.invalidateQueries({ queryKey: ["equipamentos-do-colaborador"] });
      qc.invalidateQueries({ queryKey: ["equipamentos-estoque-do-colaborador"] });
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
      // As chaves REAIS do estoque são "equip-*" (useEquipamentosEstoque). As duas
      // linhas antigas nunca bateram em nada — o saldo ficava velho na tela.
      qc.invalidateQueries({ queryKey: ["equip-movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["equip-saldo"] });
      qc.invalidateQueries({ queryKey: ["equip-catalogo"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível registrar a entrega.")),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Devolução (entrada)
// ─────────────────────────────────────────────────────────────────────────────

export type ItemDevolucaoInput =
  | { id_equipamento: string; estado_retorno: EstadoRetorno; observacao_estado?: string | null }
  | { id_catalogo: string; quantidade: number; estado_retorno: EstadoRetorno; observacao_estado?: string | null };

export function useDevolucoes(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY_DEVOLUCOES, idUnidade ?? "TODAS"] as const,
    staleTime: STALE,
    queryFn: async (): Promise<EquipamentoDevolucao[]> => {
      const sb = createSupabaseBrowserClient();
      let q = sb.from("equipamentos_devolucoes").select("*").order("criado_em", { ascending: false }).limit(200);
      if (idUnidade) q = q.eq("id_unidade", idUnidade);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoDevolucao[];
    },
  });
}

export function useDevolucaoItens(idDevolucao: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY_DEVOLUCOES, "itens", idDevolucao ?? "—"] as const,
    enabled: !!idDevolucao,
    queryFn: async (): Promise<EquipamentoDevolucaoItem[]> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("equipamentos_devolucoes_itens")
        .select("*")
        .eq("id_devolucao", idDevolucao!);
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoDevolucaoItem[];
    },
  });
}

/**
 * Registra a devolução. O banco recusa item avariado ou inservível sem
 * descrição — e recusa antes de gravar qualquer coisa, não no meio.
 */
export function useRegistrarDevolucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id_unidade: string;
      id_colaborador: string;
      id_entrega: string | null;
      data_devolucao: string;
      recebido_por: string | null;
      observacao: string | null;
      itens: ItemDevolucaoInput[];
    }): Promise<string> => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.rpc("equipamento_registrar_devolucao", {
        p_id_unidade: p.id_unidade,
        p_id_colaborador: p.id_colaborador,
        p_id_entrega: p.id_entrega,
        p_data_devolucao: p.data_devolucao,
        p_recebido_por: p.recebido_por,
        p_observacao: p.observacao,
        p_itens: p.itens,
      } as never);
      if (error) throw error;
      return String(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_DEVOLUCOES });
      qc.invalidateQueries({ queryKey: KEY_ENTREGAS });
      qc.invalidateQueries({ queryKey: ["equipamentos-livres"] });
      qc.invalidateQueries({ queryKey: ["equipamentos-do-colaborador"] });
      qc.invalidateQueries({ queryKey: ["equipamentos-estoque-do-colaborador"] });
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
      // As chaves REAIS do estoque são "equip-*" (useEquipamentosEstoque). As duas
      // linhas antigas nunca bateram em nada — o saldo ficava velho na tela.
      qc.invalidateQueries({ queryKey: ["equip-movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["equip-saldo"] });
      qc.invalidateQueries({ queryKey: ["equip-catalogo"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível registrar a devolução.")),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// "Com quem está" — a view que já existia e ninguém lia
// ─────────────────────────────────────────────────────────────────────────────

export interface EquipamentoComColaborador {
  id_colaborador: string;
  colaborador_nome: string;
  matricula: string | null;
  cargo: string | null;
  id_unidade: string;
  id_equipamento: string;
  equipamento_nome: string;
  numero_serie: string | null;
  numero_patrimonio: string | null;
  status: string | null;
  entregue_em: string | null;
}

/**
 * Todo aparelho identificado que está na mão de alguém, em uma consulta.
 *
 * A view `v_equipamentos_com_colaborador` foi aplicada na produção com a v166 e
 * até aqui NENHUMA linha do painel a lia — mesma história do resto do módulo de
 * entregas, que ficou meses com o backend pronto e sem porta. Ela é
 * `security_invoker`, então cada pessoa enxerga por ela exatamente o que
 * enxergaria na tabela `equipamentos`.
 *
 * `enabled: false`: quem usa hoje é só a exportação (Fase 8), no clique.
 */
export function useEquipamentosComColaboradorParaExport() {
  return useQuery({
    queryKey: ["equipamentos-com-colaborador", "export"] as const,
    enabled: false,
    gcTime: 0,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("v_equipamentos_com_colaborador")
        .select("*")
        .order("colaborador_nome");
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoComColaborador[];
    },
  });
}

/**
 * Os ITENS de TODAS as retiradas / devoluções do recorte, de uma vez.
 *
 * POR QUE EM BLOCO E NÃO UM POR LINHA. O registro único procura pelo nome do
 * item que está DENTRO da retirada ("para onde foi o teclado?"). Buscar item a
 * item significaria uma consulta por linha da tela — e a busca só encontraria
 * o que já tivesse sido aberto. Aqui é uma consulta só, e a tela nasce sabendo.
 *
 * O teto de 2.000 acompanha o das retiradas (200) e devoluções (200): mesmo a
 * 10 itens por documento, o bloco inteiro cabe.
 */
export function useEntregasItensTodos(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY_ENTREGAS, "itens-todos", idUnidade ?? "TODAS"] as const,
    staleTime: STALE,
    queryFn: async (): Promise<EquipamentoEntregaItem[]> => {
      const sb = createSupabaseBrowserClient();
      let q = sb.from("equipamentos_entregas_itens").select("*").limit(2000);
      if (idUnidade) q = q.eq("id_unidade", idUnidade);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoEntregaItem[];
    },
  });
}

export function useDevolucoesItensTodos(idUnidade: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY_DEVOLUCOES, "itens-todos", idUnidade ?? "TODAS"] as const,
    staleTime: STALE,
    queryFn: async (): Promise<EquipamentoDevolucaoItem[]> => {
      const sb = createSupabaseBrowserClient();
      let q = sb.from("equipamentos_devolucoes_itens").select("*").limit(2000);
      if (idUnidade) q = q.eq("id_unidade", idUnidade);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoDevolucaoItem[];
    },
  });
}

/** URL do termo. Uma função só para os três tipos não divergirem entre telas. */
export function urlTermo(tipo: "entrega" | "devolucao" | "transferencia", id: string): string {
  return `/api/pdf/equipamento-termo/${tipo}/${encodeURIComponent(id)}`;
}
