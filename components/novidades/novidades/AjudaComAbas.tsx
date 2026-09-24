"use client";

import { Suspense, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Megaphone } from "lucide-react";
import AtualizacoesAba from "@/components/novidades/AtualizacoesAba";
import { useNovidadesNaoVistas, usePodeVerNovidades } from "@/lib/hooks/useNovidades";
import { cn } from "@/lib/utils";

/**
 * O INVOLUCRO que da abas a uma pagina de ajuda de modulo.
 *
 * As 11 ajudas do painel eram paginas de rolagem simples, sem aba nenhuma. Em
 * vez de recortar as onze, cada uma so passa a envolver o proprio conteudo:
 *
 *   export default function AjudaFrotaPage() {
 *     return (
 *       <AjudaComAbas titulo="Como funciona a Frota">
 *         ...tudo o que ja existia, intacto...
 *       </AjudaComAbas>
 *     );
 *   }
 *
 * Sao tres linhas por arquivo e nenhuma linha de conteudo tocada. O texto da
 * ajuda de cada modulo continua sendo dele; so a aba Atualizacoes e comum.
 *
 * A ABA VEM NA URL (?aba=atualizacoes) para que o link do modal caia direto
 * nela, e para que a pessoa possa recarregar sem voltar para a primeira.
 */

type Aba = "ajuda" | "atualizacoes";

function Conteudo({ titulo, children }: { titulo?: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pode = usePodeVerNovidades();
  const { naoVistas } = useNovidadesNaoVistas();

  const inicial: Aba = searchParams.get("aba") === "atualizacoes" ? "atualizacoes" : "ajuda";
  const [aba, setAba] = useState<Aba>(inicial);

  function trocar(nova: Aba) {
    setAba(nova);
    // replace, e nao push: a aba nao merece uma entrada no historico -- o
    // "voltar" do navegador tem que sair da ajuda, nao desfazer um clique de aba.
    const qs = nova === "atualizacoes" ? "?aba=atualizacoes" : "";
    router.replace(`${pathname}${qs}`, { scroll: false });
  }

  // Cliente nao ve Atualizacoes: a ajuda dele fica exatamente como era.
  if (!pode) return <>{children}</>;

  const naoVistasCount = naoVistas.length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-1 border-b border-gray-200 print:hidden">
        <BotaoAba
          ativa={aba === "ajuda"}
          onClick={() => trocar("ajuda")}
          icone={<BookOpen className="size-4" />}
          rotulo={titulo ?? "Ajuda"}
        />
        <BotaoAba
          ativa={aba === "atualizacoes"}
          onClick={() => trocar("atualizacoes")}
          icone={<Megaphone className="size-4" />}
          rotulo="Atualizações"
          contagem={naoVistasCount}
        />
      </div>

      {/*
        As duas abas ficam MONTADAS, e a inativa some por CSS. A ajuda de modulo
        e uma pagina longa: desmontar perde a posicao da rolagem e, na AEP, o
        estado do modo de impressao -- voltar para a aba devolveria a pessoa ao
        topo de um texto de 900 linhas.
      */}
      <div className={cn(aba !== "ajuda" && "hidden")}>{children}</div>
      <div className={cn(aba !== "atualizacoes" && "hidden")}>
        <AtualizacoesAba />
      </div>
    </div>
  );
}

function BotaoAba({
  ativa,
  onClick,
  icone,
  rotulo,
  contagem = 0,
}: {
  ativa: boolean;
  onClick: () => void;
  icone: ReactNode;
  rotulo: string;
  contagem?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={ativa ? "page" : undefined}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
        ativa
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
      )}
    >
      {icone}
      <span className="truncate">{rotulo}</span>
      {contagem > 0 && (
        <span className="ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {contagem}
        </span>
      )}
    </button>
  );
}

export default function AjudaComAbas({
  titulo,
  children,
}: {
  /** Rótulo da primeira aba. Sem ele, "Ajuda". */
  titulo?: string;
  children: ReactNode;
}) {
  // O Suspense mora AQUI, e nao nas 11 paginas: useSearchParams obriga a ter
  // um, e sem isto cada ajuda teria de lembrar de embrulhar a si mesma.
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl">{children}</div>}>
      <Conteudo titulo={titulo}>{children}</Conteudo>
    </Suspense>
  );
}
