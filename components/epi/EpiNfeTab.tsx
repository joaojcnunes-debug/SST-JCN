"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { inputCls } from "./EpiModal";
import {
  useEpiCatalogo,
  useEpiImportacoes,
  useImportarNfe,
  type ImportarNfeItem,
} from "@/lib/hooks/useEpi";
import { parseNfeXml, NfeParseError } from "@/lib/epi/nfe";
import type { EpiNfeParsed } from "@/lib/epi/types";
import { fmtData } from "@/lib/utils";

type Acao = "existente" | "novo" | "ignorar";

interface LinhaConf {
  idCatalogo: string; // usado quando acao === "existente"
  acao: Acao;
}

export default function EpiNfeTab({
  empresaId,
  canEdit,
}: {
  empresaId: string;
  canEdit: boolean;
}) {
  const { data: catalogo = [] } = useEpiCatalogo(empresaId);
  const { data: importacoes = [] } = useEpiImportacoes(empresaId);
  const importar = useImportarNfe();
  const inputRef = useRef<HTMLInputElement>(null);

  const [nfe, setNfe] = useState<EpiNfeParsed | null>(null);
  const [xmlNome, setXmlNome] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaConf[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // sugere item existente quando o nome do produto casa com o catálogo
  function sugerir(xprod: string): LinhaConf {
    const alvo = xprod.trim().toLowerCase();
    const achado = catalogo.find((c) => c.nome.trim().toLowerCase() === alvo);
    if (achado) return { idCatalogo: achado.id, acao: "existente" };
    return { idCatalogo: "", acao: "novo" };
  }

  async function onArquivo(file: File) {
    setErro(null);
    try {
      const texto = await file.text();
      const parsed = parseNfeXml(texto);
      setNfe(parsed);
      setXmlNome(file.name);
      setLinhas(parsed.itens.map((it) => sugerir(it.xprod)));
    } catch (e) {
      setNfe(null);
      setXmlNome(null);
      setLinhas([]);
      setErro(
        e instanceof NfeParseError
          ? e.message
          : "Não foi possível ler o XML da NF-e."
      );
    }
  }

  function limpar() {
    setNfe(null);
    setXmlNome(null);
    setLinhas([]);
    setErro(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function setLinha(i: number, patch: Partial<LinhaConf>) {
    setLinhas((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
    );
  }

  const totalLancar = useMemo(
    () => linhas.filter((l) => l.acao !== "ignorar").length,
    [linhas]
  );

  function confirmar() {
    if (!nfe) return;
    const itens: ImportarNfeItem[] = nfe.itens.map((it, i) => {
      const l = linhas[i];
      const lancar = l.acao !== "ignorar";
      return {
        cprod: it.cprod,
        xprod: it.xprod,
        ncm: it.ncm,
        unidade: it.unidade,
        quantidade: it.quantidade,
        valor_unitario: it.valor_unitario,
        status_map: lancar ? "lancado" : "ignorado",
        id_catalogo: l.acao === "existente" ? l.idCatalogo || null : null,
        criar_novo: l.acao === "novo",
      };
    });
    importar.mutate(
      {
        empresa_id: empresaId,
        chnfe: nfe.chnfe,
        fornecedor_cnpj: nfe.fornecedor_cnpj,
        fornecedor_nome: nfe.fornecedor_nome,
        numero_nf: nfe.numero_nf,
        data_emissao: nfe.data_emissao,
        xml_nome: xmlNome,
        itens,
      },
      { onSuccess: limpar }
    );
  }

  // item "existente" sem seleção é inválido
  const conferenciaInvalida = linhas.some(
    (l) => l.acao === "existente" && !l.idCatalogo
  );

  if (!canEdit) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        A importação de NF-e é feita pela equipe da JCN Consultoria.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      {!nfe && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center shadow-sm">
          <FileUp className="mx-auto size-8 text-verde-primary" />
          <p className="mt-2 text-sm font-medium text-gray-800">
            Importar NF-e (XML)
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Envie o XML da nota de compra dos EPIs para conferir os itens e dar
            entrada no estoque.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <FileUp className="size-4" /> Selecionar XML
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onArquivo(f);
            }}
          />
          {erro && (
            <p className="mt-3 text-sm text-red-600">{erro}</p>
          )}
        </div>
      )}

      {/* Conferência */}
      {nfe && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FileText className="size-4 text-verde-primary" />
                NF-e {nfe.numero_nf ?? "—"}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {nfe.fornecedor_nome ?? "Fornecedor não identificado"}
                {nfe.data_emissao ? ` · ${fmtData(nfe.data_emissao)}` : ""}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-gray-400">
                chNFe {nfe.chnfe}
              </p>
            </div>
            <button
              type="button"
              onClick={limpar}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Trocar arquivo
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Produto (NF-e)</th>
                  <th className="px-3 py-2 font-semibold">Qtd.</th>
                  <th className="px-3 py-2 font-semibold">Destino no catálogo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nfe.itens.map((it, i) => {
                  const l = linhas[i];
                  return (
                    <tr key={`${it.cprod}-${i}`} className="align-top">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-800">
                          {it.xprod}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          cód {it.cprod || "—"}
                          {it.ncm ? ` · NCM ${it.ncm}` : ""}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">
                        {it.quantidade} {it.unidade}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1.5">
                          <select
                            className={inputCls}
                            value={l.acao}
                            onChange={(e) =>
                              setLinha(i, { acao: e.target.value as Acao })
                            }
                          >
                            <option value="novo">Criar novo EPI</option>
                            <option value="existente">
                              Vincular a EPI existente
                            </option>
                            <option value="ignorar">Ignorar item</option>
                          </select>
                          {l.acao === "existente" && (
                            <select
                              className={inputCls}
                              value={l.idCatalogo}
                              onChange={(e) =>
                                setLinha(i, { idCatalogo: e.target.value })
                              }
                            >
                              <option value="">Selecione o EPI…</option>
                              {catalogo.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nome}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {totalLancar} de {nfe.itens.length} itens darão entrada no estoque.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={limpar}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={
                  importar.isPending ||
                  totalLancar === 0 ||
                  conferenciaInvalida
                }
                className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {importar.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Importando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Confirmar entrada
                  </>
                )}
              </button>
            </div>
          </div>
          {conferenciaInvalida && (
            <p className="text-xs text-red-600">
              Selecione o EPI de destino para os itens marcados como “vincular a
              existente”.
            </p>
          )}
        </div>
      )}

      {/* Histórico de importações */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Importações anteriores
        </div>
        {importacoes.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            Nenhuma NF-e importada.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {importacoes.map((imp) => (
              <li
                key={imp.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <FileText className="size-4 shrink-0 text-verde-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-gray-800">
                    NF-e {imp.numero_nf ?? "—"}
                    {imp.fornecedor_nome ? ` · ${imp.fornecedor_nome}` : ""}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {fmtData(imp.criado_em)} · {imp.itens_lancados}/
                    {imp.total_itens} itens lançados
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                  <CheckCircle2 className="size-3" /> Importada
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
