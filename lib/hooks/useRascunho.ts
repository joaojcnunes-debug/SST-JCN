"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/hooks/useUsuario";

/**
 * Rascunho local de formulário — proteção contra QUEDA DE LUZ.
 *
 * Pedido do usuário (2026-08-06): "caso caia a luz ele não perca todo seu
 * serviço, não vamos salvar coisas de dias atrás". Por isso:
 *
 * - **`localStorage`, não `sessionStorage`**: na queda de luz a máquina
 *   reinicia e o `sessionStorage` some junto — ele não cobriria justamente o
 *   caso pedido.
 * - **Validade de 1 h** (definida pelo usuário em 2026-08-06): a empresa tem
 *   gerador, então o buraco a cobrir é o instante da queda, não o dia inteiro.
 *   Quanto menor a janela, menos rascunho velho circulando.
 * - **NUNCA restaura sozinho.** O hook só avisa que existe algo guardado; quem
 *   manda voltar é o usuário, clicando. Sem isso, um rascunho poderia voltar
 *   sem ninguém perceber e acabar salvo num laudo que vai assinado ao cliente.
 * - A chave inclui o e-mail de quem está logado, para um rascunho não vazar
 *   para outra pessoa no mesmo computador.
 *
 * ⚠️ Guarde só o que é serializável. Foto (`File`) não sobrevive — o que for
 * anexado antes da queda precisa ser anexado de novo.
 */

const PREFIXO = "painel-rascunho:";
const VALIDADE_MS = 60 * 60 * 1000;
const DEBOUNCE_MS = 700;

/**
 * Tetos de segurança. Medido na produção em 2026-08-06, um rascunho real ocupa
 * ~1 KB (risco: média 1.272 B, maior 1.844 B; extintor 771 B; treinamento
 * 337 B) e o navegador dá ~5 MB por site — ou seja, o consumo normal é
 * irrelevante. Estes limites existem para que continue sendo verdade mesmo se
 * algum formulário futuro resolver guardar algo grande (texto colado enorme,
 * imagem em base64). Rascunho é conveniência: melhor não gravar do que pesar.
 */
const TAMANHO_MAX_BYTES = 100 * 1024;
const MAX_RASCUNHOS = 30;

interface Guardado<T> {
  em: number;
  valor: T;
}

/**
 * Faxina: apaga o que venceu e, se ainda assim houver rascunho demais, descarta
 * os mais antigos. Roda a cada abertura de formulário — é o que garante que o
 * espaço usado não cresce com o tempo.
 */
function limparVencidos() {
  try {
    const vivos: { chave: string; em: number }[] = [];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIXO)) continue;
      try {
        const g = JSON.parse(localStorage.getItem(k) ?? "null") as Guardado<unknown> | null;
        if (!g?.em || Date.now() - g.em > VALIDADE_MS) localStorage.removeItem(k);
        else vivos.push({ chave: k, em: g.em });
      } catch {
        localStorage.removeItem(k);
      }
    }
    if (vivos.length > MAX_RASCUNHOS) {
      vivos
        .sort((a, b) => a.em - b.em)
        .slice(0, vivos.length - MAX_RASCUNHOS)
        .forEach((r) => localStorage.removeItem(r.chave));
    }
  } catch {
    // localStorage pode estar indisponível (aba anônima, cota cheia, política
    // do navegador). Rascunho é conveniência: falhou, segue sem ele.
  }
}

export interface RascunhoPendente<T> {
  valor: T;
  /** Há quantos minutos foi guardado — vira "há 12 min" na tela. */
  idadeMin: number;
}

export function useRascunho<T>(
  /** Identificador do formulário. `null` desliga o hook. */
  chave: string | null,
  /** Valor atual do formulário (só o que é serializável). */
  valor: T,
  opts: {
    /** Só grava quando true — normalmente `open && !isEdit`. */
    ativo: boolean;
  },
) {
  const user = useCurrentUser();
  const email = user?.email ?? "anon";
  const chaveFinal = chave ? `${PREFIXO}${email}:${chave}` : null;

  const [pendente, setPendente] = useState<RascunhoPendente<T> | null>(null);
  // Retrato de como o formulário estava ao abrir: só grava se mudou algo.
  // `null` = ainda não capturado.
  const baseRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Espelho do valor atual, para o retrato ser tirado DEPOIS do formulário zerar.
  const valorRef = useRef(valor);
  valorRef.current = valor;

  // Ao abrir: procura rascunho guardado e ANUNCIA (não aplica).
  useEffect(() => {
    if (!opts.ativo || !chaveFinal) {
      setPendente(null);
      baseRef.current = null;
      return;
    }
    limparVencidos();
    // ⚠️ O retrato NÃO pode ser tirado aqui. Os formulários zeram o estado num
    // `useEffect` próprio, que roda antes deste — neste instante `valor` ainda é
    // o do item anterior. Tirar o retrato agora faria o hook achar que o usuário
    // digitou algo assim que o formulário zerasse, e gravar rascunho de
    // formulário em branco. O timeout deixa o zeramento assentar primeiro.
    baseRef.current = null;
    const t = setTimeout(() => {
      baseRef.current = JSON.stringify(valorRef.current);
    }, 0);

    // Em função à parte para os `return` de dentro não pularem a limpeza do
    // timeout — o `return` do efeito precisa ser sempre o cleanup.
    const procurar = () => {
      try {
        const bruto = localStorage.getItem(chaveFinal);
        if (!bruto) return;
        const g = JSON.parse(bruto) as Guardado<T>;
        const idade = Date.now() - (g?.em ?? 0);
        if (!g?.em || idade > VALIDADE_MS) {
          localStorage.removeItem(chaveFinal);
          return;
        }
        setPendente({
          valor: g.valor,
          idadeMin: Math.max(1, Math.round(idade / 60000)),
        });
      } catch {
        /* rascunho corrompido ou localStorage indisponível: ignora */
      }
    };
    procurar();

    return () => clearTimeout(t);
    // Só reage a abrir/trocar de chave. O valor entra por `valorRef`, senão
    // este efeito rodaria a cada tecla e o retrato nunca se firmaria.
  }, [chaveFinal, opts.ativo]);

  // Enquanto digita: grava com atraso, e só se saiu do estado inicial.
  useEffect(() => {
    if (!opts.ativo || !chaveFinal || baseRef.current === null) return;
    const atual = JSON.stringify(valor);
    if (atual === baseRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const pacote = JSON.stringify({ em: Date.now(), valor });
        // Teto de tamanho: rascunho grande demais simplesmente não é gravado.
        // Preencher o formulário nunca pode ficar lento por causa disto.
        if (pacote.length > TAMANHO_MAX_BYTES) {
          localStorage.removeItem(chaveFinal);
          return;
        }
        localStorage.setItem(chaveFinal, pacote);
      } catch {
        /* cota cheia: não atrapalha o preenchimento */
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [valor, chaveFinal, opts.ativo]);

  /** Devolve o que estava guardado — quem aplica no formulário é o chamador. */
  const recuperar = useCallback((): T | null => {
    if (!pendente) return null;
    const v = pendente.valor;
    setPendente(null);
    baseRef.current = JSON.stringify(v);
    return v;
  }, [pendente]);

  /** Joga fora e para de oferecer. */
  const descartar = useCallback(() => {
    setPendente(null);
    if (chaveFinal) {
      try {
        localStorage.removeItem(chaveFinal);
      } catch {
        /* ignora */
      }
    }
  }, [chaveFinal]);

  /** Chamar quando o registro for salvo de verdade: o rascunho perdeu a razão. */
  const limpar = useCallback(() => {
    setPendente(null);
    if (chaveFinal) {
      try {
        localStorage.removeItem(chaveFinal);
      } catch {
        /* ignora */
      }
    }
  }, [chaveFinal]);

  return { pendente, recuperar, descartar, limpar };
}
