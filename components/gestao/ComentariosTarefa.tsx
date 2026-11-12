"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Send, X, CheckCircle2, CircleDot, UserRound, UserRoundPlus, Sparkles, Loader2, Paperclip, AtSign, Smile, Bot } from "lucide-react";
import { mensagemErro } from "@/lib/errors";
import { resumirComentariosIa, useAnexos, usePessoasMencao } from "@/lib/hooks/useGestao";
import { mencionados, partesComMencoes, mencaoEmDigitacao, sugestoesMencao, inserirMencao, type PessoaMencao } from "@/lib/gestao/mencoes";
import { dataHora, quandoComentario, ehMeuComentario } from "@/lib/gestao/comentarios-chat";
import { useColarImagens } from "@/lib/hooks/useImagensCartao";
import { separarImagens, TEXTO_SO_IMAGEM } from "@/lib/gestao/imagens-cartao";
import { ImagemAmpliada, MiniaturaRascunho, MiniaturaSalva, type Ampliada } from "@/components/gestao/ImagensCartao";
import { MIN_COMENTARIOS_RESUMO, type ResumoIa } from "@/lib/gestao/ia-resumo";
import { useTarefaHistorico } from "@/lib/hooks/useTarefaHistorico";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";

const EMOJIS = [
  "👍", "👏", "🙏", "✅", "❌", "⚠️", "📌", "📎",
  "😀", "😂", "😊", "😉", "😍", "🤔", "😅", "😢",
  "😮", "😡", "🎉", "🔥", "💪", "👀", "⏰", "📅",
  "📞", "✉️", "💡", "🚀", "❤️", "👌", "🙌", "❗",
];

const botaoIcone =
  "flex size-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-200 hover:text-gray-700";

/**
 * Aba "Comentários" do TarefaModal: só os comentários (as movimentações foram para a aba
 * Histórico) + campo de novo comentário no rodapé. Render 100% TEXTO (React-escaped) — nada de dangerouslySetInnerHTML.
 * `podeComentar` (padrão = !ro) mostra a caixa de escrever: também para o nível "ver e comentar", que não edita; excluir
 * comentário segue em !ro.
 * v341 (Painel v353, item 10, como no ClickUp): o comentário pode ser ATRIBUÍDO a alguém — vira pendência dela até
 * alguém marcar "Resolver" (quem recebeu ou quem edita o quadro).
 * 0.3.275 (= Painel 0.3.925): "Resumir com IA" — situação, o que já foi decidido, o que falta e o próximo passo. A IA lê
 * os comentários com o login da pessoa (só o que ela já vê). O resumo não fica salvo.
 * 12/11/2026 (= Painel 0.3.953): imagem no comentário — Ctrl+V na caixa de escrever ou o clipe; ela vai junto ao enviar e aparece
 * embaixo do texto (anexo na pasta comentario-<id>, lib/gestao/imagens-cartao.ts).
 * 0.3.287 (= Painel 0.3.962, banco v355): "@" marca alguém — ao digitar "@" aparece a lista de pessoas (setas + Enter, ou clique) e entra o
 * nome completo; quem foi marcado recebe o aviso "Fulano mencionou você em …" (o banco avisa; lib/gestao/mencoes.ts tem a
 * mesma regra, usada aqui para sugerir, mostrar quem vai ser avisado e destacar as menções nos comentários).
 * 0.3.287 (= Painel 0.3.967, jeito do Runrun): conversa — os meus à direita (balão azul, foto à direita), os dos outros à esquerda,
 * o balão do robô com a criação da tarefa (o botão do robô esconde/mostra), a caixa "Digite uma mensagem…" presa no
 * rodapé com emoji, @, atribuir e clipe dentro dela. A lista rola sozinha até o comentário mais novo.
 */
export default function ComentariosTarefa({
  idTarefa,
  ro,
  podeComentar = !ro,
  novoComentario,
  setNovoComentario,
  onEnviar,
  enviando,
  onExcluirComentario,
  usuarios = [],
  meuEmail = null,
  meuNome = null,
  criacao,
  podeResolverTodos = false,
  atribuirA = "",
  setAtribuirA,
  onResolver,
  imagensRascunho = [],
  onAdicionarImagens,
  onTirarImagem,
}: {
  idTarefa: string;
  ro: boolean;
  /** Caixa de comentário: também para o nível "ver e comentar", que não edita (ro). Excluir segue em !ro. */
  podeComentar?: boolean;
  novoComentario: string;
  setNovoComentario: (v: string) => void;
  onEnviar: () => void;
  enviando: boolean;
  onExcluirComentario: (idComentario: string) => void;
  usuarios?: { nome: string; email: string }[];
  meuEmail?: string | null;
  /** Nome de quem está usando: os comentários dele ficam à direita (o autor é gravado pelo nome). */
  meuNome?: string | null;
  /** Balão do robô: quando e como a tarefa foi criada. */
  criacao?: { em: string; texto: string };
  /** Quem edita o quadro resolve qualquer comentário atribuído. */
  podeResolverTodos?: boolean;
  atribuirA?: string;
  setAtribuirA?: (email: string) => void;
  onResolver?: (idComentario: string, resolvido: boolean) => void;
  /** Imagens do comentário que está sendo escrito (vão junto ao enviar). Sem `onAdicionarImagens`, sem imagem. */
  imagensRascunho?: File[];
  onAdicionarImagens?: (imagens: File[]) => void;
  onTirarImagem?: (i: number) => void;
}) {
  const { data: itens = [], isLoading } = useTarefaHistorico(idTarefa);
  const { data: anexos = [] } = useAnexos(idTarefa);
  const { porComentario } = separarImagens(anexos);
  const [ampliada, setAmpliada] = useState<Ampliada | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  useColarImagens(podeComentar && !!onAdicionarImagens, caixaRef, (imgs) => onAdicionarImagens?.(imgs), { soDentro: "[data-colar-comentario]" });
  const podeEnviar = !!novoComentario.trim() || imagensRascunho.length > 0;
  const comentarios = itens.filter((i) => i.kind === "comentario");
  const nomeDe = (email: string | null | undefined) =>
    email ? usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase())?.nome ?? email : "—";
  const pendentes = comentarios.filter((i) => i.kind === "comentario" && i.atribuido_a && !i.resolvido_em).length;
  // Relógio do "agora / há N min": anda de minuto em minuto.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const [mostrarRobo, setMostrarRobo] = useState(true);
  // Robô + comentários na ordem do tempo (na tarefa trazida do Runrun, os comentários antigos vêm antes do robô).
  const mensagens: ({ tipo: "robo"; em: string; texto: string } | { tipo: "comentario"; item: (typeof comentarios)[number] })[] = [
    ...(criacao && mostrarRobo ? [{ tipo: "robo" as const, ...criacao }] : []),
    ...comentarios.map((item) => ({ tipo: "comentario" as const, item })),
  ].sort((a, b) => {
    const ta = new Date(a.tipo === "robo" ? a.em : a.item.created_at).getTime();
    const tb = new Date(b.tipo === "robo" ? b.em : b.item.created_at).getTime();
    return ta - tb || (a.tipo === "robo" ? -1 : b.tipo === "robo" ? 1 : 0);
  });
  // Como numa conversa: abre no fim e desce sozinho quando chega comentário.
  useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [idTarefa, isLoading, comentarios.length, mostrarRobo]);
  // "@": pessoas que podem ser marcadas, o "@…" em digitação (até o cursor) e o menu de sugestões.
  const { data: pessoasMencao = [] } = usePessoasMencao();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(0);
  const [focado, setFocado] = useState(false);
  // Lista fechada (Esc ou pessoa escolhida) para este "@": continua fechada enquanto se escreve depois dele; apagar para
  // dentro do nome reabre.
  const [fechado, setFechado] = useState<{ inicio: number; termo: string } | null>(null);
  const [destaque, setDestaque] = useState(0);
  const digitando = podeComentar && focado ? mencaoEmDigitacao(novoComentario, cursor) : null;
  const sugestoes = digitando ? sugestoesMencao(digitando.termo, pessoasMencao) : [];
  const menuAberto = !!digitando && sugestoes.length > 0
    && !(fechado && fechado.inicio === digitando.inicio && digitando.termo.startsWith(fechado.termo));
  useEffect(() => setDestaque(0), [digitando?.inicio, digitando?.termo]);
  useEffect(() => { if (!novoComentario) setFechado(null); }, [novoComentario]);
  // Quem escreveu não é avisado (gestao_avisar), então não aparece em "Vai avisar".
  const marcados = mencionados(novoComentario, pessoasMencao).filter((e) => e !== (meuEmail ?? "").toLowerCase());
  // Janelinhas dos ícones da caixa (emoji e atribuir): fecham com Esc, ao escolher ou clicando fora da caixa.
  const [aberto, setAberto] = useState<"emoji" | "atribuir" | null>(null);
  const [buscaAtribuir, setBuscaAtribuir] = useState("");
  const [destaqueAtribuir, setDestaqueAtribuir] = useState(0);
  const opcoesAtribuir = aberto === "atribuir" ? sugestoesMencao(buscaAtribuir, usuarios, 8) : [];
  useEffect(() => setDestaqueAtribuir(0), [buscaAtribuir, aberto]);
  useEffect(() => {
    if (!aberto) return;
    function onDown(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [aberto]);
  function alternar(qual: "emoji" | "atribuir") {
    setBuscaAtribuir("");
    setAberto((a) => (a === qual ? null : qual));
  }
  function colocarCursor(c: number) {
    setCursor(c);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(c, c); });
  }
  function escolherPessoa(p: PessoaMencao) {
    if (!digitando) return;
    const r = inserirMencao(novoComentario, digitando.inicio, cursor, p.nome);
    setNovoComentario(r.texto);
    setFechado({ inicio: digitando.inicio, termo: r.texto.slice(digitando.inicio + 1, r.cursor) });
    colocarCursor(r.cursor);
  }
  /** Botão "@": escreve o "@" onde está o cursor (com espaço antes, se precisar) e abre a lista. */
  function comecarMencao() {
    const c = inputRef.current?.selectionStart ?? novoComentario.length;
    const antes = novoComentario.slice(0, c);
    const espaco = antes && !/\s$/.test(antes) ? " " : "";
    setNovoComentario(antes + espaco + "@" + novoComentario.slice(c));
    setFechado(null);
    setAberto(null);
    colocarCursor(c + espaco.length + 1);
  }
  /** Emoji: entra no lugar do cursor (ou do trecho selecionado). */
  function inserirEmoji(emoji: string) {
    const ini = inputRef.current?.selectionStart ?? novoComentario.length;
    const fim = inputRef.current?.selectionEnd ?? ini;
    setNovoComentario(novoComentario.slice(0, ini) + emoji + novoComentario.slice(fim));
    setAberto(null);
    colocarCursor(ini + emoji.length);
  }
  function escolherAtribuir(email: string) {
    setAtribuirA?.(email);
    setAberto(null);
    colocarCursor(inputRef.current?.selectionStart ?? novoComentario.length);
  }
  const [resumo, setResumo] = useState<{ resumo: ResumoIa; usados: number; total: number } | null>(null);
  const [resumindo, setResumindo] = useState(false);
  useEffect(() => setResumo(null), [idTarefa]);
  async function resumir() {
    setResumindo(true);
    try {
      setResumo(await resumirComentariosIa(idTarefa));
    } catch (e) {
      toast.error(mensagemErro(e, "IA indisponível no momento."));
    } finally {
      setResumindo(false);
    }
  }
  const icones = 2 + (setAtribuirA ? 1 : 0) + (onAdicionarImagens ? 1 : 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 pb-2">
        {pendentes > 0 && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <CircleDot className="size-3.5" /> {pendentes} comentário(s) atribuído(s) esperando resolução
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {comentarios.length >= MIN_COMENTARIOS_RESUMO && !resumo && (
            <button type="button" onClick={resumir} disabled={resumindo} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-marca-primary hover:bg-marca-light/50 disabled:opacity-50">
              {resumindo ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {resumindo ? "Resumindo…" : "Resumir com IA"}
            </button>
          )}
          {criacao && (
            <button
              type="button"
              onClick={() => setMostrarRobo((v) => !v)}
              aria-pressed={mostrarRobo}
              aria-label={mostrarRobo ? "Esconder as mensagens automáticas" : "Mostrar as mensagens automáticas"}
              title={mostrarRobo ? "Esconder as mensagens automáticas" : "Mostrar as mensagens automáticas"}
              className={`flex size-8 items-center justify-center rounded-md transition ${mostrarRobo ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"}`}
            >
              <Bot className="size-4" />
            </button>
          )}
        </div>
      </div>
      {resumo && (
        <div className="mb-3 max-h-56 shrink-0 overflow-y-auto rounded-lg border border-marca-primary/30 bg-marca-light/30 p-3 text-sm" aria-live="polite">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-marca-primary"><Sparkles className="size-3.5" /> Resumo da conversa (IA)</p>
            <button type="button" onClick={() => setResumo(null)} aria-label="Fechar o resumo" className="text-gray-400 hover:text-gray-700"><X className="size-4" /></button>
          </div>
          {resumo.resumo.situacao && <p className="text-gray-800">{resumo.resumo.situacao}</p>}
          {resumo.resumo.decisoes.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold text-gray-600">Já decidido</p>
              <ul className="list-disc space-y-0.5 pl-5 text-gray-700">{resumo.resumo.decisoes.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
          {resumo.resumo.pendencias.length > 0 && (
            <>
              <p className="mt-2 text-xs font-semibold text-gray-600">Falta</p>
              <ul className="list-disc space-y-0.5 pl-5 text-gray-700">{resumo.resumo.pendencias.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </>
          )}
          {resumo.resumo.proximo_passo && <p className="mt-2 text-gray-700"><span className="font-semibold">Próximo passo:</span> {resumo.resumo.proximo_passo}</p>}
          <p className="mt-2 text-[11px] text-gray-500">
            Gerado por IA a partir de {resumo.usados === resumo.total ? `${resumo.total} comentários` : `${resumo.usados} dos ${resumo.total} comentários (os mais novos)`}. Confira nos comentários; o resumo não fica salvo.
          </p>
        </div>
      )}

      <div ref={listaRef} className="max-h-[55vh] min-h-40 flex-1 overflow-y-auto pr-1 lg:max-h-none">
        <div className="flex min-h-full flex-col justify-end gap-4 py-2">
          {isLoading && <p className="text-xs text-gray-400">Carregando…</p>}
          {mensagens.map((m) => {
            if (m.tipo === "robo") {
              return (
                <div key="robo" className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900" aria-hidden>
                    <Bot className="size-5" />
                  </span>
                  <div className="min-w-0 max-w-[80%] rounded-md bg-amber-100 px-5 py-3 text-amber-950">
                    <p className="text-[11px] font-semibold">{dataHora(m.em)}</p>
                    <p className="text-sm">{m.texto}</p>
                  </div>
                </div>
              );
            }
            const item = m.item;
            if (item.kind !== "comentario") return null;
            const idComentario = item.key.slice("cmt:".length);
            const meu = ehMeuComentario(item.ator, meuNome);
            const atribuido = item.atribuido_a ?? null;
            const resolvido = !!item.resolvido_em;
            const souEu = !!atribuido && !!meuEmail && atribuido.toLowerCase() === meuEmail.toLowerCase();
            const podeResolver = !!atribuido && !!onResolver && (souEu || podeResolverTodos);
            return (
              <div key={item.key} className={`group flex items-start gap-3 ${meu ? "flex-row-reverse" : ""}`}>
                <AvatarPessoa nome={item.ator ?? "?"} className="size-9 shrink-0 text-xs" />
                <div className={`min-w-0 max-w-[80%] rounded-md px-5 py-3 ${meu ? "bg-sky-100" : "bg-gray-100"} ${atribuido && !resolvido ? "ring-1 ring-amber-300" : ""}`}>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold uppercase tracking-wide">
                    <span className="font-bold text-gray-800">{item.ator ?? "—"}</span>
                    <span className="text-gray-400" title={dataHora(item.created_at)}>{quandoComentario(item.created_at, agora)}</span>
                  </p>
                  {!(item.texto === TEXTO_SO_IMAGEM && porComentario.has(idComentario)) && (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-gray-800">
                      {partesComMencoes(item.texto ?? "", pessoasMencao).map((p, i) =>
                        p.pessoa ? (
                          <span key={i} title={p.pessoa.email} className="rounded bg-marca-light/60 px-0.5 font-medium text-marca-primary">{p.texto}</span>
                        ) : (
                          <span key={i}>{p.texto}</span>
                        ),
                      )}
                    </p>
                  )}
                  {(porComentario.get(idComentario) ?? []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {porComentario.get(idComentario)!.map((a) => (
                        <MiniaturaSalva key={a.id} anexo={a} onAbrir={() => setAmpliada({ anexo: a })} />
                      ))}
                    </div>
                  )}
                  {atribuido && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-gray-600">
                        <UserRound className="size-3.5" /> Para {souEu ? "você" : nomeDe(atribuido)}
                      </span>
                      {resolvido ? (
                        <span className="inline-flex items-center gap-1 text-marca-primary">
                          <CheckCircle2 className="size-3.5" /> resolvido por {nomeDe(item.resolvido_por)} em {dataHora(item.resolvido_em!)}
                        </span>
                      ) : (
                        <span className="font-medium text-amber-700">pendente</span>
                      )}
                      {podeResolver && (
                        <button
                          type="button"
                          onClick={() => onResolver!(idComentario, !resolvido)}
                          className={`rounded-md px-2 py-0.5 font-semibold ${resolvido ? "text-gray-500 hover:bg-gray-100" : "bg-marca-primary text-white hover:bg-marca-accent"}`}
                        >
                          {resolvido ? "Reabrir" : "Resolver"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {!ro && (
                  <button
                    type="button"
                    aria-label="Excluir comentário"
                    onClick={() => onExcluirComentario(idComentario)}
                    className="self-center text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          {!isLoading && comentarios.length === 0 && <p className="text-center text-xs text-gray-400">Nenhum comentário ainda.</p>}
        </div>
      </div>

      {podeComentar && (
        <div
          ref={caixaRef}
          data-colar-comentario=""
          onKeyDown={(e) => {
            // Esc fecha a janelinha do emoji/atribuir (e não a janela do cartão).
            if (!e.defaultPrevented && e.key === "Escape" && aberto) {
              e.preventDefault();
              setAberto(null);
              inputRef.current?.focus();
            }
          }}
          className="shrink-0 border-t border-gray-200 pt-3"
        >
        {setAtribuirA && atribuirA && (
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            <UserRound className="size-3.5" /> Atribuir a {nomeDe(atribuirA)}: vira pendência até ser resolvido
            <button type="button" onClick={() => setAtribuirA("")} aria-label="Não atribuir" className="text-amber-600 hover:text-amber-900">
              <X className="size-3.5" />
            </button>
          </p>
        )}
        {imagensRascunho.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {imagensRascunho.map((f, i) => (
              <MiniaturaRascunho key={`${i}-${f.name}`} arquivo={f} pequena onAbrir={() => setAmpliada({ arquivo: f })} onTirar={() => onTirarImagem?.(i)} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              value={novoComentario}
              role="combobox"
              aria-expanded={menuAberto}
              aria-controls="comentario-mencoes"
              aria-autocomplete="list"
              aria-label="Escrever um comentário"
              onChange={(e) => { setNovoComentario(e.target.value); setCursor(e.target.selectionStart ?? e.target.value.length); }}
              onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
              onFocus={() => { setFocado(true); setAberto(null); }}
              onBlur={() => setFocado(false)}
              onKeyDown={(e) => {
                // Com a lista do "@" aberta, as setas andam, Enter/Tab escolhem e Esc fecha só a lista (não envia nem fecha a janela).
                if (menuAberto && digitando) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const n = sugestoes.length;
                    setDestaque((d) => (d + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    escolherPessoa(sugestoes[Math.min(destaque, sugestoes.length - 1)]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setFechado({ inicio: digitando.inicio, termo: digitando.termo });
                    return;
                  }
                }
                if (e.key === "Enter" && podeEnviar && !enviando) {
                  e.preventDefault();
                  onEnviar();
                }
              }}
              placeholder="Digite uma mensagem…"
              title={onAdicionarImagens ? "@ marca alguém; Ctrl+V cola imagem" : "@ marca alguém"}
              style={{ paddingRight: `${0.75 + icones * 2.125}rem` }}
              className="h-11 w-full rounded-md border border-transparent bg-gray-100 pl-4 text-sm text-gray-800 placeholder:text-gray-500 focus:border-marca-primary focus:bg-white focus:outline-none"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => alternar("emoji")}
                aria-label="Inserir emoji"
                aria-expanded={aberto === "emoji"}
                title="Emoji"
                className={`${botaoIcone} ${aberto === "emoji" ? "bg-gray-200 text-gray-700" : ""}`}
              >
                <Smile className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={comecarMencao}
                aria-label="Marcar uma pessoa (@)"
                title="Marcar uma pessoa: ela recebe o aviso nas notificações"
                className={botaoIcone}
              >
                <AtSign className="size-[18px]" />
              </button>
              {setAtribuirA && (
                <button
                  type="button"
                  onClick={() => alternar("atribuir")}
                  aria-label="Atribuir o comentário a alguém"
                  aria-expanded={aberto === "atribuir"}
                  title="Atribuir: o comentário vira pendência da pessoa até ser resolvido"
                  className={`${botaoIcone} ${atribuirA ? "text-amber-600" : ""} ${aberto === "atribuir" ? "bg-gray-200 text-gray-700" : ""}`}
                >
                  <UserRoundPlus className="size-[18px]" />
                </button>
              )}
              {onAdicionarImagens && (
                <>
                  <button
                    type="button"
                    onClick={() => arquivoRef.current?.click()}
                    aria-label="Inserir imagem no comentário"
                    title="Inserir imagem no comentário"
                    className={botaoIcone}
                  >
                    <Paperclip className="size-[18px]" />
                  </button>
                  <input ref={arquivoRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ""; if (l.length) onAdicionarImagens(l); }} />
                </>
              )}
            </div>
            {menuAberto && (
              <ul id="comentario-mencoes" role="listbox" aria-label="Marcar pessoa"
                className="absolute bottom-full left-0 z-30 mb-1 max-h-60 w-72 max-w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {sugestoes.map((p, i) => (
                  <li
                    key={p.email}
                    role="option"
                    aria-selected={i === destaque}
                    onMouseDown={(e) => { e.preventDefault(); escolherPessoa(p); }}
                    onMouseEnter={() => setDestaque(i)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 ${i === destaque ? "bg-marca-light/60" : ""}`}
                  >
                    <AvatarPessoa nome={p.nome} className="size-6 text-[9px]" />
                    <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                  </li>
                ))}
              </ul>
            )}
            {aberto === "emoji" && (
              <div role="dialog" aria-label="Emojis" className="absolute bottom-full right-0 z-30 mb-1 grid grid-cols-8 gap-0.5 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                {EMOJIS.map((em) => (
                  <button key={em} type="button" onClick={() => inserirEmoji(em)} aria-label={em}
                    className="flex size-8 items-center justify-center rounded text-lg hover:bg-gray-100">
                    {em}
                  </button>
                ))}
              </div>
            )}
            {aberto === "atribuir" && setAtribuirA && (
              <div role="dialog" aria-label="Atribuir o comentário" className="absolute bottom-full right-0 z-30 mb-1 w-72 max-w-full rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                <input
                  autoFocus
                  value={buscaAtribuir}
                  onChange={(e) => setBuscaAtribuir(e.target.value)}
                  onKeyDown={(e) => {
                    const n = opcoesAtribuir.length;
                    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && n) {
                      e.preventDefault();
                      setDestaqueAtribuir((d) => (d + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                    } else if (e.key === "Enter" && n) {
                      e.preventDefault();
                      escolherAtribuir(opcoesAtribuir[Math.min(destaqueAtribuir, n - 1)].email);
                    }
                  }}
                  placeholder="Atribuir a…"
                  aria-label="Buscar pessoa para atribuir"
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-marca-primary focus:outline-none"
                />
                <p className="px-1 pt-1.5 text-[11px] text-gray-500">O comentário vira pendência da pessoa até ser resolvido.</p>
                <ul role="listbox" aria-label="Pessoas" className="mt-1 max-h-56 overflow-auto">
                  {atribuirA && (
                    <li role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); escolherAtribuir(""); }}
                      className="cursor-pointer rounded px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100">
                      Não atribuir
                    </li>
                  )}
                  {opcoesAtribuir.map((p, i) => (
                    <li
                      key={p.email}
                      role="option"
                      aria-selected={p.email.toLowerCase() === atribuirA.toLowerCase()}
                      onMouseDown={(e) => { e.preventDefault(); escolherAtribuir(p.email); }}
                      onMouseEnter={() => setDestaqueAtribuir(i)}
                      className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 ${i === destaqueAtribuir ? "bg-marca-light/60" : ""}`}
                    >
                      <AvatarPessoa nome={p.nome} className="size-6 text-[9px]" />
                      <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                    </li>
                  ))}
                  {opcoesAtribuir.length === 0 && <li className="px-2 py-1.5 text-sm text-gray-400">Ninguém com esse nome</li>}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onEnviar}
            disabled={!podeEnviar || enviando}
            aria-label="Enviar comentário"
            title="Enviar (Enter)"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-marca-primary transition hover:bg-marca-light/50 disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            {enviando ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </div>
        {marcados.length > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-gray-500">
            <AtSign className="size-3.5 text-marca-primary" />
            Vai avisar: {marcados.map((e) => pessoasMencao.find((p) => p.email === e)?.nome ?? e).join(", ")}
          </p>
        )}
        </div>
      )}
      <ImagemAmpliada imagem={ampliada} onClose={() => setAmpliada(null)} />
    </div>
  );
}
