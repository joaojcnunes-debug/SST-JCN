"use client";

import { use, useState, useMemo, useRef } from "react";
import {
  ListChecks,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  Users,
  Upload,
  ClipboardPaste,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  useQpsAplicacao,
  useQpsRespondentes,
  useCreateQpsRespondente,
  useDeleteQpsRespondente,
  useImportarQpsLote,
  useLimparQpsRespondentes,
  useQpsCategorias,
  useQpsAllPerguntas,
} from "@/lib/hooks/useQuestionarios";
import { useQpsTipos } from "@/lib/hooks/useQuestionarios";
import { parsearQpsCsv } from "@/lib/qps/parsearCsv";
import type { QpsCategoria, QpsPergunta, QpsRespondente } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export default function RespondentesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [modalManual, setModalManual] = useState(false);
  const [confirmLimpar, setConfirmLimpar] = useState(false);

  const { data: ap } = useQpsAplicacao(id);
  const { data: tipos = [] } = useQpsTipos();
  const { data: categorias = [] } = useQpsCategorias(ap?.id_tipo ?? null);
  const { data: todasPerguntas = [] } = useQpsAllPerguntas(ap?.id_tipo ?? null);
  const { data: respondentes = [], isLoading } = useQpsRespondentes(id);
  const deletar = useDeleteQpsRespondente();
  const limpar = useLimparQpsRespondentes();

  const tipo = tipos.find((t) => t.id_tipo === ap?.id_tipo);

  // Perguntas em ordem canonical (categoria.ordem → pergunta.ordem)
  const perguntasOrdenadas = useMemo(() => {
    return [...todasPerguntas].sort((a, b) => {
      const catA = categorias.find((c) => c.id_categoria === a.id_categoria);
      const catB = categorias.find((c) => c.id_categoria === b.id_categoria);
      const ordemCatA = catA?.ordem ?? 0;
      const ordemCatB = catB?.ordem ?? 0;
      if (ordemCatA !== ordemCatB) return ordemCatA - ordemCatB;
      return a.ordem - b.ordem;
    });
  }, [todasPerguntas, categorias]);

  const setoresExistentes = useMemo(
    () => [...new Set(respondentes.map((r) => r.setor))].sort(),
    [respondentes]
  );

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ListChecks className="size-5 text-indigo-600" /> Respondentes
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {ap?.titulo} · {respondentes.length} respondente{respondentes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setModalManual(true)}
          disabled={semPerguntas}
          title={semPerguntas ? "Cadastre perguntas no tipo primeiro" : undefined}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" /> Adicionar manualmente
        </button>
      </div>

      {semPerguntas && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Este tipo ainda não tem perguntas.{" "}
          <Link href="/questionarios-psicossociais/tipos" className="font-semibold underline">
            Adicione perguntas primeiro.
          </Link>
        </div>
      )}

      {/* ─── Seção de importação CSV ─── */}
      {!semPerguntas && tipo && (
        <ImportacaoCsvCard
          idAplicacao={id}
          perguntasOrdenadas={perguntasOrdenadas}
          escalaMin={tipo.escala_min}
          escalaMax={tipo.escala_max}
          nPerguntas={perguntasOrdenadas.length}
        />
      )}

      {/* ─── Lista de respondentes ─── */}
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

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        ) : respondentes.length === 0 ? (
          <div className="py-16 text-center">
            <ListChecks className="mx-auto size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-600">Nenhum respondente ainda</p>
            <p className="mt-1 text-xs text-gray-400">Importe via CSV ou adicione manualmente</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-semibold text-gray-700">
                {respondentes.length} respondente{respondentes.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => setConfirmLimpar(true)}
                className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-3.5" /> Remover tudo
              </button>
            </div>
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
                      {Object.keys(r.respostas).length} / {perguntasOrdenadas.length}
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
          </>
        )}
      </div>

      {/* Modal adição manual */}
      {modalManual && ap && tipo && (
        <AdicionarRespondente
          idAplicacao={id}
          categorias={categorias}
          perguntas={todasPerguntas}
          escalaMin={tipo.escala_min}
          escalaMax={tipo.escala_max}
          setoresExistentes={setoresExistentes}
          onClose={() => setModalManual(false)}
        />
      )}

      <ConfirmDialog
        open={confirmLimpar}
        title="Remover todos os respondentes?"
        description={`Todos os ${respondentes.length} respondente(s) desta aplicação serão removidos. Esta ação não pode ser desfeita.`}
        variant="danger"
        loading={limpar.isPending}
        onConfirm={() =>
          limpar.mutate(id, { onSuccess: () => setConfirmLimpar(false) })
        }
        onCancel={() => setConfirmLimpar(false)}
      />
    </div>
  );
}

// ─── Seção de importação CSV ──────────────────────────────────────────────────

function ImportacaoCsvCard({
  idAplicacao,
  perguntasOrdenadas,
  escalaMin,
  escalaMax,
  nPerguntas,
}: {
  idAplicacao: string;
  perguntasOrdenadas: { id_pergunta: string }[];
  escalaMin: number;
  escalaMax: number;
  nPerguntas: number;
}) {
  const [texto, setTexto] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const importar = useImportarQpsLote();

  const previa = useMemo(() => {
    if (!texto.trim()) return null;
    return parsearQpsCsv(texto, perguntasOrdenadas, escalaMin, escalaMax);
  }, [texto, perguntasOrdenadas, escalaMin, escalaMax]);

  function lerArquivo(file: File) {
    const reader = new FileReader();
    reader.onload = () => setTexto(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  }

  async function handleImportar() {
    if (!previa || previa.linhas.length === 0) {
      toast.error("Nenhum respondente válido para importar");
      return;
    }
    try {
      const r = await importar.mutateAsync({ idAplicacao, linhas: previa.linhas });
      toast.success(`${r.count} respondente(s) importado(s)`);
      setTexto("");
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      toast.error("Erro ao importar");
    }
  }

  const totalEsperado = nPerguntas + 3; // carimbo + setor + cargo + N perguntas

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Importar via CSV / Google Forms
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Estrutura esperada:{" "}
            <span className="font-mono">
              Carimbo | Setor | Cargo | R1 | R2 | … | R{nPerguntas}
            </span>{" "}
            ({totalEsperado} colunas, escala {escalaMin}–{escalaMax})
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) lerArquivo(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload className="size-3.5" /> Upload CSV
          </button>
        </div>
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={7}
        placeholder="Cole aqui o conteúdo copiado do Google Sheets ou do CSV exportado do Forms (incluindo a linha de cabeçalho)..."
        className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      />

      {previa && (
        <div className="mt-3 space-y-2">
          {/* Resumo */}
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <strong>{previa.linhas.length}</strong> respondente(s) prontos para importar
            {previa.erros.length > 0 && (
              <>
                {" — "}
                <strong className="text-amber-600">{previa.erros.length}</strong> aviso(s)
              </>
            )}
          </div>

          {/* Diagnóstico */}
          <details
            open={previa.linhas.length === 0}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
          >
            <summary className="cursor-pointer font-medium">Diagnóstico do parser</summary>
            <ul className="mt-2 space-y-0.5 pl-1">
              <li>
                Separador detectado: <strong>{previa.diagnostico.separador}</strong>
              </li>
              <li>
                Linhas com dados: <strong>{previa.diagnostico.totalLinhas}</strong>
              </li>
              <li>
                Cabeçalho pulado: <strong>{previa.diagnostico.pulouHeader ? "sim" : "não"}</strong>
              </li>
              <li>
                Colunas detectadas nas primeiras linhas:{" "}
                <strong>[{previa.diagnostico.colunasPorLinha.join(", ") || "—"}]</strong>
                {" "}(esperado ≈ {totalEsperado})
              </li>
              <li>
                Colunas de resposta encontradas:{" "}
                <strong>{previa.diagnostico.nColsResposta}</strong>
                {" "}(esperado {nPerguntas})
                {previa.diagnostico.nColsResposta !== nPerguntas && (
                  <span className="ml-1 font-semibold text-amber-700">
                    ⚠ divergência
                  </span>
                )}
              </li>
              {previa.diagnostico.amostraLinha && (
                <li className="mt-2">
                  Amostra da 1ª linha de dados:
                  <pre className="mt-1 max-h-24 overflow-auto rounded bg-blue-100 p-2 font-mono text-[10px] text-blue-900 break-all whitespace-pre-wrap">
                    {previa.diagnostico.amostraLinha}
                  </pre>
                </li>
              )}
            </ul>
          </details>

          {/* Avisos */}
          {previa.erros.length > 0 && (
            <details className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <summary className="cursor-pointer font-medium">
                <AlertTriangle className="mr-1 inline size-3.5" />
                Avisos ({previa.erros.length})
              </summary>
              <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5">
                {previa.erros.slice(0, 50).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {previa.erros.length > 50 && <li>... e mais {previa.erros.length - 50}</li>}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setTexto("")}
          disabled={!texto}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Limpar campo
        </button>
        <button
          type="button"
          onClick={handleImportar}
          disabled={importar.isPending || !previa || previa.linhas.length === 0}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ClipboardPaste className="size-3.5" />
          {importar.isPending
            ? "Importando..."
            : `Importar ${previa?.linhas.length ?? 0} respondente(s)`}
        </button>
      </div>
    </div>
  );
}

// ─── Modal de adição manual ───────────────────────────────────────────────────

function AdicionarRespondente({
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

  const perguntasPorCat = useMemo(() => {
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
    if (!completo) { toast.error("Preencha todas as respostas e o setor"); return; }
    const respostasNum: Record<string, number> = {};
    for (const [pid, val] of Object.entries(respostas)) {
      const n = parseInt(val);
      if (isNaN(n) || n < escalaMin || n > escalaMax) {
        toast.error(`Resposta inválida (${escalaMin}–${escalaMax})`);
        return;
      }
      respostasNum[pid] = n;
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
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            form="form-resp"
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
      <form id="form-resp" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Setor *</label>
            <input list="setores-resp" value={setor} onChange={(e) => setSetor(e.target.value)} required placeholder="Nome do setor" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <datalist id="setores-resp">{setoresExistentes.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Cargo</label>
            <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Opcional" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Lote</label>
            <input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex: Turno A" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          Escala: <strong>{escalaMin}</strong> (mínimo) → <strong>{escalaMax}</strong> (máximo)
        </div>
        <div className="max-h-[50vh] space-y-5 overflow-y-auto pr-1">
          {categorias.map((cat, ci) => {
            const pergs = perguntasPorCat.get(cat.id_categoria) ?? [];
            return (
              <div key={cat.id_categoria}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-700">{ci + 1}. {cat.nome}</p>
                <div className="space-y-2">
                  {pergs.map((p, pi) => (
                    <div key={p.id_pergunta} className={cn("flex items-start gap-3 rounded-lg px-3 py-2.5", pi % 2 === 0 ? "bg-gray-50" : "bg-white border border-gray-100")}>
                      <span className="mt-0.5 w-5 shrink-0 text-xs font-bold text-gray-400">{pi + 1}.</span>
                      <p className="flex-1 text-xs leading-relaxed text-gray-700">{p.texto}</p>
                      <input type="number" min={escalaMin} max={escalaMax} value={respostas[p.id_pergunta] ?? ""} onChange={(e) => setRespostas((prev) => ({ ...prev, [p.id_pergunta]: e.target.value }))} className="w-16 shrink-0 rounded border border-gray-300 px-2 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
