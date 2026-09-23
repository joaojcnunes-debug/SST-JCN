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
  caminhoAnexo,
  ehImagem,
  extensaoDe,
  prepararImagem,
} from "@/lib/frota/fotos";
import type { FrotaAbastecimento, FrotaAbastecimentoAnexo } from "@/lib/frota/tipos";

/**
 * Abastecimentos — `frota_abastecimentos` (v177) e seus anexos.
 *
 * SEM SOMA AUTOMÁTICA, por decisão do operador: o valor do litro varia por posto,
 * e uma soma calculada geraria mais confusão do que ajuda. `litros`,
 * `valor_litro` e `valor_total` são três campos livres e independentes — a tela
 * não preenche nenhum a partir dos outros.
 *
 * O COMPROVANTE aceita qualquer formato — foto, PDF, entre outros — e mais de um
 * por abastecimento, porque no cartão-frota costuma vir o cupom da bomba E o
 * comprovante da máquina.
 */

const KEY = (idVeiculo: string | null | undefined) => ["frota_abastecimentos", idVeiculo] as const;
const KEY_ANEXOS = (id: string | null | undefined) =>
  ["frota_abastecimento_anexos", id] as const;

export function useAbastecimentosDoVeiculo(idVeiculo: string | null | undefined) {
  return useQuery({
    queryKey: KEY(idVeiculo),
    enabled: !!idVeiculo,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_abastecimentos")
        .select("*")
        .eq("id_veiculo", idVeiculo as string)
        .order("data_hora", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaAbastecimento[];
    },
  });
}

export function useAbastecimentoAnexos(idAbastecimento: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ANEXOS(idAbastecimento),
    enabled: !!idAbastecimento,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_abastecimento_anexos")
        .select("*")
        .eq("id_abastecimento", idAbastecimento as string)
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaAbastecimentoAnexo[];
    },
  });
}

export type AbastecimentoInput = Omit<
  FrotaAbastecimento,
  "id_abastecimento" | "criado_por" | "criado_em"
>;

export function useSalvarAbastecimento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id_abastecimento?: string;
      input: AbastecimentoInput;
      anexos?: File[];
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      let id_abastecimento = args.id_abastecimento;
      if (id_abastecimento) {
        const { error } = await supabase
          .from("frota_abastecimentos")
          .update(args.input as never)
          .eq("id_abastecimento", id_abastecimento);
        if (error) throw error;
      } else {
        id_abastecimento = gerarId("ABA");
        const { error } = await supabase.from("frota_abastecimentos").insert({
          ...args.input,
          id_abastecimento,
          criado_por: user?.email ?? null,
        } as never);
        if (error) throw error;
      }

      for (const file of args.anexos ?? []) {
        const id_anexo = gerarId("ANX");
        const ext = extensaoDe(file.name);
        const arquivo_path = caminhoAnexo(id_abastecimento, id_anexo, ext);
        const mime = file.type || "application/octet-stream";

        const up = await supabase.storage.from(BUCKET).upload(arquivo_path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: mime,
        });
        if (up.error) {
          console.warn("Anexo não enviado:", up.error.message);
          continue;
        }

        // Miniatura SÓ para imagem. PDF fica com thumb_path nulo e a lista mostra
        // ícone por tipo — quadrado cinza vazio pareceria foto que não carregou.
        let thumb_path: string | null = null;
        if (ehImagem(mime)) {
          const preparada = await prepararImagem(file);
          if (preparada) {
            const p = caminhoAnexo(id_abastecimento, `${id_anexo}_thumb`, "jpg");
            const u = await supabase.storage.from(BUCKET).upload(p, preparada.thumb, {
              cacheControl: "3600", upsert: true, contentType: "image/jpeg",
            });
            if (!u.error) thumb_path = p;
          }
        }

        await supabase.from("frota_abastecimento_anexos").insert({
          id_anexo,
          id_abastecimento,
          arquivo_path,
          mime,
          nome_arquivo: file.name,
          bytes: file.size,
          thumb_path,
          criado_por: user?.email ?? null,
        } as never);
      }

      // O odômetro do abastecimento também sobe o registro do veículo — a regra
      // do km é a mesma, venha da saída ou daqui.
      if (args.input.km_odometro != null) {
        await atualizarKmVeiculo({
          id_veiculo: args.input.id_veiculo,
          km: args.input.km_odometro,
          origem: "ABASTECIMENTO",
          id_origem: id_abastecimento,
        });
      }

      return { id_abastecimento, id_veiculo: args.input.id_veiculo };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: KEY(r.id_veiculo) });
      qc.invalidateQueries({ queryKey: KEY_ANEXOS(r.id_abastecimento) });
      qc.invalidateQueries({ queryKey: ["frota_veiculos"] });
      qc.invalidateQueries({ queryKey: ["frota_veiculo", r.id_veiculo] });
      toast.success("Abastecimento registrado.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível salvar o abastecimento.")),
  });
}

export function useExcluirAbastecimento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_abastecimento: string; id_veiculo: string }) => {
      await excluirComLixeiraPorId({
        tabela: "frota_abastecimentos",
        chave: "id_abastecimento",
        id: args.id_abastecimento,
        modulo: "frota",
        rotuloCol: "posto",
      });
      return args;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: KEY(a.id_veiculo) });
      toast.success("Abastecimento movido para a lixeira.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}
