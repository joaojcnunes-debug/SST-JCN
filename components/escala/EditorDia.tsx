"use client";

import { useState } from "react";
import { History, Loader2, Undo2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useEscalaLog } from "@/lib/hooks/useEscalaDias";
import { paraDataLocal } from "@/lib/escala/datas";
import {
  SITUACOES,
  type Alocacao,
  type EscalaDia,
  type EscalaSupervisor,
  type SituacaoEscala,
  type UnidadeDaEscala,
} from "@/lib/escala/tipos";

/**
 * Editor de UM dia da grade mensal (Fase 5).
 *
 * Diferente do editor do padrão semanal em três pontos, e cada um deles é uma
 * decisão:
 *
 *  - **Salvar aqui marca o dia como `manual`**, e manual sobrevive a qualquer
 *    regeração. É o que dá sentido à edição: a exceção não se perde.
 *  - **Existe o caminho de volta.** "Voltar ao padrão" apaga a linha, e a
 *    próxima geração a refaz. Sem isso, um clique errado viraria exceção
 *    permanente e a pessoa não teria como desfazer.
 *  - **Tem observação e trilha.** A planilha tinha uma coluna "Observações" que
 *    ninguém preenchia por não caber; aqui ela cabe, e o histórico mostra quem
 *    mexeu e no quê.
 */

export interface DiaEmEdicao {
  supervisor: EscalaSupervisor;
  data: string;
  existente: EscalaDia | null;
  alocacao: Alocacao | null;
}

interface Props {
  dia: DiaEmEdicao;
  unidades: UnidadeDaEscala[];
  feriado: string | null;
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (a: Alocacao, observacao: string) => void;
  onVoltarAoPadrao: () => void;
}

function rotuloData(iso: string): string {
  const d = paraDataLocal(iso);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Descreve o valor guardado no log em uma linha legível. */
function descrever(
  v: Record<string, unknown> | null,
  nomeDaUnidade: (id: string) => string
): string {
  if (!v) return "—";
  const ids = Array.isArray(v.unidade_ids) ? (v.unidade_ids as string[]) : [];
  if (ids.length > 0) return ids.map(nomeDaUnidade).join(" + ");
  if (typeof v.situacao === "string" && v.situacao) return v.situacao;
  return "—";
}

export default function EditorDia({
  dia,
  unidades,
  feriado,
  salvando,
  onFechar,
  onSalvar,
  onVoltarAoPadrao,
}: Props) {
  const inicial = dia.alocacao;
  const [modo, setModo] = useState<"unidades" | "situacao">(
    inicial?.tipo === "situacao" ? "situacao" : "unidades"
  );
  const [escolhidas, setEscolhidas] = useState<string[]>(
    inicial?.tipo === "unidades" ? inicial.unidade_ids : []
  );
  const [situacao, setSituacao] = useState<SituacaoEscala>(
    inicial?.tipo === "situacao" ? inicial.situacao : "Visita ao cliente"
  );
  const [observacao, setObservacao] = useState(dia.existente?.observacao ?? "");
  const [verHistorico, setVerHistorico] = useState(false);

  const { data: log = [], isLoading: carregandoLog } = useEscalaLog(
    verHistorico ? dia.existente?.id_dia : null
  );

  const nomeDaUnidade = (id: string) =>
    unidades.find((u) => u.id_unidade === id)?.nome ?? "unidade removida";

  const valido = modo === "unidades" ? escolhidas.length > 0 : true;
  const ehManual = dia.existente?.origem === "manual";

  function alternar(id: string) {
    setEscolhidas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  }

  return (
    <Modal
      open
      onClose={onFechar}
      size="lg"
      title={`${dia.supervisor.nome_resumido || dia.supervisor.nome} — ${rotuloData(dia.data)}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          {dia.existente ? (
            <button
              type="button"
              onClick={onVoltarAoPadrao}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              title="Apaga a exceção. A próxima geração refaz o dia pelo padrão semanal."
            >
              <Undo2 className="size-4" />
              Voltar ao padrão
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() =>
                onSalvar(
                  modo === "unidades"
                    ? { tipo: "unidades", unidade_ids: escolhidas }
                    : { tipo: "situacao", situacao },
                  observacao
                )
              }
              disabled={!valido || salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490] disabled:opacity-60"
            >
              {salvando && <Loader2 className="size-4 animate-spin" />}
              Salvar exceção
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {ehManual ? (
            <Badge variant="warning">exceção — mexida à mão</Badge>
          ) : dia.existente ? (
            <Badge variant="muted">vindo do padrão semanal</Badge>
          ) : (
            <Badge variant="muted">dia ainda não gerado</Badge>
          )}
          {feriado && <Badge variant="danger">{feriado}</Badge>}
        </div>

        <p className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600">
          O que você salvar aqui vira <strong>exceção</strong> e não é desfeito por uma
          regeração do mês. Para o dia voltar a seguir o padrão semanal, use{" "}
          <strong>Voltar ao padrão</strong>.
        </p>

        <div className="flex rounded-lg border border-gray-300 p-0.5">
          {(
            [
              ["unidades", "Em unidade"],
              ["situacao", "Outra situação"],
            ] as const
          ).map(([v, rotulo]) => (
            <button
              key={v}
              type="button"
              onClick={() => setModo(v)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium",
                modo === v ? "bg-[#0891B2] text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {modo === "unidades" ? (
          <div className="flex flex-wrap gap-1.5">
            {unidades.map((u) => {
              const on = escolhidas.includes(u.id_unidade);
              return (
                <button
                  key={u.id_unidade}
                  type="button"
                  onClick={() => alternar(u.id_unidade)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm",
                    on
                      ? "border-[#0891B2] bg-cyan-50 font-medium text-[#0E7490]"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: u.cor_hex }}
                  />
                  {u.nome}
                </button>
              );
            })}
          </div>
        ) : (
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as SituacaoEscala)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">
            Observação <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="ex.: cobertura da Amanda, que está de atestado"
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        {dia.existente && (
          <div className="border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => setVerHistorico((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0E7490]"
            >
              <History className="size-3.5" />
              {verHistorico ? "Esconder o histórico" : "Ver quem mexeu neste dia"}
            </button>

            {verHistorico && (
              <div className="mt-2 space-y-1.5">
                {carregandoLog && (
                  <p className="text-xs text-gray-500">Carregando o histórico…</p>
                )}
                {!carregandoLog && log.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Sem alterações registradas — o dia veio da geração do mês.
                  </p>
                )}
                {log.map((l) => (
                  <div
                    key={l.id_log}
                    className="rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-gray-700">{l.ator_email}</span>
                      <span className="tabular-nums text-gray-500">{quando(l.criado_em)}</span>
                    </div>
                    <p className="mt-0.5 text-gray-600">
                      {descrever(l.valor_anterior, nomeDaUnidade)}{" "}
                      <span className="text-gray-400">→</span>{" "}
                      <strong>{descrever(l.valor_novo, nomeDaUnidade)}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
