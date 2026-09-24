"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  FileEdit,
  KeyRound,
  Loader2,
  RefreshCw,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useFilaOffline } from "@/lib/hooks/useFilaOffline";
import { formatarPlaca } from "@/lib/frota/placa";
import { formatarKm, } from "@/lib/frota/km";
import { formatarBytes } from "@/lib/frota/fotos";
import type { SaidaOffline } from "@/lib/offline/db";
import { cn } from "@/lib/utils";

/**
 * O que está no aparelho e ainda não chegou ao painel.
 *
 * ESTA TELA É A CONTRAPARTIDA DO OFFLINE. Guardar a saída no celular sem ter
 * onde ver o que ficou para trás transforma "funciona sem internet" em "some sem
 * avisar" — o técnico só descobriria pela cobrança do gerente, semanas depois.
 * Enquanto houver uma linha aqui, o trabalho não terminou.
 *
 * Rascunho NUNCA volta sozinho, pela mesma regra que o `useRascunho` fixou em
 * 06/08: quem manda retomar é a pessoa. O que a tela faz é lembrar que existe.
 */
export default function PendenciasPage() {
  const {
    rascunhos,
    aguardando,
    recusadas,
    enviadas,
    naoResolvidas,
    carregando,
    sincronizando,
    online,
    espaco,
    enviarAgora,
  } = useFilaOffline();

  const precisaReautenticar = aguardando.some((s) => s.status === "REAUTENTICAR");

  /**
   * "Corrigir" — reabrir no assistente uma saída que ainda não chegou ao painel.
   *
   * SÓ ENQUANTO ESTÁ NO APARELHO. Depois de confirmada ela é registro do painel,
   * e por isso a seção "Já enviadas" não recebe este botão.
   *
   * SOME ENQUANTO SOBE, por dois motivos que se somam: `ENVIANDO` é a saída cujas
   * fotos estão indo para o MinIO neste instante — mexer nela deixaria a fila
   * retomando de um estado que não existe mais —, e `sincronizando` é a rodada
   * manual em curso, que pode chegar nesta saída a qualquer segundo. O
   * `abrirCorrecao` recusa de novo do outro lado, para o toque que acontecer
   * exatamente na virada.
   */
  const acaoCorrigir = (s: SaidaOffline, cor: string) => {
    if (s.status === "ENVIANDO" || sincronizando) {
      return <span className="text-[11px] text-gray-400">enviando…</span>;
    }
    return (
      <Link
        href={`/frota/${s.id_veiculo}/saida?corrigir=${s.id_checklist}`}
        className={cn("rounded-md border px-2.5 py-1.5 text-xs font-semibold", cor)}
      >
        Corrigir
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Guardado no aparelho</h1>
          <p className="text-sm text-gray-500">
            {carregando
              ? "Lendo o aparelho…"
              : naoResolvidas === 0
                ? "Nada pendente — tudo o que você registrou já está no painel."
                : `${naoResolvidas} ${naoResolvidas === 1 ? "saída ainda não resolvida" : "saídas ainda não resolvidas"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              online ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
            )}
          >
            {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online ? "Com rede" : "Sem rede"}
          </span>
          <button
            type="button"
            onClick={() => void enviarAgora()}
            disabled={sincronizando || !online}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sincronizando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Enviar agora
          </button>
        </div>
      </div>

      {/* A sessão do Cloudflare Access caiu. É o único erro que se resolve
          sozinho ao entrar de novo — e por isso vem antes de tudo. */}
      {precisaReautenticar && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Sua sessão expirou</p>
            <p className="mt-0.5 text-amber-800">
              Nada foi perdido. Recarregue a página, entre de novo e volte aqui — o envio continua
              de onde parou.
            </p>
          </div>
        </div>
      )}

      {espaco && espaco.total > 0 && espaco.usado / espaco.total > 0.8 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-sm text-red-900">
            <p className="font-semibold">O aparelho está quase sem espaço</p>
            <p className="mt-0.5 text-red-800">
              {formatarBytes(espaco.usado)} de {formatarBytes(espaco.total)} em uso. Envie as saídas
              pendentes antes de registrar novas.
            </p>
          </div>
        </div>
      )}

      {!carregando && naoResolvidas === 0 && enviadas.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <CheckCircle2 className="mx-auto size-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nada guardado no aparelho</p>
          <p className="mt-1 text-sm text-gray-500">
            As saídas registradas sem internet aparecem aqui até subirem para o painel.
          </p>
        </div>
      )}

      <Secao
        titulo="Não terminadas"
        descricao="Você começou o registro e parou no meio. Elas não sobem enquanto não forem finalizadas."
        icone={<FileEdit className="size-4 text-amber-600" />}
        saidas={rascunhos}
        cor="border-amber-300"
        acao={(s) => (
          <Link
            href={`/frota/${s.id_veiculo}/saida?rascunho=${s.id_checklist}`}
            className="rounded-md border border-amber-400 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            Retomar
          </Link>
        )}
      />

      <Secao
        titulo="Aguardando envio"
        descricao="Prontas e guardadas. Sobem sozinhas assim que houver rede — e dá para corrigir enquanto não subiram."
        icone={<Upload className="size-4 text-blue-600" />}
        saidas={aguardando}
        cor="border-blue-200"
        acao={(s) =>
          acaoCorrigir(s, "border-blue-300 text-blue-800 hover:bg-blue-100")
        }
      />

      <Secao
        titulo="Recusadas pelo painel"
        descricao="O servidor respondeu e disse não. Tentar de novo sem mudar nada dá o mesmo resultado — leia o motivo e corrija."
        icone={<CloudOff className="size-4 text-red-600" />}
        saidas={recusadas}
        cor="border-red-300"
        acao={(s) => acaoCorrigir(s, "border-red-400 text-red-800 hover:bg-red-100")}
      />

      <Secao
        titulo="Já enviadas"
        descricao="Confirmadas no painel. Somem desta lista depois de uma semana."
        icone={<CheckCircle2 className="size-4 text-emerald-600" />}
        saidas={enviadas}
        cor="border-emerald-200"
      />
    </div>
  );
}

function Secao({
  titulo,
  descricao,
  icone,
  saidas,
  cor,
  acao,
}: {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  saidas: SaidaOffline[];
  cor: string;
  acao?: (s: SaidaOffline) => React.ReactNode;
}) {
  if (saidas.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icone}
        <h2 className="text-sm font-semibold text-gray-900">
          {titulo} <span className="font-normal text-gray-400">· {saidas.length}</span>
        </h2>
      </div>
      <p className="text-xs text-gray-500">{descricao}</p>

      <ul className="space-y-2">
        {saidas.map((s) => (
          <li key={s.id_checklist} className={cn("rounded-lg border bg-white p-3", cor)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold tracking-wider text-gray-900">
                    {formatarPlaca(s.placa)}
                  </span>
                  <span className="text-sm text-gray-600">{s.checklist.condutor_nome}</span>
                  {s.status === "ENVIANDO" && (
                    <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                      <Loader2 className="size-3 animate-spin" />
                      enviando
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {s.modelo} · {s.fotos.length} {s.fotos.length === 1 ? "foto" : "fotos"}
                </p>

                {/* O motivo, quando existe. Mensagem de banco é ríspida, mas
                    esconder deixaria o técnico sem nada para levar ao gerente. */}
                {s.ultimo_erro && (
                  <p className="mt-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    {s.ultimo_erro}
                  </p>
                )}
                {s.tentativas > 0 && s.status !== "ENVIADO" && (
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {s.tentativas} {s.tentativas === 1 ? "tentativa" : "tentativas"}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="font-mono text-xs tabular-nums text-gray-500">
                  {new Date(s.criado_em).toLocaleDateString("pt-BR")}
                </p>
                <p className="font-mono text-xs tabular-nums text-gray-400">
                  {formatarKm(s.checklist.km_saida)} km
                </p>
                {acao && <div className="mt-1.5">{acao(s)}</div>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
