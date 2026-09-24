"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { gerarId } from "@/lib/utils";
import { BUCKET, caminhoGaleria, prepararImagem } from "@/lib/frota/fotos";
import type { FrotaVeiculoFoto } from "@/lib/frota/tipos";

/**
 * Galeria do veículo — `frota_veiculo_fotos` (v177). SEM LIMITE de quantidade,
 * como pedido: não há teto na tabela nem no formulário.
 *
 * O que existe é PAGINAÇÃO: 24 miniaturas por página. Sem isso, um veículo com
 * 200 fotos trava o celular do condutor — e a página lê só `thumb_path`
 * (320 px, ≈35 kB), então abrir a aba custa ~840 kB em vez de dezenas de MB.
 */

export const POR_PAGINA = 24;

const KEY = (idVeiculo: string | null | undefined) => ["frota_galeria", idVeiculo] as const;

/** Total de fotos — o contador da aba, sem baixar as linhas. */
export function useGaleriaTotal(idVeiculo: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY(idVeiculo), "total"] as const,
    enabled: !!idVeiculo,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { count, error } = await supabase
        .from("frota_veiculo_fotos")
        .select("id_foto", { count: "exact", head: true })
        .eq("id_veiculo", idVeiculo as string);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Uma página da galeria. `pagina` é 0-based. */
export function useGaleriaPagina(idVeiculo: string | null | undefined, pagina: number) {
  return useQuery({
    queryKey: [...KEY(idVeiculo), "pagina", pagina] as const,
    enabled: !!idVeiculo,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const de = pagina * POR_PAGINA;
      const { data, error } = await supabase
        .from("frota_veiculo_fotos")
        .select("*")
        .eq("id_veiculo", idVeiculo as string)
        .order("ordem", { ascending: true })
        .order("criado_em", { ascending: false })
        .range(de, de + POR_PAGINA - 1);
      if (error) throw error;
      return (data ?? []) as unknown as FrotaVeiculoFoto[];
    },
  });
}

/**
 * Envia N fotos para a galeria. Sequencial de propósito: no 4G do pátio, dez
 * uploads paralelos competem pela mesma banda e todos ficam lentos — em série,
 * cada foto termina e a barra de progresso anda de verdade.
 */
export function useEnviarFotosGaleria() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id_veiculo: string;
      files: File[];
      onProgresso?: (feitas: number, total: number) => void;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const enviadas: FrotaVeiculoFoto[] = [];
      const falhas: string[] = [];

      for (let i = 0; i < args.files.length; i++) {
        const file = args.files[i];
        const preparada = await prepararImagem(file);
        if (!preparada) {
          falhas.push(file.name);
          args.onProgresso?.(i + 1, args.files.length);
          continue;
        }

        const id_foto = gerarId("FOT");
        const pThumb = caminhoGaleria(args.id_veiculo, id_foto, "thumb");
        const pVista = caminhoGaleria(args.id_veiculo, id_foto, "vista");

        const [u1, u2] = await Promise.all([
          supabase.storage.from(BUCKET).upload(pThumb, preparada.thumb, {
            cacheControl: "3600", upsert: true, contentType: "image/jpeg",
          }),
          supabase.storage.from(BUCKET).upload(pVista, preparada.vista, {
            cacheControl: "3600", upsert: true, contentType: "image/jpeg",
          }),
        ]);
        if (u1.error || u2.error) {
          falhas.push(file.name);
          args.onProgresso?.(i + 1, args.files.length);
          continue;
        }

        const { data, error } = await supabase
          .from("frota_veiculo_fotos")
          .insert({
            id_foto,
            id_veiculo: args.id_veiculo,
            thumb_path: pThumb,
            vista_path: pVista,
            original_path: null,
            largura: preparada.largura,
            altura: preparada.altura,
            bytes: preparada.bytes,
            criado_por: user?.email ?? null,
          } as never)
          .select("*")
          .single();
        if (error) falhas.push(file.name);
        else enviadas.push(data as unknown as FrotaVeiculoFoto);

        args.onProgresso?.(i + 1, args.files.length);
      }

      return { enviadas, falhas };
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: KEY(vars.id_veiculo) });
      if (r.enviadas.length) {
        toast.success(
          r.enviadas.length === 1 ? "Foto enviada." : `${r.enviadas.length} fotos enviadas.`,
        );
      }
      // Falha parcial é dita, não engolida: quem enviou 10 e 2 falharam precisa
      // saber quais para tentar de novo.
      if (r.falhas.length) {
        toast.error(
          r.falhas.length === 1
            ? `Não foi possível enviar ${r.falhas[0]}.`
            : `${r.falhas.length} arquivos não foram enviados.`,
        );
      }
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível enviar as fotos.")),
  });
}

export function useAtualizarFotoGaleria() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      id_foto: string;
      id_veiculo: string;
      patch: { legenda?: string | null; ordem?: number };
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("frota_veiculo_fotos")
        .update(args.patch as never)
        .eq("id_foto", args.id_foto);
      if (error) throw error;
      return args;
    },
    onSuccess: (a) => qc.invalidateQueries({ queryKey: KEY(a.id_veiculo) }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível salvar.")),
  });
}

/**
 * Remove a foto da galeria.
 *
 * Aqui NÃO passa pela lixeira, e é deliberado: a lixeira guarda registro de
 * negócio (veículo, saída, sinistro, abastecimento), não item de mídia. Uma
 * galeria "ilimitada" enche a lixeira de linhas que ninguém vai restaurar, e o
 * que importa — o veículo — continua lá com todo o resto das fotos.
 */
export function useRemoverFotoGaleria() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id_foto: string; id_veiculo: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("frota_veiculo_fotos")
        .delete()
        .eq("id_foto", args.id_foto);
      if (error) throw error;
      return args;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: KEY(a.id_veiculo) });
      toast.success("Foto removida.");
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não foi possível remover a foto.")),
  });
}
