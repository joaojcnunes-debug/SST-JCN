"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { gerarId } from "@/lib/utils";
import { BUCKET, caminhoSinistro, prepararImagem } from "@/lib/frota/fotos";
import type { FrotaSinistro, FrotaSinistroFoto } from "@/lib/frota/tipos";

/**
 * Sinistros do veículo — `frota_sinistros` (v177) e suas fotos.
 *
 * `status` é o que faz "histórico" valer alguma coisa: sem ele a aba é um monte
 * de ocorrência sem desfecho, e ninguém sabe o que ainda está na seguradora.
 *
 * NÃO há ponte automática com Investigação de Acidente quando `com_vitima` é
 * marcado. O campo fica registrado e a tela avisa; abrir a investigação é decisão
 * de quem conduz, não efeito colateral de marcar uma caixa.
 */

const KEY = (idVeiculo: string | null | undefined) => ["frota_sinistros", idVeiculo] as const;
const KEY_FOTOS = (id: string | null | undefined) => ["frota_sinistro_fotos", id] as const;

export function useSinistrosDoVeiculo(idVeiculo: string | null | undefined) {
  return useQuery({
    queryKey: KEY(idVeiculo),
    enabled: !!idVeiculo,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_sinistros")
        .select("*")
        .eq("id_veiculo", idVeiculo as string)
        .order("data_ocorrencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaSinistro[];
    },
  });
}

export function useSinistroFotos(idSinistro: string | null | undefined) {
  return useQuery({
    queryKey: KEY_FOTOS(idSinistro),
    enabled: !!idSinistro,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("frota_sinistro_fotos")
        .select("*")
        .eq("id_sinistro", idSinistro as string)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FrotaSinistroFoto[];
    },
  });
}

export type SinistroInput = Omit<
  FrotaSinistro,
  "id_sinistro" | "criado_por" | "criado_em" | "updated_at"
>;

export function useSalvarSinistro() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_sinistro?: string; input: SinistroInput; fotos?: File[] }) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      let id_sinistro = args.id_sinistro;
      if (id_sinistro) {
        const { error } = await supabase
          .from("frota_sinistros")
          .update({ ...args.input, updated_at: new Date().toISOString() } as never)
          .eq("id_sinistro", id_sinistro);
        if (error) throw error;
      } else {
        id_sinistro = gerarId("SIN");
        const { error } = await supabase.from("frota_sinistros").insert({
          ...args.input,
          id_sinistro,
          criado_por: user?.email ?? null,
        } as never);
        if (error) throw error;
      }

      // Fotos depois do registro: sinistro sem foto é registro válido, foto sem
      // sinistro é órfã no bucket.
      for (const file of args.fotos ?? []) {
        const preparada = await prepararImagem(file);
        if (!preparada) continue;
        const id_foto = gerarId("FOT");
        const pThumb = caminhoSinistro(id_sinistro, id_foto, "thumb");
        const pVista = caminhoSinistro(id_sinistro, id_foto, "vista");
        const [u1, u2] = await Promise.all([
          supabase.storage.from(BUCKET).upload(pThumb, preparada.thumb, {
            cacheControl: "3600", upsert: true, contentType: "image/jpeg",
          }),
          supabase.storage.from(BUCKET).upload(pVista, preparada.vista, {
            cacheControl: "3600", upsert: true, contentType: "image/jpeg",
          }),
        ]);
        if (u1.error || u2.error) {
          console.warn("Foto do sinistro não enviada:", (u1.error ?? u2.error)?.message);
          continue;
        }
        await supabase.from("frota_sinistro_fotos").insert({
          id_foto, id_sinistro, thumb_path: pThumb, vista_path: pVista, original_path: null,
        } as never);
      }

      return { id_sinistro, id_veiculo: args.input.id_veiculo };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: KEY(r.id_veiculo) });
      qc.invalidateQueries({ queryKey: KEY_FOTOS(r.id_sinistro) });
      toast.success("Sinistro registrado.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível salvar o sinistro.")),
  });
}

export function useExcluirSinistro() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_sinistro: string; id_veiculo: string }) => {
      await excluirComLixeiraPorId({
        tabela: "frota_sinistros",
        chave: "id_sinistro",
        id: args.id_sinistro,
        modulo: "frota",
        rotuloCol: "descricao",
      });
      return args;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: KEY(a.id_veiculo) });
      toast.success("Sinistro movido para a lixeira.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}
