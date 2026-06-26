"use client";

import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  UploadCloud, Download, FileSpreadsheet, CheckCircle2,
  AlertTriangle, XCircle, Loader2, ArrowLeft,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useImportarEmpresas } from "@/lib/hooks/useImportarEmpresas";
import { mensagemErro } from "@/lib/errors";
import type { Empresa, Unidade } from "@/lib/supabase/types";
import {
  parsearPlanilhaEmpresas, classificarLinhas, gerarModeloEmpresasXlsx,
  mapearReceita, normalizarTexto, soDigitos,
  type LinhaClassificada,
} from "@/lib/empresas/importar-empresas";

type Etapa = "upload" | "previa" | "fim";

function baixar(buffer: ArrayBuffer, nome: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const BADGE: Record<LinhaClassificada["status"], { cls: string; icon: typeof CheckCircle2; label: string }> = {
  valida: { cls: "bg-green-50 text-green-700", icon: CheckCircle2, label: "Válida" },
  duplicada: { cls: "bg-amber-50 text-amber-700", icon: AlertTriangle, label: "Duplicada" },
  erro: { cls: "bg-red-50 text-red-700", icon: XCircle, label: "Erro" },
};

export default function ImportarEmpresasModal({
  open,
  onClose,
  empresas,
  unidades,
}: {
  open: boolean;
  onClose: () => void;
  empresas: Empresa[];
  unidades: Unidade[];
}) {
  const importar = useImportarEmpresas();

  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivo, setArquivo] = useState<string>("");
  const [linhas, setLinhas] = useState<LinhaClassificada[]>([]);
  const [avisoParse, setAvisoParse] = useState<string>("");
  const [enriquecer, setEnriquecer] = useState(false);
  const [prog, setProg] = useState<{ atual: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<{ criadas: number; puladas: number; erros: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cnpjsExistentes = useMemo(
    () => new Set(empresas.map((e) => soDigitos(e.cnpj)).filter(Boolean)),
    [empresas],
  );
  const unidadePorNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of unidades) m.set(normalizarTexto(u.nome), u.id_unidade);
    return m;
  }, [unidades]);

  const contagem = useMemo(() => {
    let valida = 0, duplicada = 0, erro = 0, semUnidade = 0;
    for (const l of linhas) {
      if (l.status === "valida") valida++;
      else if (l.status === "duplicada") duplicada++;
      else erro++;
      if (l.status === "valida" && l.unidadeNome && !l.id_unidade) semUnidade++;
    }
    return { valida, duplicada, erro, semUnidade };
  }, [linhas]);

  function resetar() {
    setEtapa("upload");
    setArquivo("");
    setLinhas([]);
    setAvisoParse("");
    setEnriquecer(false);
    setProg(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function fechar() {
    resetar();
    onClose();
  }

  async function onFile(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const { linhas: brutas, aviso } = parsearPlanilhaEmpresas(buffer);
      if (aviso) {
        setAvisoParse(aviso);
        setLinhas([]);
      } else {
        setAvisoParse("");
        setLinhas(classificarLinhas(brutas, cnpjsExistentes, unidadePorNome));
      }
      setArquivo(file.name);
      setEtapa("previa");
    } catch (e) {
      toast.error(mensagemErro(e, "Não foi possível ler a planilha."));
    }
  }

  async function executarImportacao() {
    let validas = linhas.filter((l) => l.status === "valida");
    if (validas.length === 0) return;

    if (enriquecer) {
      const out = [...validas];
      for (let i = 0; i < out.length; i++) {
        setProg({ atual: i + 1, total: out.length });
        const l = out[i];
        const dig = soDigitos(l.cnpj);
        if (dig.length !== 14 || (l.municipio && l.uf && l.razao_social)) continue;
        try {
          const r = await fetch(`/api/cnpj/${dig}`);
          if (!r.ok) continue;
          const m = mapearReceita(await r.json());
          out[i] = {
            ...l,
            razao_social: l.razao_social ?? m.razao_social ?? null,
            municipio: l.municipio ?? m.municipio ?? null,
            uf: l.uf ?? m.uf ?? null,
            cep: l.cep ?? m.cep ?? null,
            logradouro: l.logradouro ?? m.logradouro ?? null,
            numero: l.numero ?? m.numero ?? null,
            bairro: l.bairro ?? m.bairro ?? null,
            telefone: l.telefone ?? m.telefone ?? null,
            email: l.email ?? m.email ?? null,
          };
        } catch {
          /* ignora — enriquecimento é best-effort */
        }
      }
      setProg(null);
      validas = out;
    }

    try {
      const criadas = await importar.mutateAsync(validas);
      setResultado({ criadas, puladas: contagem.duplicada, erros: contagem.erro });
      setEtapa("fim");
      toast.success(`${criadas} empresa(s) importada(s)`);
    } catch (e) {
      toast.error(mensagemErro(e, "Falha ao importar empresas."));
    }
  }

  const ocupado = importar.isPending || prog !== null;

  return (
    <Modal open={open} onClose={fechar} title="Importar empresas" size="xl">
      {/* ───── Passo 1: upload ───── */}
      {etapa === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Envie uma planilha <b>CSV</b> ou <b>Excel (.xlsx)</b> com as empresas. A única coluna
            obrigatória é <b>Nome</b>; as demais são opcionais.
          </p>

          <button
            type="button"
            onClick={() => baixar(gerarModeloEmpresasXlsx(), "modelo-importar-empresas.xlsx")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Download className="size-4" /> Baixar modelo (.xlsx)
          </button>

          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center transition hover:border-verde-primary hover:bg-verde-light/30"
          >
            <UploadCloud className="size-9 text-verde-primary" />
            <span className="text-sm font-semibold text-gray-800">Clique para escolher a planilha</span>
            <span className="text-xs text-gray-400">CSV ou XLSX · colunas reconhecidas: Nome, CNPJ, Razão Social, Grau de Risco, Unidade, Município, UF, CEP, Telefone, E-mail…</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
        </div>
      )}

      {/* ───── Passo 2: prévia ───── */}
      {etapa === "previa" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FileSpreadsheet className="size-4 text-verde-primary" />
            <span className="font-medium text-gray-700">{arquivo}</span>
          </div>

          {avisoParse ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {avisoParse}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-lg bg-green-50 px-3 py-1.5 font-medium text-green-700">{contagem.valida} válidas</span>
                <span className="rounded-lg bg-amber-50 px-3 py-1.5 font-medium text-amber-700">{contagem.duplicada} duplicadas</span>
                <span className="rounded-lg bg-red-50 px-3 py-1.5 font-medium text-red-700">{contagem.erro} com erro</span>
                {contagem.semUnidade > 0 && (
                  <span className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium text-gray-600">{contagem.semUnidade} sem unidade</span>
                )}
              </div>

              <div className="max-h-[320px] overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Nome</th>
                      <th className="px-2 py-2">CNPJ</th>
                      <th className="px-2 py-2">Unidade</th>
                      <th className="px-2 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.slice(0, 300).map((l, i) => {
                      const b = BADGE[l.status];
                      const Icon = b.icon;
                      const uNome = l.id_unidade
                        ? unidades.find((u) => u.id_unidade === l.id_unidade)?.nome
                        : null;
                      return (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1.5 font-medium text-gray-800">{l.nome_empresa || <span className="text-gray-300">—</span>}</td>
                          <td className="px-2 py-1.5 text-gray-500">{l.cnpj || "—"}</td>
                          <td className="px-2 py-1.5 text-gray-500">{uNome || <span className="text-gray-300">—</span>}</td>
                          <td className="px-2 py-1.5">
                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${b.cls}`}>
                              <Icon className="size-3" /> {b.label}
                            </span>
                            {l.motivo && <span className="ml-1.5 text-[11px] text-gray-400">{l.motivo}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {linhas.length > 300 && (
                  <p className="bg-gray-50 px-2 py-1.5 text-center text-[11px] text-gray-400">
                    Mostrando 300 de {linhas.length} linhas (todas as válidas serão importadas).
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={enriquecer}
                  onChange={(e) => setEnriquecer(e.target.checked)}
                  className="size-4 rounded border-gray-300 text-verde-primary focus:ring-verde-primary"
                />
                Completar dados pela Receita Federal (consulta cada CNPJ — mais lento)
              </label>

              {prog && (
                <div className="text-sm text-gray-500">
                  <Loader2 className="mr-1 inline size-4 animate-spin" />
                  Consultando Receita… {prog.atual}/{prog.total}
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={resetar}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft className="size-4" /> Trocar planilha
            </button>
            <button
              type="button"
              disabled={contagem.valida === 0 || ocupado}
              onClick={executarImportacao}
              className="inline-flex items-center gap-2 rounded-xl bg-verde-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Importar {contagem.valida} empresa(s)
            </button>
          </div>
        </div>
      )}

      {/* ───── Passo 3: fim ───── */}
      {etapa === "fim" && resultado && (
        <div className="space-y-5 py-4 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-green-50">
            <CheckCircle2 className="size-8 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{resultado.criadas} empresa(s) importada(s)</p>
            <p className="mt-1 text-sm text-gray-500">
              {resultado.puladas > 0 && <>{resultado.puladas} duplicada(s) ignorada(s). </>}
              {resultado.erros > 0 && <>{resultado.erros} com erro não importada(s).</>}
              {resultado.puladas === 0 && resultado.erros === 0 && "Tudo certo!"}
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={resetar}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Importar outra planilha
            </button>
            <button
              type="button"
              onClick={fechar}
              className="rounded-xl bg-verde-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-verde-accent"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
