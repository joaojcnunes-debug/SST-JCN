"use client";

import { ArrowRight, MapPin } from "lucide-react";
import StorageImg from "@/components/ui/StorageImg";
import { useChecklistFotos, useChecklistRotas } from "@/lib/hooks/useFrotaChecklists";
import { ROTULO_ANGULO } from "@/lib/frota/angulos";
import { formatarKm } from "@/lib/frota/km";
import { enderecoEmLinha, linkMaps } from "@/lib/frota/maps";
import { dataHoraBr } from "@/lib/frota/painel";
import type { FrotaChecklist, FrotaVeiculo } from "@/lib/frota/tipos";

/**
 * O detalhe de UMA viagem — o corpo, sem moldura.
 *
 * POR QUE ISTO É UM COMPONENTE E NÃO O CONTEÚDO DA PÁGINA
 *   A mesma viagem é lida em dois lugares: no modal que abre pelo card da
 *   Movimentação (o caminho de todo dia) e na página em tela cheia
 *   /frota/[idVeiculo]/saida/[idChecklist] (o link que os alertas do painel e
 *   o celular guardam). Escrever duas vezes é escrever duas versões: a próxima
 *   coluna entraria numa e não na outra, e ninguém notaria por meses. Este
 *   projeto já pagou essa conta mais de uma vez.
 *
 * O QUE ESTE COMPONENTE ACRESCENTOU AO QUE EXISTIA
 *   A seção RETORNO. A página de detalhe foi escrita antes da v178 e só
 *   mostrava a ida: quem registrava a volta não tinha onde conferir depois se
 *   tinha ficado certo. Os campos estavam no banco e não apareciam em tela
 *   nenhuma.
 */

/** Só as fotos e as rotas são buscadas aqui; a viagem e o veículo vêm de fora. */
export default function DetalheViagem({
  checklist,
  veiculo,
}: {
  checklist: FrotaChecklist;
  /** Só as avarias de cadastro vêm daqui; nulo enquanto o veículo carrega. */
  veiculo: FrotaVeiculo | null | undefined;
}) {
  const { data: fotos = [] } = useChecklistFotos(checklist.id_checklist);
  const { data: rotas = [] } = useChecklistRotas(checklist.id_checklist);

  const url = linkMaps(checklist);
  const obrigatorias = fotos.filter((f) => f.angulo !== "EXTRA");
  const extras = fotos.filter((f) => f.angulo === "EXTRA");
  const rodado =
    checklist.data_retorno && checklist.km_retorno != null
      ? checklist.km_retorno - checklist.km_saida
      : null;

  return (
    <div className="space-y-4">
      {/* ── A viagem, dos dois lados ───────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">A viagem</h2>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Saída</p>
            <p className="mt-0.5 text-sm text-gray-800">{dataHoraBr(checklist.data_saida)}</p>
            <p className="text-xs tabular-nums text-gray-500">
              {formatarKm(checklist.km_saida)} km no odômetro
            </p>
            {checklist.finalizado_por && (
              <p className="mt-1 text-[11px] text-gray-400">
                Registrada por {checklist.finalizado_por}
                {checklist.finalizado_em && ` em ${dataHoraBr(checklist.finalizado_em)}`}
              </p>
            )}
          </div>

          {/* Viagem aberta não recebe caixa vazia: a ausência do retorno É a
              informação, e uma caixa com traços parece dado que se perdeu. */}
          {checklist.data_retorno ? (
            <div className="rounded-md bg-emerald-50 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-700">
                Retorno
              </p>
              <p className="mt-0.5 text-sm text-emerald-900">
                {dataHoraBr(checklist.data_retorno)}
              </p>
              <p className="text-xs tabular-nums text-emerald-800">
                {checklist.km_retorno != null
                  ? `${formatarKm(checklist.km_retorno)} km no odômetro`
                  : "sem leitura do odômetro"}
              </p>
              {checklist.retorno_por && (
                <p className="mt-1 text-[11px] text-emerald-700">
                  Lançado por {checklist.retorno_por}
                  {checklist.retorno_em && ` em ${dataHoraBr(checklist.retorno_em)}`}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-blue-200 bg-blue-50 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-blue-700">
                Retorno
              </p>
              <p className="mt-0.5 text-sm text-blue-900">Ainda não registrado</p>
              <p className="text-xs text-blue-800">O veículo consta como estando na rua.</p>
            </div>
          )}
        </div>

        {rodado != null && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-700">
            <span className="tabular-nums">{formatarKm(checklist.km_saida)}</span>
            <ArrowRight className="size-3.5 text-gray-400" />
            <span className="tabular-nums">{formatarKm(checklist.km_retorno!)}</span>
            <span className="font-semibold tabular-nums text-gray-900">
              · {formatarKm(rodado)} km nesta viagem
            </span>
          </p>
        )}

        {checklist.retorno_observacao && (
          <p className="mt-2 whitespace-pre-line rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
            {checklist.retorno_observacao}
          </p>
        )}
      </section>

      {/* ── Destino ────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Destino</h2>
        <p className="mt-1 text-sm text-gray-700">{enderecoEmLinha(checklist) || "—"}</p>
        {checklist.endereco_ponto_referencia && (
          <p className="text-xs text-gray-500">{checklist.endereco_ponto_referencia}</p>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
            <MapPin className="size-4" />
            Abrir rota no Google Maps
          </a>
        )}
      </section>

      {/* ── Fotos ──────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Fotos da saída
          <span className="ml-1 font-normal text-gray-400">
            {obrigatorias.length} de 4 obrigatórias
            {extras.length > 0 && ` · ${extras.length} extra${extras.length > 1 ? "s" : ""}`}
          </span>
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {fotos.map((f) => (
            <li key={f.id_foto}>
              <StorageImg stored={f.thumb_path} alt={ROTULO_ANGULO[f.angulo]}
                className="aspect-[4/3] w-full rounded-md border border-gray-200 object-cover" />
              <p className="mt-0.5 text-center text-[11px] text-gray-500">
                {ROTULO_ANGULO[f.angulo]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Avarias: os TRÊS níveis, que só juntos contam a história ───── */}
      {(checklist.avarias_constatadas ||
        checklist.avarias_retorno ||
        veiculo?.avarias_padrao) && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Avarias</h2>
          <div className="mt-2 space-y-2">
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                Já conhecidas (cadastro)
              </p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-gray-600">
                {veiculo?.avarias_padrao?.trim() || "—"}
              </p>
            </div>
            <div className="rounded-md bg-amber-50 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-amber-700">
                Constatadas na saída
              </p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-amber-900">
                {checklist.avarias_constatadas?.trim() || "Nada novo relatado."}
              </p>
            </div>
            {/* Só aparece depois que a viagem fecha — antes disso não existe
                "na volta", e a caixa vazia sugeriria que ninguém olhou. */}
            {checklist.data_retorno && (
              <div className="rounded-md bg-red-50 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-red-700">
                  Apareceram na volta
                </p>
                <p className="mt-0.5 whitespace-pre-line text-xs text-red-900">
                  {checklist.avarias_retorno?.trim() || "Nada novo relatado."}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Rotas ──────────────────────────────────────────────────────── */}
      {rotas.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Rotas do trajeto</h2>
          <ol className="mt-2 space-y-1.5">
            {rotas.map((r) => (
              <li key={r.id_rota} className="flex items-baseline gap-2 text-sm">
                <span className="font-mono text-xs text-gray-400">{r.ordem}.</span>
                <span className="text-gray-700">
                  {r.origem} → {r.destino}
                  {r.km_percorrido != null && (
                    <span className="tabular-nums text-gray-400">
                      {" "}· {formatarKm(r.km_percorrido)} km
                    </span>
                  )}
                  {r.finalidade && <span className="text-gray-400"> · {r.finalidade}</span>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Observações da saída ───────────────────────────────────────── */}
      {checklist.observacoes && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Observações</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
            {checklist.observacoes}
          </p>
        </section>
      )}
    </div>
  );
}
