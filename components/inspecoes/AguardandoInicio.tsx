"use client";

// Associado só abre o documento com o tempo contando (pedidos dele, 30/10/2026).
//
// Vale no relatório e na Versão PGR — os dois caminhos do documento (SGG). Quem está associado
// à inspeção e não é supervisor/admin, sem a própria sessão de trabalho aberta (v311), vê este
// aviso no lugar do documento, com ▶ Iniciar (ou Retomar). A sessão abre pelo banco
// (documento_sessao_iniciar): com o documento pendente ele passa a Em elaboração, e o documento
// abre na hora. Documento entregue abre para leitura. Com a sessão aberta, a página avisa a
// atividade (useAtividadeSessao) — sem isso a sessão pausa sozinha com 30 min parada.

import Link from "next/link";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { useAgora, useAtividadeSessao, useIniciarSessao, useSessoesDocumentos } from "@/lib/hooks/useDocumentoSessoes";
import { useInspecaoAssociados } from "@/lib/hooks/useInspecaoAssociados";
import { ehSupervisor, useCurrentUser } from "@/lib/hooks/useUsuario";
import { associadoAguardandoInicio, ehAssociado } from "@/lib/inspecoes/inicio";
import { MINUTOS_INATIVIDADE, minhaSessaoAberta } from "@/lib/inspecoes/sessoes";

/**
 * O documento desta inspeção está esperando o associado iniciar?
 * `carregando` enquanto associados e sessões não chegam — a página espera, para não mostrar
 * o documento por um instante e depois escondê-lo. Também liga o aviso de atividade quando a
 * minha sessão está aberta (vale para o editor da inspeção, que não bloqueia).
 */
export function useAguardandoInicio(
  idInspecao: string,
  elaboracaoStatus: string | null | undefined,
): { carregando: boolean; aguardando: boolean; jaTrabalhou: boolean } {
  const user = useCurrentUser();
  const agora = useAgora();
  const { data: associados, isLoading } = useInspecaoAssociados(idInspecao);
  const sessoes = useSessoesDocumentos([idInspecao]);
  const minha = minhaSessaoAberta(sessoes.data ?? [], user?.id_usuario, agora);
  useAtividadeSessao(idInspecao, !!minha);

  if (!user || ehSupervisor(user) || !ehAssociado(user, associados ?? [])) {
    return { carregando: !!user && !ehSupervisor(user) && isLoading, aguardando: false, jaTrabalhou: false };
  }
  if (sessoes.isLoading) return { carregando: true, aguardando: false, jaTrabalhou: false };
  return {
    carregando: false,
    aguardando: associadoAguardandoInicio(user, false, associados ?? [], elaboracaoStatus, !!minha),
    jaTrabalhou: (sessoes.data ?? []).some((s) => s.id_usuario === user.id_usuario),
  };
}

export default function AguardandoInicio({
  idInspecao,
  empresa,
  jaTrabalhou,
}: {
  idInspecao: string;
  empresa?: string | null;
  jaTrabalhou?: boolean;
}) {
  const iniciar = useIniciarSessao();
  const rotulo = jaTrabalhou ? "Retomar" : "Iniciar";

  return (
    <div className="mx-auto mt-8 max-w-lg rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm">
      <p className="text-base font-semibold text-gray-900">
        {jaTrabalhou ? "Retome para voltar ao documento" : "Inicie a elaboração para abrir o documento"}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Você está associado a esta inspeção{empresa ? ` (${empresa})` : ""}. O documento abre com o seu tempo contando: ao
        apertar {rotulo}, começa a sua sessão de trabalho. Ela pausa sozinha depois de {MINUTOS_INATIVIDADE} minutos sem
        atividade.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={iniciar.isPending}
          onClick={() => iniciar.mutate(idInspecao)}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {iniciar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {rotulo}
        </button>
        <Link
          href="/inspecoes/minhas?papel=associado"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft className="size-4" /> Minhas inspeções
        </Link>
      </div>
    </div>
  );
}
