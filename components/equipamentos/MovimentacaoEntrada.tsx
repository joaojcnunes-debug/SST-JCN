"use client";

import { useMemo, useState } from "react";
import { Loader2, PackagePlus, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import {
  useEquipamentosCatalogo,
  useEquipamentosSaldo,
  useEquipamentosMovimentacoes,
  useLancarEntrada,
  useAjustarSaldo,
} from "@/lib/hooks/useEquipamentosEstoque";
import ProdutoCatalogoForm from "@/components/equipamentos/ProdutoCatalogoForm";
import { cn } from "@/lib/utils";

/**
 * Entrada de material — a porta do que chega SEM nota: doação, transferência de
 * contrato, reaproveitamento. A importação de NF-e cobre a compra formal e vive
 * na aba ao lado; travar tudo na nota emperraria o cadastro.
 *
 * Molde: `components/epi/EpiEstoqueTab.tsx` (130 linhas), que é o padrão de
 * entrada de material que a empresa já usa e a equipe já sabe operar.
 *
 * O AJUSTE DE CONTAGEM É DIFERENTE DO DO EPI, de propósito. Lá `ajuste` era um
 * tipo de movimento que só somava — quem contasse 10 na prateleira onde o
 * sistema diz 12 não tinha como lançar. Aqui a pessoa digita O QUE CONTOU e a
 * RPC calcula a diferença sozinha, para cima ou para baixo. Motivo é
 * obrigatório, e quem exige é o banco.
 */

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600";

type Modo = "entrada" | "ajuste";

export default function MovimentacaoEntrada({
  bases,
}: {
  bases: { id_unidade: string; nome: string }[];
}) {
  const { data: catalogo = [] } = useEquipamentosCatalogo();
  const { data: saldo } = useEquipamentosSaldo();
  const { data: movs = [] } = useEquipamentosMovimentacoes();
  const lancar = useLancarEntrada();
  const ajustar = useAjustarSaldo();

  const [modo, setModo] = useState<Modo>("entrada");
  const [idCatalogo, setIdCatalogo] = useState("");
  // O catálogo mora AQUI (pedido de 21/09/2026): quem dá entrada cadastra ou
  // corrige o produto sem sair da janela. "novo" abre vazio; "editar" abre o
  // produto escolhido.
  const [formProduto, setFormProduto] = useState<"fechado" | "novo" | "editar">("fechado");
  const [idUnidade, setIdUnidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [motivo, setMotivo] = useState("");

  const ativos = useMemo(() => catalogo.filter((c) => c.ativo), [catalogo]);
  const item = ativos.find((c) => c.id_catalogo === idCatalogo);
  const itemTemMovimento = useMemo(
    () => !!idCatalogo && movs.some((m) => m.id_catalogo === idCatalogo),
    [movs, idCatalogo],
  );

  const saldoAtual =
    idCatalogo && idUnidade ? (saldo?.get(`${idUnidade}|${idCatalogo}`) ?? 0) : null;

  const ocupado = lancar.isPending || ajustar.isPending;

  function limpar() {
    setQuantidade("");
    setFornecedor("");
    setNotaFiscal("");
    setMotivo("");
  }

  function salvar() {
    if (!idCatalogo) return toast.error("Escolha o item.");
    if (!idUnidade) return toast.error("Escolha a base.");
    const q = Number(String(quantidade).replace(",", "."));
    if (!Number.isFinite(q)) return toast.error("Quantidade inválida.");

    if (modo === "entrada") {
      if (!(q > 0)) return toast.error("A quantidade precisa ser maior que zero.");
      lancar.mutate(
        {
          id_catalogo: idCatalogo,
          id_unidade: idUnidade,
          quantidade: q,
          fornecedor: fornecedor.trim() || null,
          nota_fiscal: notaFiscal.trim() || null,
          observacao: motivo.trim() || null,
        },
        { onSuccess: limpar }
      );
      return;
    }

    // Ajuste: q é O QUE FOI CONTADO, não a diferença.
    if (q < 0) return toast.error("A contagem não pode ser negativa.");
    if (!motivo.trim())
      return toast.error("O ajuste exige motivo — é o que explica a diferença depois.");
    ajustar.mutate(
      {
        id_catalogo: idCatalogo,
        id_unidade: idUnidade,
        saldo_contado: q,
        motivo: motivo.trim(),
      },
      { onSuccess: limpar }
    );
  }

  if (ativos.length === 0 && formProduto === "fechado") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-center">
          <PackagePlus className="mx-auto size-7 text-amber-500" />
          <p className="mt-2 text-sm font-semibold text-amber-900">Nenhum produto cadastrado ainda</p>
          <p className="mt-1 text-sm text-amber-800">
            Cadastre o produto aqui mesmo. É o cadastro que diz se o item é controlado
            um a um (computador) ou por quantidade (mouse, headset, cabo).
          </p>
        </div>
        <ProdutoCatalogoForm onSalvo={(id) => { setIdCatalogo(id); setFormProduto("fechado"); }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Modo */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {(
          [
            { v: "entrada", label: "Dar entrada", icon: PackagePlus },
            { v: "ajuste", label: "Ajustar contagem", icon: SlidersHorizontal },
          ] as const
        ).map((m) => {
          const Icone = m.icon;
          return (
            <button
              key={m.v}
              type="button"
              onClick={() => setModo(m.v)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                modo === m.v
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Icone className="size-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Item *</label>
            <div className="flex gap-2">
              <select
                className={inputCls}
                value={idCatalogo}
                onChange={(e) => { setIdCatalogo(e.target.value); setFormProduto("fechado"); }}
              >
                <option value="">Selecione…</option>
                {ativos.map((c) => (
                  <option key={c.id_catalogo} value={c.id_catalogo}>
                    {c.nome}
                    {c.fabricante ? ` · ${c.fabricante}` : ""}
                    {c.tipo ? ` · ${c.tipo}` : ""}
                    {c.controla_individual ? " (um a um)" : " (quantidade)"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setFormProduto((f) => (f === "novo" ? "fechado" : "novo"))}
                title="Cadastrar um produto que ainda não está na lista"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-medium",
                  formProduto === "novo"
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                <Plus className="size-4" /> Novo
              </button>
              {item && (
                <button
                  type="button"
                  onClick={() => setFormProduto((f) => (f === "editar" ? "fechado" : "editar"))}
                  title="Corrigir nome, tipo, mínimo ou desativar este produto"
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-medium",
                    formProduto === "editar"
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <Pencil className="size-4" /> Editar
                </button>
              )}
            </div>
            {item?.controla_individual && formProduto === "fechado" && (
              <p className="mt-1 text-[11px] text-gray-500">
                Este item é controlado <strong>um a um</strong>. A entrada soma ao
                estoque; a ficha individual de cada aparelho nasce na retirada pelo
                colaborador.
              </p>
            )}
            {formProduto === "novo" && (
              <div className="mt-2">
                <ProdutoCatalogoForm
                  onSalvo={(id) => { setIdCatalogo(id); setFormProduto("fechado"); }}
                  onCancelar={() => setFormProduto("fechado")}
                />
              </div>
            )}
            {formProduto === "editar" && item && (
              <div className="mt-2">
                <ProdutoCatalogoForm
                  produto={item}
                  temMovimento={itemTemMovimento}
                  onSalvo={() => setFormProduto("fechado")}
                  onCancelar={() => setFormProduto("fechado")}
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Base *</label>
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

          <div>
            <label className={labelCls}>
              {modo === "entrada" ? "Quantidade *" : "Quanto você contou *"}
            </label>
            <input
              className={inputCls}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              inputMode="decimal"
              placeholder={modo === "entrada" ? "ex.: 10" : "ex.: 8"}
            />
            {saldoAtual !== null && (
              <p className="mt-1 text-[11px] text-gray-500">
                {modo === "entrada" ? (
                  <>
                    Saldo hoje nesta base: <strong>{saldoAtual}</strong>
                    {quantidade && Number(quantidade) > 0 && (
                      <> → ficará {saldoAtual + Number(String(quantidade).replace(",", "."))}</>
                    )}
                  </>
                ) : (
                  <>
                    O sistema diz <strong>{saldoAtual}</strong>. Digite o que está
                    na prateleira — a diferença é calculada sozinha.
                  </>
                )}
              </p>
            )}
          </div>

          {modo === "entrada" && (
            <>
              <div>
                <label className={labelCls}>Fornecedor</label>
                <input
                  className={inputCls}
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Nota fiscal</label>
                <input
                  className={inputCls}
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                  placeholder="se houver"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className={labelCls}>
              {modo === "entrada" ? "Observação" : "Motivo do ajuste *"}
            </label>
            <input
              className={inputCls}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                modo === "entrada"
                  ? "ex.: doação, sobra de contrato, compra avulsa…"
                  : "ex.: contagem de inventário, quebra não registrada…"
              }
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={salvar}
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {ocupado && <Loader2 className="size-4 animate-spin" />}
            {modo === "entrada" ? "Registrar entrada" : "Registrar ajuste"}
          </button>
        </div>
      </div>
    </div>
  );
}
