"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Boxes, User } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAtualizarItemCatalogo,
  useCriarItemCatalogo,
  type EquipamentoCatalogo,
} from "@/lib/hooks/useEquipamentosEstoque";
import {
  TIPOS_EQUIPAMENTO,
  TIPO_OUTRO,
  controlePadraoDoTipo,
  ehPeriferico,
  tipoNaLista,
} from "@/lib/equipamentos/tipos";
import { cn } from "@/lib/utils";

/**
 * Formulário de PRODUTO do catálogo — o que a JCN Consultoria compra, não o que ela tem.
 *
 * Nasceu em 21/09/2026 do pedido de "passar as funcionalidades do Catálogo para
 * o Dar entrada": em vez de uma tela de administração separada, o produto é
 * criado (ou corrigido) NO MOMENTO em que a pessoa dá entrada nele. É o mesmo
 * formulário que a tela Catálogo tinha, mais a edição, que lá não existia.
 *
 * A DIFERENÇA QUE ESTE FORMULÁRIO EXISTE PARA REGISTRAR: `controla_individual`.
 *   • um a um   → computador, notebook. Cada aparelho vira uma ficha própria,
 *                 com série e plaqueta, porque cada um tem suas especificações.
 *   • quantidade → mouse, headset, cabo. Um cadastro só; o que existe por base
 *                 é um número. Mandar 2 para outra base tira 2 do saldo.
 *
 * O TIPO SUGERE O MODELO: escolher um tipo de "Periféricos" já marca "por
 * quantidade" (periférico não tem plaqueta). A pessoa pode trocar — mas, se o
 * produto já tem movimento, o modelo fica travado: mudar depois faria o saldo
 * e as fichas contarem a mesma coisa duas vezes.
 *
 * "Unidade" aqui é UNIDADE DE MEDIDA (un, par, cx). O nome antigo, "Unidade",
 * fez alguém gravar "Teresópolis" nesse campo — por isso o rótulo mudou.
 */

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600";

export default function ProdutoCatalogoForm({
  produto,
  temMovimento = false,
  onSalvo,
  onCancelar,
}: {
  /** Sem produto = criar. Com produto = editar. */
  produto?: EquipamentoCatalogo | null;
  /** true = já houve entrada/saída deste produto: o modelo de controle trava. */
  temMovimento?: boolean;
  onSalvo?: (id_catalogo: string) => void;
  onCancelar?: () => void;
}) {
  const criar = useCriarItemCatalogo();
  const atualizar = useAtualizarItemCatalogo();
  const editando = !!produto;

  const [nome, setNome] = useState("");
  const [tipoSel, setTipoSel] = useState("");
  const [tipoLivre, setTipoLivre] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [modelo, setModelo] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [minimo, setMinimo] = useState("");
  const [individual, setIndividual] = useState(true);
  const [ativo, setAtivo] = useState(true);
  // A pessoa mexeu no interruptor? Enquanto não mexe, o tipo decide.
  const [controleManual, setControleManual] = useState(false);

  useEffect(() => {
    if (!produto) return;
    setNome(produto.nome ?? "");
    const t = (produto.tipo ?? "").trim();
    if (!t) { setTipoSel(""); setTipoLivre(""); }
    else if (tipoNaLista(t)) { setTipoSel(t); setTipoLivre(""); }
    else { setTipoSel(TIPO_OUTRO); setTipoLivre(t); }
    setFabricante(produto.fabricante ?? "");
    setModelo(produto.modelo ?? "");
    setUnidade(produto.unidade_medida ?? "un");
    setMinimo(produto.estoque_minimo != null ? String(produto.estoque_minimo) : "");
    setIndividual(!!produto.controla_individual);
    setAtivo(produto.ativo !== false);
    setControleManual(true);
  }, [produto]);

  const tipo = tipoSel === TIPO_OUTRO ? tipoLivre.trim() : tipoSel;

  // O tipo sugere o modelo enquanto a pessoa não decidiu à mão.
  useEffect(() => {
    if (controleManual || editando) return;
    setIndividual(controlePadraoDoTipo(tipo || null));
  }, [tipo, controleManual, editando]);

  const ocupado = criar.isPending || atualizar.isPending;
  const periferico = useMemo(() => ehPeriferico(tipo || null), [tipo]);

  function salvar() {
    if (!nome.trim()) return toast.error("Informe o nome do produto.");
    const payload = {
      nome: nome.trim(),
      tipo: tipo || null,
      fabricante: fabricante.trim() || null,
      modelo: modelo.trim() || null,
      unidade_medida: unidade.trim() || "un",
      estoque_minimo: minimo ? Number(String(minimo).replace(",", ".")) : 0,
    };
    if (editando && produto) {
      atualizar.mutate(
        {
          id_catalogo: produto.id_catalogo,
          ...payload,
          ativo,
          ...(temMovimento ? {} : { controla_individual: individual }),
        },
        {
          onSuccess: () => {
            toast.success("Produto atualizado.");
            onSalvo?.(produto.id_catalogo);
          },
        },
      );
      return;
    }
    criar.mutate(
      { ...payload, controla_individual: individual },
      {
        onSuccess: (r) => {
          toast.success("Produto cadastrado.");
          onSalvo?.(r.id_catalogo);
        },
      },
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <p className="mb-3 text-sm font-semibold text-gray-800">
        {editando ? "Editar produto" : "Novo produto no catálogo"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Nome *</label>
          <input
            className={inputCls}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="ex.: Mouse Logitech M90"
            autoFocus={!editando}
          />
        </div>

        <div>
          <label className={labelCls}>Tipo</label>
          <select className={inputCls} value={tipoSel} onChange={(e) => setTipoSel(e.target.value)}>
            <option value="">—</option>
            {TIPOS_EQUIPAMENTO.map((g) => (
              <optgroup key={g.grupo} label={g.grupo}>
                {g.tipos.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </optgroup>
            ))}
            <option value={TIPO_OUTRO}>Outro (digitar)…</option>
          </select>
          {tipoSel === TIPO_OUTRO && (
            <input
              className={cn(inputCls, "mt-1")}
              value={tipoLivre}
              onChange={(e) => setTipoLivre(e.target.value)}
              placeholder="qual tipo?"
            />
          )}
          {periferico && (
            <p className="mt-1 text-[11px] text-emerald-700">
              Periférico: entra <b>por quantidade</b>, sem plaqueta.
            </p>
          )}
        </div>
        <div>
          <label className={labelCls}>Fabricante</label>
          <input className={inputCls} value={fabricante} onChange={(e) => setFabricante(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Modelo</label>
          <input className={inputCls} value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Unidade de medida</label>
            <input className={inputCls} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, par, cx…" />
          </div>
          <div>
            <label className={labelCls}>Estoque mínimo</label>
            <input className={inputCls} value={minimo} onChange={(e) => setMinimo(e.target.value)} inputMode="decimal" placeholder="0" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>Como este item é controlado? *</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { v: false, icone: Boxes, titulo: "Por quantidade", texto: "Mouse, headset, cabo. Um cadastro, um número por base." },
                { v: true, icone: User, titulo: "Um a um", texto: "Computador, notebook. Cada aparelho vira uma ficha com série e plaqueta." },
              ] as const
            ).map((op) => {
              const Icone = op.icone;
              const marcado = individual === op.v;
              const travado = editando && temMovimento;
              return (
                <button
                  key={String(op.v)}
                  type="button"
                  disabled={travado}
                  onClick={() => { setIndividual(op.v); setControleManual(true); }}
                  className={cn(
                    "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    marcado ? "border-blue-400 bg-white shadow-sm" : "border-gray-200 bg-white/60 hover:border-gray-300",
                    travado && "cursor-not-allowed opacity-70",
                  )}
                >
                  <Icone className={cn("mt-0.5 size-4 shrink-0", marcado ? "text-blue-600" : "text-gray-400")} />
                  <span>
                    <b>{op.titulo}</b>
                    <span className="block text-xs text-gray-500">{op.texto}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {editando && temMovimento && (
            <p className="mt-1 text-[11px] text-gray-500">
              Este produto já tem movimento; o modelo de controle não muda mais — senão o saldo e as fichas contariam a mesma coisa duas vezes.
            </p>
          )}
        </div>

        {editando && (
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4" />
            Produto ativo (desmarque para tirar da lista de entrada sem apagar o histórico)
          </label>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={ocupado}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {ocupado && <Loader2 className="size-4 animate-spin" />}
          {editando ? "Salvar produto" : "Cadastrar produto"}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
