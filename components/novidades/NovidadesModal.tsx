"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Megaphone } from "lucide-react";
import Modal from "@/components/ui/Modal";
import NovidadeItem from "@/components/novidades/NovidadeItem";
import { ajudaDaRotaAtual } from "@/lib/novidades/ajuda-rotas";
import {
  LIMITE_MODAL,
  useMarcarVistas,
  useNovidadesNaoVistas,
  usePodeVerNovidades,
} from "@/lib/hooks/useNovidades";

/**
 * O modal que conta o que mudou.
 *
 * Montado no layout raiz, ao lado do UpdateBanner, e se protege sozinho:
 *   • useUserStore NAO e persistido -- na tela de login a store esta vazia e
 *     este componente devolve null antes de qualquer fetch.
 *   • Cliente nao ve (usePodeVerNovidades).
 *   • Nao aparece dentro de laudo nem de impressao (ver ROTAS_MUDAS).
 *
 * EU RECOMENDEI NAO USAR MODAL, e o Sanmyo decidiu por modal (01/09). Entao ele
 * foi feito para nao virar o modal que todo mundo fecha no reflexo: aparece so
 * quando existe coisa que a pessoa nao viu, corta em LIMITE_MODAL, e fechar ja
 * marca como visto -- nao volta amanha perguntando de novo.
 *
 * ABRE NA HORA, SEM ATRASO. Havia aqui um setTimeout de 1,2s, para o modal nao
 * roubar o clique de quem ja sabia onde ia clicar; o Sanmyo pediu que aparecesse
 * "assim que a pessoa abrir o painel" (01/09) e ele saiu.
 *
 * Isso NAO quer dizer que ele pinta antes da tela: o modal so pode abrir depois
 * que useVistas responde -- sem saber o que a pessoa ja viu, ele mostraria a
 * lista errada e se corrigiria na cara dela. O que sobrou e o tempo da consulta,
 * que e o minimo honesto.
 *
 * CONTA NOVA TAMBEM VE (decisao dele em 02/09). Antes havia aqui um efeito que
 * semeava a linha com tudo marcado como visto no primeiro acesso, para nao
 * incomodar quem acabava de chegar; ele saiu. A linha passa a nascer quando a
 * pessoa fecha o modal, igual a de todo mundo -- quem nunca fechou nada volta a
 * ver na proxima entrada, que e o comportamento correto para quem nao leu.
 */

/**
 * Onde o modal fica calado. Interromper alguem no meio de um laudo, de uma
 * assinatura ou de uma captura de campo custa o trabalho dela; a novidade
 * espera a proxima tela.
 */
const ROTAS_MUDAS = [
  "/login",
  "/portal-cliente",
  "/relatorio",      // laudos abertos para leitura/impressao
  "/pdf",
  "/assinar",
  "/pendencias",     // captura offline no aparelho, em campo
];

export default function NovidadesModal() {
  const pathname = usePathname();
  const pode = usePodeVerNovidades();
  const { naoVistas } = useNovidadesNaoVistas();
  const marcar = useMarcarVistas();

  const [aberto, setAberto] = useState(false);
  const [visto, setVisto] = useState(false);
  const jaAbriu = useRef(false);

  const rotaMuda = ROTAS_MUDAS.some((r) => pathname.startsWith(r));
  // So oferece "ver todas" quando ha uma ajuda de modulo por perto. Do hub,
  // mandar a pessoa para a ajuda da Frota a deixaria num modulo que nao abriu.
  const rotaAjuda = ajudaDaRotaAtual(pathname);

  useEffect(() => {
    if (!pode || rotaMuda || visto || jaAbriu.current) return;
    if (naoVistas.length === 0) return;
    jaAbriu.current = true;
    setAberto(true);
  }, [pode, rotaMuda, visto, naoVistas.length]);

  function fechar() {
    setAberto(false);
    setVisto(true);
    // Marca TUDO como visto, e nao so o que coube no modal: o que ficou de fora
    // ja esta na aba, e voltaria como novo amanha reabrindo o modal para sempre.
    marcar.mutate();
  }

  if (!pode || !aberto) return null;

  const mostrados = naoVistas.slice(0, LIMITE_MODAL);
  const sobraram = naoVistas.length - mostrados.length;

  return (
    <Modal
      open={aberto}
      onClose={fechar}
      size="lg"
      title={naoVistas.length === 1 ? "Uma novidade no painel" : `${naoVistas.length} novidades no painel`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {rotaAjuda ? (
            <Link
              href={`${rotaAjuda}?aba=atualizacoes`}
              onClick={fechar}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
            >
              Ver todas as atualizações
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={fechar}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Entendi
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-gray-600">
          <Megaphone className="mt-0.5 size-4 shrink-0 text-blue-600" />
          <span>
            Isto apareceu desde a última vez que você entrou. Depois de fechar, a lista
            completa fica na <strong>Ajuda</strong> de qualquer módulo, na aba{" "}
            <strong>Atualizações</strong>.
          </span>
        </p>

        {mostrados.map((item) => (
          <NovidadeItem key={item.id} item={item} compacto />
        ))}

        {sobraram > 0 && (
          <p className="pt-1 text-center text-xs text-gray-500">
            e mais {sobraram} {sobraram === 1 ? "atualização" : "atualizações"} na aba Atualizações
          </p>
        )}
      </div>
    </Modal>
  );
}
