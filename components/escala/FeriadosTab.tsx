"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import {
  useEscalaFeriados,
  useExcluirFeriado,
  useSalvarFeriado,
  useSemearFeriados,
  type FeriadoForm,
} from "@/lib/hooks/useEscalaFeriados";
import { usePodeEditarEscala, useUnidadesDaEscala } from "@/lib/hooks/useEscalaCadastro";
import { diaSemanaIso, paraDataLocal } from "@/lib/escala/datas";
import {
  ABRANGENCIAS_FERIADO,
  TIPOS_FERIADO,
  type AbrangenciaFeriado,
  type EscalaFeriado,
} from "@/lib/escala/tipos";

/**
 * Aba Feriados da configuração (Fase 3).
 *
 * Feriado é o que impede a grade mensal de escalar gente em dia parado. Os
 * nacionais e os do RJ são CALCULADOS pelo banco (`escala_semear_feriados`), que
 * deriva Carnaval, Sexta-feira da Paixão e Corpus Christi da Páscoa do ano — por
 * isso o botão de semear serve para qualquer ano, e não só para 2026/2027.
 *
 * Os MUNICIPAIS não têm como ser calculados: cada câmara municipal escolhe o
 * seu. Na planilha original os 5 estavam como [CONFIRMAR] e o módulo nasceu sem
 * eles. O painel de cobertura abaixo existe para que essa falta apareça, em vez
 * de virar um dia útil que ninguém trabalhou.
 */

const ROTULO_ABRANGENCIA: Record<AbrangenciaFeriado, string> = {
  nacional: "Nacional",
  estadual: "Estadual (RJ)",
  municipal: "Municipal",
};

const DIAS_CURTOS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function VAZIO(ano: number): FeriadoForm {
  return {
    data: `${ano}-01-01`,
    descricao: "",
    abrangencia: "municipal",
    municipio: "",
    tipo: "feriado",
  };
}

export default function FeriadosTab() {
  const [ano, setAno] = useState(() => new Date().getFullYear());

  const { data: feriados = [], isLoading } = useEscalaFeriados(ano);
  const { data: unidades = [] } = useUnidadesDaEscala(false);
  const salvar = useSalvarFeriado();
  const excluir = useExcluirFeriado();
  const semear = useSemearFeriados();
  const podeEditar = usePodeEditarEscala();

  const [editando, setEditando] = useState<FeriadoForm | null>(null);

  /**
   * Cobertura municipal: para cada município que existe na configuração das
   * unidades, quantos feriados municipais o ano tem. Zero é o caso que interessa
   * — é a lacuna que alguém da JCN Consultoria precisa informar.
   */
  const cobertura = useMemo(() => {
    const municipios = Array.from(
      new Set(
        unidades
          .filter((u) => u.ativo && u.municipio)
          .map((u) => (u.municipio as string).trim())
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return municipios.map((m) => ({
      municipio: m,
      quantos: feriados.filter(
        (f) =>
          f.abrangencia === "municipal" &&
          (f.municipio ?? "").trim().toLowerCase() === m.toLowerCase()
      ).length,
    }));
  }, [unidades, feriados]);

  const semNenhum = cobertura.filter((c) => c.quantos === 0);

  function abrirNovo() {
    setEditando(VAZIO(ano));
  }

  function abrirEdicao(f: EscalaFeriado) {
    setEditando({
      id_feriado: f.id_feriado,
      data: f.data,
      descricao: f.descricao,
      abrangencia: f.abrangencia,
      municipio: f.municipio ?? "",
      tipo: f.tipo,
    });
  }

  async function gravar() {
    if (!editando || !editando.descricao.trim()) return;
    try {
      await salvar.mutateAsync(editando);
      setEditando(null);
    } catch {
      // A mensagem do erro já sai como toast no `onError` do hook. O catch aqui
      // é para a rejeição não escapar do handler do clique — e o modal FICA
      // aberto de propósito: fechá-lo apagaria o que a pessoa digitou.
    }
  }

  async function remover(f: EscalaFeriado) {
    const ok = await confirmar({
      title: `Excluir "${f.descricao}"?`,
      description:
        f.abrangencia === "municipal"
          ? "Feriado municipal excluído não volta pelo botão de semear — só os oficiais são recriados."
          : "Este feriado é oficial: o botão de semear o traz de volta.",
      confirmLabel: "Excluir",
    });
    if (ok) excluir.mutate(f.id_feriado);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAno((a) => a - 1)}
            className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Ano anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="w-16 text-center text-lg font-bold tabular-nums text-gray-900">
            {ano}
          </span>
          <button
            type="button"
            onClick={() => setAno((a) => a + 1)}
            className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Próximo ano"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {podeEditar && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => semear.mutate(ano)}
            disabled={semear.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            title="Cria os feriados nacionais e do RJ deste ano, inclusive os móveis. Não duplica nem sobrescreve."
          >
            {semear.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Semear oficiais de {ano}
          </button>
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490]"
          >
            <Plus className="size-4" />
            Novo feriado
          </button>
        </div>
        )}
      </div>

      {semNenhum.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>
              {semNenhum.length === 1
                ? "1 município sem feriado municipal"
                : `${semNenhum.length} municípios sem feriado municipal`}{" "}
              em {ano}:
            </strong>{" "}
            {semNenhum.map((c) => c.municipio).join(", ")}.
            <br />
            <span className="text-[13px]">
              Feriado municipal não é calculável — precisa ser informado. Sem ele, a grade
              vai escalar supervisor em dia sem expediente.
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando feriados...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
              <tr>
                <th className="w-32 px-3 py-2">Data</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="w-36 px-3 py-2">Abrangência</th>
                <th className="px-3 py-2">Município</th>
                <th className="w-28 px-3 py-2">Tipo</th>
                <th className="w-28 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {feriados.map((f) => {
                const d = paraDataLocal(f.data);
                const dia = diaSemanaIso(f.data);
                const fimDeSemana = dia > 5;
                return (
                  <tr key={f.id_feriado}>
                    <td className="px-3 py-2 tabular-nums">
                      <span className="font-medium text-gray-900">
                        {String(d.getDate()).padStart(2, "0")}/
                        {String(d.getMonth() + 1).padStart(2, "0")}
                      </span>{" "}
                      <span className={fimDeSemana ? "text-gray-400" : "text-gray-500"}>
                        {DIAS_CURTOS[dia]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-900">
                      {f.descricao}
                      {fimDeSemana && (
                        <span className="ml-2 text-[11px] text-gray-400">
                          cai no fim de semana
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          f.abrangencia === "nacional"
                            ? "info"
                            : f.abrangencia === "estadual"
                              ? "default"
                              : "warning"
                        }
                      >
                        {ROTULO_ABRANGENCIA[f.abrangencia]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{f.municipio || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={f.tipo === "feriado" ? "danger" : "muted"}>
                        {f.tipo === "feriado" ? "Feriado" : "Facultativo"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {podeEditar && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEdicao(f)}
                          className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remover(f)}
                          className="rounded border border-gray-300 p-1 text-red-600 hover:bg-red-50"
                          title="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {feriados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500">
                    <CalendarOff className="mx-auto mb-2 size-6 text-gray-300" />
                    Nenhum feriado cadastrado em {ano}.
                    <br />
                    <span className="text-xs">
                      {podeEditar
                        ? "Use “Semear oficiais” para trazer os nacionais e os do RJ."
                        : "Quem cadastra feriado é um Admin ou Técnico."}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {podeEditar && (
        <p className="text-xs text-gray-500">
          Semear é seguro em qualquer momento: não duplica nem desfaz correção feita à mão.
        </p>
      )}

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={editando?.id_feriado ? "Editar feriado" : "Novo feriado"}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={gravar}
              disabled={!editando?.descricao.trim() || salvar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490] disabled:opacity-60"
            >
              {salvar.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </button>
          </div>
        }
      >
        {editando && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Data</label>
                <input
                  type="date"
                  value={editando.data}
                  onChange={(e) => setEditando({ ...editando, data: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Tipo</label>
                <select
                  value={editando.tipo ?? "feriado"}
                  onChange={(e) =>
                    setEditando({ ...editando, tipo: e.target.value as FeriadoForm["tipo"] })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {TIPOS_FERIADO.map((t) => (
                    <option key={t} value={t}>
                      {t === "feriado" ? "Feriado" : "Ponto facultativo"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Descrição</label>
              <input
                type="text"
                value={editando.descricao}
                onChange={(e) => setEditando({ ...editando, descricao: e.target.value })}
                placeholder="ex.: Aniversário da cidade"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Abrangência</label>
              <select
                value={editando.abrangencia}
                onChange={(e) => {
                  const abrangencia = e.target.value as AbrangenciaFeriado;
                  // Sair de Municipal tem que LIMPAR o município. O CHECK do
                  // banco (`escala_feriados_municipio_obrigatorio`) só exige
                  // município quando é municipal — ele NÃO proíbe o contrário.
                  // Um feriado nacional carregando "Teresópolis" seria aceito
                  // sem erro e ficaria como dado sujo, que ninguém veria.
                  setEditando({
                    ...editando,
                    abrangencia,
                    municipio: abrangencia === "municipal" ? editando.municipio : "",
                  });
                }}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {ABRANGENCIAS_FERIADO.map((a) => (
                  <option key={a} value={a}>
                    {ROTULO_ABRANGENCIA[a]}
                  </option>
                ))}
              </select>
            </div>

            {editando.abrangencia === "municipal" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  Município
                </label>
                <input
                  type="text"
                  list="escala-municipios"
                  value={editando.municipio ?? ""}
                  onChange={(e) => setEditando({ ...editando, municipio: e.target.value })}
                  placeholder="ex.: Teresópolis"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
                <datalist id="escala-municipios">
                  {cobertura.map((c) => (
                    <option key={c.municipio} value={c.municipio} />
                  ))}
                </datalist>
                <p className="mt-1 text-[11px] text-gray-500">
                  Precisa bater com o município da unidade — é assim que o feriado alcança
                  só quem trabalha lá.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
