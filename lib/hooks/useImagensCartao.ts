"use client";

// Imagens nos cartões e nos comentários (12/11/2026) — regras em lib/gestao/imagens-cartao.ts.
// Grava como os anexos da aba Anexos (bucket "anexos" pela rota do servidor + linha em gestao_anexos, com as mesmas
// permissões); a imagem do comentário vai na pasta comentario-<id>.

import { useEffect, type RefObject } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import { useUserStore } from "@/lib/store";
import { caminhoDaImagem, colarComoImagem, pastaDoComentario, TEXTO_SO_IMAGEM } from "@/lib/gestao/imagens-cartao";

export const MAX_IMAGEM = 25 * 1024 * 1024; // o mesmo limite da aba Anexos

async function enviarImagem(idTarefa: string, file: File, email: string | null, pasta?: string | null, id?: string) {
  const sb = createSupabaseBrowserClient();
  const path = caminhoDaImagem(idTarefa, file.name, crypto.randomUUID(), pasta);
  const { error: upErr } = await sb.storage.from("anexos").upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { error } = await sb.from("gestao_anexos").insert({
    // A imagem da descrição já nasce com o id que está na marcação do texto (lib/gestao/descricao-imagens.ts).
    id: id ?? crypto.randomUUID(),
    id_tarefa: idTarefa,
    nome: file.name,
    storage_path: path,
    mime: file.type || "image/png",
    tamanho_bytes: file.size,
    created_by: email,
  } as never);
  if (error) throw error;
}

/** Grava as que cabem; as grandes demais ficam de fora com aviso. Devolve quantas subiram. */
async function enviarVarias(idTarefa: string, files: File[], email: string | null, pasta?: string | null, ids?: string[]): Promise<number> {
  let n = 0;
  for (const [k, f] of files.entries()) {
    if (f.size > MAX_IMAGEM) { toast.error(`"${f.name}" passa de 25 MB.`); continue; }
    await enviarImagem(idTarefa, f, email, pasta, ids?.[k]);
    n++;
  }
  return n;
}

function recarregarAnexos(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["gestao-anexos"] });
  qc.invalidateQueries({ queryKey: ["gestao-anexos-count"] });
}

/** Imagens do cartão. `ids` (opcional, na mesma ordem dos arquivos): os da marcação na descrição. */
export function useEnviarImagens() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: (p: { id_tarefa: string; files: File[]; ids?: string[] }) => enviarVarias(p.id_tarefa, p.files, email, null, p.ids),
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível enviar a imagem.")),
    onSettled: () => recarregarAnexos(qc),
  });
}

/** Comentário com imagens: o id nasce aqui para as imagens irem na pasta dele. Mesmos campos do comentário comum. */
export function useComentarComImagens() {
  const qc = useQueryClient();
  const email = useUserStore((s) => s.user?.email ?? null);
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; texto: string; autor: string | null; atribuido_a?: string | null; files: File[] }) => {
      const sb = createSupabaseBrowserClient();
      const id = gerarId("CMT");
      const { error } = await sb.from("gestao_comentarios").insert({
        id_comentario: id,
        id_tarefa: p.id_tarefa,
        autor: p.autor,
        texto: p.texto.trim() || TEXTO_SO_IMAGEM,
        ...(p.atribuido_a ? { atribuido_a: p.atribuido_a.toLowerCase() } : {}),
        created_at: new Date().toISOString(),
      } as never);
      if (error) throw error;
      // O comentário já existe: se uma imagem falhar, o aviso sai e o comentário fica (sem ela).
      try {
        await enviarVarias(p.id_tarefa, p.files, email, pastaDoComentario(id));
      } catch (e) {
        toast.error(mensagemErro(e, "O comentário foi salvo, mas uma imagem não subiu."));
      }
      return id;
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível comentar.")),
    onSettled: (_d, _e, p) => {
      qc.invalidateQueries({ queryKey: ["gestao-comentarios", p.id_tarefa] });
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline", p.id_tarefa] });
      recarregarAnexos(qc);
    },
  });
}

/**
 * Ctrl+V com imagem, como nos formulários (0.3.952): escuta o documento inteiro e entrega as imagens a quem é dono
 * do lugar. Só a janela de cima recebe: a do foco; sem foco, a última aberta. `soDentro` (caixa do comentário) só
 * pega o que foi colado dentro dela; `ignorarDentro` (o cartão) deixa essas para ela.
 */
export function useColarImagens(
  ativo: boolean,
  ancora: RefObject<HTMLElement | null>,
  aoColar: (imagens: File[]) => void,
  opcoes: { soDentro?: string; ignorarDentro?: string } = {},
) {
  // Sem lista de dependências de propósito: re-registra a cada render para enxergar o estado atual (igual aos formulários).
  useEffect(() => {
    if (!ativo) return;
    function colar(e: ClipboardEvent) {
      if (e.defaultPrevented) return;   // o editor da descrição (ou outra caixa) já tratou a colagem
      const imagens = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      const minha = ancora.current?.closest('[role="dialog"]');
      if (!imagens.length || !minha) return;
      const alvo = e.target instanceof Element ? e.target : null;
      const dialogos = document.querySelectorAll('[role="dialog"]');
      const dialogoAlvo = alvo?.closest('[role="dialog"]') ?? dialogos[dialogos.length - 1] ?? null;
      if (dialogoAlvo !== minha) return;
      if (opcoes.soDentro && !alvo?.closest(opcoes.soDentro)) return;
      if (opcoes.ignorarDentro && alvo?.closest(opcoes.ignorarDentro)) return;
      const emCampoDeTexto = alvo instanceof HTMLTextAreaElement || (alvo instanceof HTMLInputElement && alvo.type !== "file")
        || (alvo instanceof HTMLElement && alvo.isContentEditable);
      if (!colarComoImagem({ emCampoDeTexto, texto: e.clipboardData?.getData("text/plain") ?? "", imagens: imagens.length })) return;
      e.preventDefault();
      aoColar(imagens);
    }
    document.addEventListener("paste", colar);
    return () => document.removeEventListener("paste", colar);
  });
}

/** Botão "Colar imagem copiada" (celular, ou quem prefere o mouse): lê a área de transferência. */
export async function lerImagensCopiadas(): Promise<File[] | string> {
  try {
    if (!navigator.clipboard?.read) throw new Error("sem clipboard.read");
    const itens = await navigator.clipboard.read();
    const lista: File[] = [];
    for (const it of itens) {
      const tipo = it.types.find((t) => t.startsWith("image/"));
      if (tipo) lista.push(new File([await it.getType(tipo)], `image.${tipo.split("/")[1] ?? "png"}`, { type: tipo }));
    }
    return lista.length ? lista : "Não há imagem copiada. Copie uma imagem ou tire um print (Windows + Shift + S) e tente de novo.";
  } catch {
    return "O navegador não deixou ler a imagem copiada. Clique na janela do cartão e aperte Ctrl+V.";
  }
}
