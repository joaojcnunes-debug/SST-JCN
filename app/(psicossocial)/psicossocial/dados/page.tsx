"use client";

import { useMemo, useRef, useState } from "react";
import {
  Upload,
  ClipboardPaste,
  Trash2,
  Database,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useDrpsStore } from "@/lib/drps/store";
import {
  useDrpsImportar,
  useDrpsLimparTudo,
  useDrpsRespondentes,
} from "@/lib/hooks/useDrps";
import { listarSetores, parsearTexto } from "@/lib/drps/calculos";

export default function DrpsDadosPage() {
  const idEmpresa = useDrpsStore((s) => s.idEmpresa);
  const { data: respondentes = [] } = useDrpsRespondentes(idEmpresa);
  const importar = useDrpsImportar();
  const limpar = useDrpsLimparTudo();

  const [texto, setTexto] = useState("");
  const [confirmLimpar, setConfirmLimpar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previa = useMemo(() => {
    if (!texto.trim()) return null;
    return parsearTexto(texto);
  }, [texto]);

  const setores = listarSetores(respondentes);
  const periodo = useMemo(() => {
    if (respondentes.length === 0) return null;
    const datas = respondentes
      .map((r) => r.data_carimbo)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime())
      .filter((n) => !Number.isNaN(n));
    if (datas.length === 0) return null;
    const min = new Date(Math.min(...datas));
    const max = new Date(Math.max(...datas));
    return { min, max };
  }, [respondentes]);

  function lerArquivo(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setTexto(String(reader.result ?? ""));
    };
    reader.readAsText(file, "utf-8");
  }

  function onProcessar() {
    if (!idEmpresa) {
      toast.error("Selecione uma empresa primeiro");
      return;
    }
    if (!previa || previa.linhas.length === 0) {
      toast.error("Nenhum respondente válido para importar");
      return;
    }
    importar.mutate(
      { id_empresa: idEmpresa, linhas: previa.linhas },
      {
        onSuccess: () => {
          setTexto("");
          if (fileRef.current) fileRef.current.value = "";
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Dados do Formulário
        </h1>
        <p className="text-sm text-gray-600">
          Importe as respostas do Google Forms colando o conteúdo direto do
          Google Sheets ou enviando um arquivo CSV.
        </p>
      </div>

      <DrpsFiltro />

      {!idEmpresa ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Selecione uma empresa acima para importar e visualizar respondentes.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Respondentes"
              value={respondentes.length}
              icon={<Database className="size-4" />}
            />
            <StatCard
              label="Setores"
              value={setores.length}
              icon={<Database className="size-4" />}
            />
            <StatCard
              label="Período"
              value={
                periodo
                  ? `${periodo.min.toLocaleDateString("pt-BR")} → ${periodo.max.toLocaleDateString("pt-BR")}`
                  : "—"
              }
              icon={<Database className="size-4" />}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                Colar dados do Google Sheets / CSV
              </h2>
              <div className="flex gap-2">
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="size-3.5" /> Upload CSV
                </button>
              </div>
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              placeholder="Cole aqui o conteúdo copiado do Google Sheets (incluindo a linha de cabeçalho)..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />

            {previa && (
              <div className="mt-3 space-y-2">
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  <strong>{previa.linhas.length}</strong> respondente(s)
                  pronto(s) para importar
                  {previa.erros.length > 0 && (
                    <>
                      {" — "}
                      <strong className="text-amber-warning">
                        {previa.erros.length}
                      </strong>{" "}
                      aviso(s)
                    </>
                  )}
                </div>

                <details
                  open={previa.linhas.length === 0}
                  className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
                >
                  <summary className="cursor-pointer font-medium">
                    Diagnóstico do parser
                  </summary>
                  <ul className="mt-2 space-y-0.5 pl-1">
                    <li>
                      Separador detectado:{" "}
                      <strong>{previa.diagnostico.separador}</strong>
                    </li>
                    <li>
                      Total de linhas com conteúdo:{" "}
                      <strong>{previa.diagnostico.totalLinhas}</strong>
                    </li>
                    <li>
                      Primeira linha tratada como header:{" "}
                      <strong>
                        {previa.diagnostico.pulouHeader ? "sim" : "não"}
                      </strong>
                    </li>
                    <li>
                      Colunas detectadas nas primeiras linhas de dados:{" "}
                      <strong>
                        [
                        {previa.diagnostico.colunasPorLinha.join(", ") || "—"}]
                      </strong>{" "}
                      (esperado 93 por linha)
                    </li>
                    {previa.diagnostico.amostraLinha && (
                      <li className="mt-2">
                        Amostra raw da 1ª linha de dados (primeiros 200
                        chars):
                        <pre className="mt-1 max-h-32 overflow-auto rounded bg-blue-100 p-2 font-mono text-[10px] text-blue-900 break-all whitespace-pre-wrap">
                          {previa.diagnostico.amostraLinha}
                        </pre>
                      </li>
                    )}
                    {previa.diagnostico.codigosNaoAscii.length > 0 && (
                      <li>
                        Chars não-ASCII suspeitos encontrados:{" "}
                        <strong className="font-mono">
                          {previa.diagnostico.codigosNaoAscii
                            .map((c) => `${c.code} (${c.char})`)
                            .join(", ")}
                        </strong>
                      </li>
                    )}
                  </ul>
                  {previa.diagnostico.colunasPorLinha.length > 0 &&
                    previa.diagnostico.colunasPorLinha.every(
                      (n) => n < 93
                    ) && (
                      <p className="mt-2 rounded bg-blue-100 px-2 py-1">
                        ⚠ Todas as linhas têm menos colunas que o esperado.
                        Confira se: (a) você copiou todas as colunas (data +
                        setor + cargo + 90 respostas), (b) o separador no
                        Sheets é o mesmo da colagem, (c) não há quebra de
                        linha dentro de respostas.
                      </p>
                    )}
                </details>

                {previa.erros.length > 0 && (
                  <details className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <summary className="cursor-pointer font-medium">
                      <AlertTriangle className="mr-1 inline size-3.5" />
                      Avisos do parser ({previa.erros.length})
                    </summary>
                    <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5">
                      {previa.erros.slice(0, 50).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                      {previa.erros.length > 50 && (
                        <li>... e mais {previa.erros.length - 50}</li>
                      )}
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
                onClick={onProcessar}
                disabled={
                  importar.isPending ||
                  !previa ||
                  previa.linhas.length === 0
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
              >
                <ClipboardPaste className="size-3.5" />
                {importar.isPending
                  ? "Importando..."
                  : `Importar ${previa?.linhas.length ?? 0} respondente(s)`}
              </button>
            </div>
          </div>

          {respondentes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">
                  Respondentes importados
                </h2>
                <button
                  type="button"
                  onClick={() => setConfirmLimpar(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-alert hover:bg-red-50"
                >
                  <Trash2 className="size-3.5" /> Remover tudo
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Setor</th>
                      <th className="px-3 py-2 text-left font-medium">Cargo</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Carimbo
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Importado em
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {respondentes.slice(0, 100).map((r) => (
                      <tr key={r.id_respondente} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{r.setor}</td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.cargo ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {r.data_carimbo
                            ? new Date(r.data_carimbo).toLocaleString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(r.importado_em).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {respondentes.length > 100 && (
                  <p className="mt-2 text-center text-xs text-gray-500">
                    Mostrando os primeiros 100 de {respondentes.length}
                  </p>
                )}
              </div>
            </div>
          )}

          <ConfirmDialog
            open={confirmLimpar}
            title="Remover todos os respondentes?"
            description={`Todos os ${respondentes.length} respondente(s) desta empresa serão removidos. Esta ação não pode ser desfeita.`}
            variant="danger"
            loading={limpar.isPending}
            onConfirm={() => {
              if (!idEmpresa) return;
              limpar.mutate(idEmpresa, {
                onSuccess: () => setConfirmLimpar(false),
              });
            }}
            onCancel={() => setConfirmLimpar(false)}
          />
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500">
        {icon} {label}
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
