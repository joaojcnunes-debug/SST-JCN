"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, Loader2, Trash2, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import {
  usePodeEditarEscala,
  useEscalaSupervisores,
  useUnidadesDaEscala,
} from "@/lib/hooks/useEscalaCadastro";
import {
  indexarPadrao,
  useEncerrarPadrao,
  useEscalaPadrao,
  useSalvarPadrao,
} from "@/lib/hooks/useEscalaPadrao";
import { dataPura } from "@/lib/escala/datas";
import {
  DIAS_UTEIS,
  SITUACOES,
  colunasParaAlocacao,
  type Alocacao,
  type DiaUtilSemana,
  type EscalaSupervisor,
  type SituacaoEscala,
  type UnidadeDaEscala,
} from "@/lib/escala/tipos";

/**
 * Padrão semanal (Fase 4) — a aba "Padrão Semanal" da planilha.
 *
 * Uma linha por supervisor, uma coluna por dia útil. Cada célula é OU uma ou
 * mais unidades, OU uma situação fora de unidade — nunca os dois. O banco
 * garante isso com CHECK; aqui o editor impede antes da viagem.
 *
 * ⚠️ SALVAR NÃO SOBRESCREVE O PASSADO. A gravação fecha o padrão anterior na
 * véspera da nova vigência e insere o novo — por isso a data "passa a valer em"
 * é um campo de verdade, e não um detalhe. Mês já fechado continua explicável
 * pelo padrão que valia na época.
 *
 * A grade mostra o padrão VIGENTE numa data. Trocar essa data é como a pessoa
 * responde "o que valia em março?" sem precisar de tela de histórico.
 */

function hojeIso(): string {
  const d = new Date();
  return dataPura(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

interface CelulaAberta {
  supervisor: EscalaSupervisor;
  dia: DiaUtilSemana;
  alocacao: Alocacao | null;
  /** id do padrão vigente nesta célula, se houver — é o que "Limpar" encerra. */
  idPadrao: string | null;
}

export default function PadraoSemanal() {
  const [emData, setEmData] = useState(hojeIso);

  const { data: supervisores = [], isLoading: carregandoSup } = useEscalaSupervisores(true);
  const { data: unidades = [] } = useUnidadesDaEscala(true);
  const { data: padroes = [], isLoading: carregandoPad } = useEscalaPadrao({ emData });
  const salvar = useSalvarPadrao();
  const encerrar = useEncerrarPadrao();
  const podeEditar = usePodeEditarEscala();

  const [aberta, setAberta] = useState<CelulaAberta | null>(null);

  const porUnidade = useMemo(
    () => new Map(unidades.map((u) => [u.id_unidade, u])),
    [unidades]
  );
  const indice = useMemo(() => indexarPadrao(padroes), [padroes]);

  function alocacaoDe(id_supervisor: string, dia: DiaUtilSemana): Alocacao | null {
    const linha = indice.get(`${id_supervisor}|${dia}`);
    return linha ? colunasParaAlocacao(linha) : null;
  }

  function abrir(supervisor: EscalaSupervisor, dia: DiaUtilSemana) {
    if (!podeEditar) return;
    const linha = indice.get(`${supervisor.id_supervisor}|${dia}`);
    setAberta({
      supervisor,
      dia,
      alocacao: linha ? colunasParaAlocacao(linha) : null,
      idPadrao: linha?.id_padrao ?? null,
    });
  }

  /** Quantos dias da semana o supervisor tem definidos, e quantos em unidade. */
  function contarLinha(id_supervisor: string) {
    let definidos = 0;
    let emUnidade = 0;
    for (const d of DIAS_UTEIS) {
      const a = alocacaoDe(id_supervisor, d.valor);
      if (!a) continue;
      definidos++;
      if (a.tipo === "unidades") emUnidade++;
    }
    return { definidos, emUnidade };
  }

  /** Quantos supervisores têm o dia definido, e quantos estão em unidade nele. */
  function contarColuna(dia: DiaUtilSemana) {
    let definidos = 0;
    let emUnidade = 0;
    for (const s of supervisores) {
      const a = alocacaoDe(s.id_supervisor, dia);
      if (!a) continue;
      definidos++;
      if (a.tipo === "unidades") emUnidade++;
    }
    return { definidos, emUnidade };
  }

  if (carregandoSup || carregandoPad) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        Carregando padrão semanal...
      </div>
    );
  }

  if (supervisores.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
        <Users className="mx-auto mb-2 size-7 text-gray-300" />
        <p className="font-medium text-gray-700">Nenhum supervisor ativo</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          O padrão semanal se monta sobre a equipe. Cadastre os supervisores primeiro — é a
          aba Supervisores da{" "}
          <Link href="/escala/configuracao" className="font-medium text-[#0E7490] underline">
            Configuração
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-600">
          Onde cada supervisor fica em cada dia útil. É daqui que a grade mensal se monta.
          {podeEditar && " Clique numa célula para definir."}
        </p>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Padrão vigente em
          <input
            type="date"
            value={emData}
            onChange={(e) => setEmData(e.target.value || hojeIso())}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th className="min-w-[11rem] px-3 py-2">Supervisor</th>
              {DIAS_UTEIS.map((d) => (
                <th key={d.valor} className="min-w-[9rem] px-3 py-2">
                  {d.rotulo}
                </th>
              ))}
              <th className="w-28 px-3 py-2 text-right">Dias/sem.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {supervisores.map((s) => {
              const linha = contarLinha(s.id_supervisor);
              return (
                <tr key={s.id_supervisor}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-900">
                      {s.nome_resumido || s.nome}
                    </span>
                    {s.funcao && (
                      <span className="block text-[11px] text-gray-500">{s.funcao}</span>
                    )}
                  </td>

                  {DIAS_UTEIS.map((d) => {
                    const a = alocacaoDe(s.id_supervisor, d.valor);
                    return (
                      <td key={d.valor} className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => abrir(s, d.valor)}
                          disabled={!podeEditar}
                          className={cn(
                            "flex min-h-[2.25rem] w-full flex-wrap items-center gap-1 rounded border px-2 py-1 text-left",
                            podeEditar
                              ? "border-gray-200 hover:border-[#0891B2] hover:bg-gray-50"
                              : "cursor-default border-transparent",
                            !a && "text-gray-300"
                          )}
                        >
                          {a === null ? (
                            <span className="text-xs">
                              {podeEditar ? "definir" : "—"}
                            </span>
                          ) : a.tipo === "unidades" ? (
                            a.unidade_ids.map((id) => {
                              const u = porUnidade.get(id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-700"
                                >
                                  <span
                                    className="inline-block size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: u?.cor_hex ?? "#0ea5e9" }}
                                  />
                                  {u?.nome ?? "unidade removida"}
                                </span>
                              );
                            })
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                              {a.situacao}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-500">
                    {linha.definidos} de 5
                    <span className="block text-[11px] text-gray-400">
                      {linha.emUnidade} em unidade
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* O rodapé responde a pergunta que a planilha respondia na linha
              "Supervisores escalados no dia" — e separa quem está EM UNIDADE de
              quem só tem o dia definido, porque home office não cobre unidade. */}
          <tfoot className="border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
            <tr>
              <td className="px-3 py-2 font-semibold">No dia</td>
              {DIAS_UTEIS.map((d) => {
                const c = contarColuna(d.valor);
                return (
                  <td key={d.valor} className="px-3 py-2 tabular-nums">
                    <span className="font-semibold text-gray-900">{c.definidos}</span> definidos
                    <span className="block text-[11px] text-gray-500">
                      {c.emUnidade} em unidade
                    </span>
                  </td>
                );
              })}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Salvar não reescreve o passado: o padrão anterior é encerrado na véspera da nova
        vigência, e os meses já montados continuam explicáveis pelo padrão que valia neles.
      </p>

      {aberta && (
        <EditorCelula
          celula={aberta}
          unidades={unidades}
          salvando={salvar.isPending || encerrar.isPending}
          onFechar={() => setAberta(null)}
          onSalvar={async (alocacao, vigencia_inicio) => {
            try {
              await salvar.mutateAsync({
                id_supervisor: aberta.supervisor.id_supervisor,
                dia_semana: aberta.dia,
                alocacao,
                vigencia_inicio,
              });
              setAberta(null);
            } catch {
              // O toast do erro já sai no hook; o modal fica aberto com o que
              // foi escolhido, para a pessoa tentar de novo.
            }
          }}
          onLimpar={async () => {
            if (!aberta.idPadrao) return;
            try {
              await encerrar.mutateAsync({ id_padrao: aberta.idPadrao });
              setAberta(null);
            } catch {
              // idem
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Editor de uma célula ────────────────────────────────────────────────────

interface EditorProps {
  celula: CelulaAberta;
  unidades: UnidadeDaEscala[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (a: Alocacao, vigencia_inicio: string) => void;
  onLimpar: () => void;
}

function EditorCelula({
  celula,
  unidades,
  salvando,
  onFechar,
  onSalvar,
  onLimpar,
}: EditorProps) {
  const inicial = celula.alocacao;
  const [modo, setModo] = useState<"unidades" | "situacao">(
    inicial?.tipo === "situacao" ? "situacao" : "unidades"
  );
  const [escolhidas, setEscolhidas] = useState<string[]>(
    inicial?.tipo === "unidades" ? inicial.unidade_ids : []
  );
  const [situacao, setSituacao] = useState<SituacaoEscala>(
    inicial?.tipo === "situacao" ? inicial.situacao : "Home office"
  );
  const [vigencia, setVigencia] = useState(hojeIso);

  const dia = DIAS_UTEIS.find((d) => d.valor === celula.dia);
  const valido = modo === "unidades" ? escolhidas.length > 0 : true;

  function alternar(id: string) {
    setEscolhidas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  }

  return (
    <Modal
      open
      onClose={onFechar}
      title={`${celula.supervisor.nome_resumido || celula.supervisor.nome} — ${dia?.rotulo ?? ""}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          {celula.idPadrao ? (
            <button
              type="button"
              onClick={onLimpar}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="size-4" />
              Limpar o dia
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
                  vigencia
                )
              }
              disabled={!valido || salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490] disabled:opacity-60"
            >
              {salvando && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Os dois modos são excludentes por definição: ou a pessoa está em
            unidade, ou está numa situação fora de unidade. O banco recusa os
            dois juntos — o segmentado impede antes de tentar. */}
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
          <div>
            <p className="mb-2 text-xs text-gray-500">
              Pode marcar mais de uma. O dia conta em cada unidade escolhida, sem contar o
              supervisor duas vezes.
            </p>
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
            {unidades.length === 0 && (
              <p className="text-sm text-gray-500">
                Nenhuma unidade ativa na escala. Ative na Configuração.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Situação</label>
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
          </div>
        )}

        <div className="border-t border-gray-200 pt-3">
          <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <CalendarRange className="size-3.5" />
            Passa a valer em
          </label>
          <input
            type="date"
            value={vigencia}
            onChange={(e) => setVigencia(e.target.value || hojeIso())}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            O padrão que valia antes é encerrado na véspera desta data, não apagado. Mês já
            montado continua explicável pelo padrão da época.
          </p>
        </div>
      </div>
    </Modal>
  );
}
