"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, FileText, PackagePlus, Link2, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import {
  useEquipamentosCatalogo,
  useImportarNfe,
  useImportacoesNfe,
} from "@/lib/hooks/useEquipamentosEstoque";
import { parseNfe, type EpiNfeParsed } from "@/lib/equipamentos/nfe";
import { cn } from "@/lib/utils";

/**
 * Importação de NF-e — a porta da compra formal.
 *
 * O leitor de XML é o `lib/epi/nfe.ts`, reaproveitado inteiro: ler nota fiscal
 * eletrônica não tem nada de específico de EPI, e escrever um segundo parser
 * seria criar dois lugares para o mesmo bug.
 *
 * A REGRA QUE NÃO PODE CAIR: nada entra no saldo antes da conferência item a
 * item. O XML traz a descrição do fornecedor ("MOUSE OPT USB PRETO"), que quase
 * nunca é o nome que a JCN Consultoria usa. Por isso cada linha precisa ser VINCULADA a
 * um produto do catálogo, ou virar produto novo, ou ser ignorada — e essa
 * decisão é de quem confere, não do sistema.
 *
 * A chave da nota é única no sistema inteiro. Se a mesma nota for importada
 * duas vezes, o banco recusa e diz em qual base ela já entrou — sem isso o
 * saldo inflaria em silêncio.
 */

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600";

type StatusMap = "vinculado" | "novo" | "ignorado";

interface Linha {
  cprod: string;
  xprod: string;
  ncm: string;
  unidade_medida: string;
  quantidade: number;
  valor_unitario: number;
  status_map: StatusMap;
  id_catalogo: string;
  nome_novo: string;
  controla_individual: boolean;
}

export default function MovimentacaoNfe({
  bases,
}: {
  bases: { id_unidade: string; nome: string }[];
}) {
  const { data: catalogo = [] } = useEquipamentosCatalogo();
  const { data: historico = [] } = useImportacoesNfe();
  const importar = useImportarNfe();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [idUnidade, setIdUnidade] = useState("");
  const [nota, setNota] = useState<EpiNfeParsed | null>(null);
  const [xmlNome, setXmlNome] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);

  const ativos = catalogo.filter((c) => c.ativo);

  async function aoEscolherArquivo(file: File | null) {
    if (!file) return;
    try {
      const texto = await file.text();
      const p = parseNfe(texto);
      setNota(p);
      setXmlNome(file.name);
      // Palpite de vínculo: nome igual (sem caixa) já vem marcado. Não é
      // adivinhação agressiva de propósito — errar o vínculo mistura o saldo de
      // dois produtos, e desfazer isso depois é pior do que marcar à mão agora.
      setLinhas(
        p.itens.map((i) => {
          const achado = ativos.find(
            (c) => c.nome.trim().toLowerCase() === i.xprod.trim().toLowerCase()
          );
          return {
            cprod: i.cprod,
            xprod: i.xprod,
            ncm: i.ncm,
            unidade_medida: i.unidade,
            quantidade: i.quantidade,
            valor_unitario: i.valor_unitario,
            status_map: achado ? "vinculado" : "novo",
            id_catalogo: achado?.id_catalogo ?? "",
            nome_novo: achado ? "" : i.xprod,
            controla_individual: false,
          };
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o XML.");
    }
  }

  function setLinha(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  }

  function confirmar() {
    if (!idUnidade) return toast.error("Escolha a base que vai receber.");
    if (!nota) return;

    const semDestino = linhas.some(
      (l) => l.status_map === "vinculado" && !l.id_catalogo
    );
    if (semDestino)
      return toast.error("Há linhas marcadas como 'vincular' sem produto escolhido.");

    const semNome = linhas.some(
      (l) => l.status_map === "novo" && !l.nome_novo.trim()
    );
    if (semNome) return toast.error("Há produtos novos sem nome.");

    const aproveitados = linhas.filter((l) => l.status_map !== "ignorado");
    if (aproveitados.length === 0)
      return toast.error("Todas as linhas foram ignoradas — nada a importar.");

    importar.mutate(
      {
        id_unidade: idUnidade,
        chnfe: nota.chnfe,
        fornecedor_cnpj: nota.fornecedor_cnpj,
        fornecedor_nome: nota.fornecedor_nome,
        numero_nf: nota.numero_nf,
        data_emissao: nota.data_emissao,
        xml_nome: xmlNome,
        itens: linhas,
      },
      {
        onSuccess: () => {
          setNota(null);
          setLinhas([]);
          setXmlNome("");
          if (fileRef.current) fileRef.current.value = "";
        },
      }
    );
  }

  return (
    <div className="space-y-5">
      {!nota ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <FileText className="mx-auto size-8 text-gray-300" />
          <p className="mt-2 text-sm font-semibold text-gray-800">Importar NF-e</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Escolha o arquivo XML da nota. Nada entra no estoque antes de você
            conferir item a item — a descrição do fornecedor quase nunca é o nome
            que vocês usam.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            onChange={(e) => aoEscolherArquivo(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Upload className="size-4" />
            Escolher XML
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {nota.fornecedor_nome || "Fornecedor não identificado"}
              </p>
              <p className="text-xs text-gray-500">
                NF {nota.numero_nf} · emitida em{" "}
                {nota.data_emissao
                  ? new Date(nota.data_emissao + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—"}{" "}
                · {linhas.length} {linhas.length === 1 ? "item" : "itens"}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-gray-400">
                chNFe {nota.chnfe}
              </p>
            </div>
            <div className="min-w-[12rem]">
              <label className={labelCls}>Base que recebe *</label>
              <select
                className={inputCls}
                value={idUnidade}
                onChange={(e) => setIdUnidade(e.target.value)}
              >
                <option value="">Selecione…</option>
                {bases.map((u) => (
                  <option key={u.id_unidade} value={u.id_unidade}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-2 py-2">Na nota</th>
                  <th className="px-2 py-2 text-right">Qtd.</th>
                  <th className="px-2 py-2">O que fazer</th>
                  <th className="px-2 py-2">Produto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linhas.map((l, i) => (
                  <tr key={`${l.cprod}-${i}`} className={l.status_map === "ignorado" ? "opacity-45" : ""}>
                    <td className="px-2 py-1.5">
                      <span className="font-medium text-gray-900">{l.xprod}</span>
                      <span className="ml-1 font-mono text-[11px] text-gray-400">{l.cprod}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono tabular-nums text-gray-700">
                      {l.quantidade} {l.unidade_medida}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        {(
                          [
                            { v: "vinculado", label: "Vincular", icon: Link2 },
                            { v: "novo", label: "Criar", icon: PackagePlus },
                            { v: "ignorado", label: "Ignorar", icon: EyeOff },
                          ] as const
                        ).map((o) => {
                          const Icone = o.icon;
                          return (
                            <button
                              key={o.v}
                              type="button"
                              onClick={() => setLinha(i, { status_map: o.v })}
                              className={cn(
                                "inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[11px] font-medium transition-colors",
                                l.status_map === o.v
                                  ? "border-blue-500 bg-blue-50 text-blue-700"
                                  : "border-gray-200 text-gray-500 hover:border-gray-300"
                              )}
                            >
                              <Icone className="size-3" />
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      {l.status_map === "vinculado" && (
                        <select
                          className={inputCls}
                          value={l.id_catalogo}
                          onChange={(e) => setLinha(i, { id_catalogo: e.target.value })}
                        >
                          <option value="">Escolha o produto…</option>
                          {ativos.map((c) => (
                            <option key={c.id_catalogo} value={c.id_catalogo}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      )}
                      {l.status_map === "novo" && (
                        <div className="space-y-1">
                          <input
                            className={inputCls}
                            value={l.nome_novo}
                            onChange={(e) => setLinha(i, { nome_novo: e.target.value })}
                            placeholder="Nome do produto novo"
                          />
                          <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                            <input
                              type="checkbox"
                              checked={l.controla_individual}
                              onChange={(e) =>
                                setLinha(i, { controla_individual: e.target.checked })
                              }
                            />
                            controlar um a um (computador, notebook)
                          </label>
                        </div>
                      )}
                      {l.status_map === "ignorado" && (
                        <span className="text-xs text-gray-400">não entra no estoque</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setNota(null);
                setLinhas([]);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={importar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {importar.isPending && <Loader2 className="size-4 animate-spin" />}
              Conferir e dar entrada
            </button>
          </div>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Notas já importadas</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Fornecedor</th>
                  <th className="px-3 py-2">NF</th>
                  <th className="px-3 py-2 text-right">Itens</th>
                  <th className="px-3 py-2">Chave</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historico.map((h) => (
                  <tr key={h.id_importacao}>
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-500">
                      {new Date(h.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-1.5 text-gray-900">{h.fornecedor_nome ?? "—"}</td>
                    <td className="px-3 py-1.5 text-gray-600">{h.numero_nf ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-gray-600">
                      {h.itens_lancados ?? 0}/{h.total_itens ?? 0}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-gray-400">{h.chnfe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
