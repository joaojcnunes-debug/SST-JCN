"use client";

import { use, useState, useMemo } from "react";
import { ListChecks, Plus, Trash2, Loader2, ChevronLeft, Users } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import {
  useQpsAplicacao,
  useQpsRespondentes,
  useCreateQpsRespondente,
  useDeleteQpsRespondente,
  useQpsCategorias,
  useQpsAllPerguntas,
} from "@/lib/hooks/useQuestionarios";
import { useQpsTipos } from "@/lib/hooks/useQuestionarios";
import type { QpsCategoria, QpsPergunta, QpsRespondente } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export default function RespondentesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [modalAberto, setModalAberto] = useState(false);

  const { data: ap } = useQpsAplicacao(id);
  const { data: tipos = [] } = useQpsTipos();
  const { data: categorias = [] } = useQpsCategorias(ap?.id_tipo ?? null);
  const { data: todasPerguntas = [] } = useQpsAllPerguntas(ap?.id_tipo ?? null);
  const { data: respondentes = [], isLoading } = useQpsRespondentes(id);
  const deletar = useDeleteQpsRespondente();

  const tipo = tipos.find((t) => t.id_tipo === ap?.id_tipo);

  // Setores únicos dos respondentes já cadastrados
  const setoresExistentes = useMemo(
    () => [...new Set(respondentes.map((r) => r.setor))].sort(),
    [respondentes]
  );

  // Agrupado por setor para exibição
  const porSetor = useMemo(() => {
    const map = new Map<string, QpsRespondente[]>();
    for (const r of respondentes) {
      const list = map.get(r.setor) ?? [];
      list.push(r);
      map.set(r.setor, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [respondentes]);

  async function handleDeletar(r: QpsRespondente) {
    if (!confirm(`Remover respondente do setor "${r.setor}"?`)) return;
    try {
      await deletar.mutateAsync({ id: r.id_respondente, idAplicacao: id });
      toast.success("Respondente removido");
    } catch {
      toast.error("Erro ao remover");
    }
  }

  const semPerguntas = todasPerguntas.length === 0 && !!ap?.id_tipo;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/questionarios-psicossociais/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="size-4" /> Voltar
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ListChecks className="size-5 text-indigo-600" /> Respondentes
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {ap?.titulo} · {respondentes.length} respondente{respondentes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          disabled={semPerguntas}
          title={semPerguntas ? "Cadastre perguntas no tipo antes de adicionar respondentes" : undefined}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" /> Adicionar Respondente
        </button>
      </div>

      {semPerguntas && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Este tipo ainda não tem perguntas cadastradas.{" "}
          <Link href="/questionarios-psicossociais/tipos" className="font-semibold underline">
            Adicione perguntas primeiro.
          </Link>
        </div>
      )}

      {/* Resumo por setor */}
      {porSetor.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {porSetor.map(([setor, lista]) => (
            <span
              key={setor}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
            >
              <Users className="size-3" />
              {setor} — {lista.length}
            </span>
          ))}
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        ) : respondentes.length === 0 ? (
          <div className="py-16 text-center">
            <ListChecks className="mx-auto size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-600">Nenhum respondente ainda</p>
            <p className="mt-1 text-xs text-gray-400">Adicione o primeiro respondente</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Setor</th>
                <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Cargo</th>
                <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Lote</th>
                <th className="px-4 py-3 text-left font-semibold">Respostas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {respondentes.map((r) => (
                <tr key={r.id_respondente} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.setor}</td>
                  <td className="hidden px-4 py-3 text-gray-500 sm:table-cell">{r.cargo ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-gray-500 md:table-cell">{r.lote ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {Object.keys(r.respostas).length} / {todasPerguntas.length}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeletar(r)}
                      className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de adição */}
      {modalAberto && ap && tipo && (
        <AdicionarRespodenteModal
          idAplicacao={id}
          categorias={categorias}
          perguntas={todasPerguntas}
          escalaMin={tipo.escala_min}
          escalaMax={tipo.escala_max}
          setoresExistentes={setoresExistentes}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}

// ─── Modal de adição de respondente ──────────────────────────────────────────

function AdicionarRespodenteModal({
  idAplicacao,
  categorias,
  perguntas,
  escalaMin,
  escalaMax,
  setoresExistentes,
  onClose,
}: {
  idAplicacao: string;
  categorias: QpsCategoria[];
  perguntas: QpsPergunta[];
  escalaMin: number;
  escalaMax: number;
  setoresExistentes: string[];
  onClose: () => void;
}) {
  const criar = useCreateQpsRespondente();
  const [setor, setSetor] = useState("");
  const [cargo, setCargo] = useState("");
  const [lote, setLote] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  const perguntasPorCategoria = useMemo(() => {
    const map = new Map<string, QpsPergunta[]>();
    for (const cat of categorias) {
      map.set(cat.id_categoria, perguntas.filter((p) => p.id_categoria === cat.id_categoria));
    }
    return map;
  }, [categorias, perguntas]);

  const totalRespondidas = Object.values(respostas).filter((v) => v !== "").length;
  const completo = totalRespondidas === perguntas.length && setor.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!completo) {
      toast.error("Preencha todas as respostas e o setor");
      return;
    }
    const respostasNum: Record<string, number> = {};
    for (const [id, val] of Object.entries(respostas)) {
      const n = parseInt(val);
      if (isNaN(n) || n < escalaMin || n > escalaMax) {
        toast.error(`Resposta inválida: deve ser entre ${escalaMin} e ${escalaMax}`);
        return;
      }
      respostasNum[id] = n;
    }
    try {
      await criar.mutateAsync({
        id_aplicacao: idAplicacao,
        setor: setor.trim(),
        cargo: cargo.trim() || null,
        respostas: respostasNum,
        lote: lote.trim() || null,
      });
      toast.success("Respondente adicionado");
      onClose();
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar Respondente"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            form="form-respondente"
            type="submit"
            disabled={!completo || criar.isPending}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {criar.isPending && <Loader2 className="size-4 animate-spin" />}
            Salvar ({totalRespondidas}/{perguntas.length})
          </button>
        </div>
      }
    >
      <form id="form-respondente" onSubmit={handleSubmit} className="space-y-5">
        {/* Identificação */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Setor <span className="text-red-500">*</span>
            </label>
            <input
              list="setores-list"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              required
              placeholder="Nome do setor"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="setores-list">
              {setoresExistentes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Cargo</label>
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Lote</label>
            <input
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              placeholder="Ex: Turno A"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Escala de referência */}
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          Escala de respostas: <strong>{escalaMin}</strong> (mínimo) a{" "}
          <strong>{escalaMax}</strong> (máximo)
        </div>

        {/* Perguntas por categoria */}
        <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
          {categorias.map((cat, catIdx) => {
            const pergs = perguntasPorCategoria.get(cat.id_categoria) ?? [];
            return (
              <div key={cat.id_categoria}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                  {catIdx + 1}. {cat.nome}
                </p>
                <div className="space-y-2">
                  {pergs.map((p, pIdx) => (
                    <div
                      key={p.id_pergunta}
                      className={cn(
                        "flex items-start gap-3 rounded-lg px-3 py-2.5",
                        pIdx % 2 === 0 ? "bg-gray-50" : "bg-white border border-gray-100"
                      )}
                    >
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-gray-400 w-5">
                        {pIdx + 1}.
                      </span>
                      <p className="flex-1 text-xs text-gray-700 leading-relaxed">{p.texto}</p>
                      <input
                        type="number"
                        min={escalaMin}
                        max={escalaMax}
                        value={respostas[p.id_pergunta] ?? ""}
                        onChange={(e) =>
                          setRespostas((prev) => ({
                            ...prev,
                            [p.id_pergunta]: e.target.value,
                          }))
                        }
                        className="w-16 shrink-0 rounded border border-gray-300 px-2 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
