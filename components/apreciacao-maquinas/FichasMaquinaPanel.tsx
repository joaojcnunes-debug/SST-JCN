"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Cog,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Download,
  X,
  Pencil,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useFichasMaquina,
  useCriarFicha,
  useAtualizarFicha,
  useExcluirFicha,
  useReordenarFichas,
  type FichaMaquinaInput,
} from "@/lib/hooks/useFichasMaquina";
import { useApreciacaoEdicaoStore } from "@/lib/apreciacao-maquinas/store";
import {
  useInventarioMaquinas,
  useMaquinasInspecaoPendentes,
  useImportarMaquinasInspecao,
} from "@/lib/hooks/useInventarioMaquinas";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { FichaMaquina, Maquina } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

function nomeFicha(f: FichaMaquina): string {
  return f.equipamento || f.maquina_descricao || `Máquina ${f.numero_ordem}`;
}

export default function FichasMaquinaPanel({
  idApreciacao,
  idEmpresa,
  disabled = false,
}: {
  idApreciacao: string;
  idEmpresa: string | null;
  disabled?: boolean;
}) {
  const { data: fichas = [], isLoading } = useFichasMaquina(idApreciacao);
  const criar = useCriarFicha(idApreciacao);
  const atualizar = useAtualizarFicha(idApreciacao);
  const excluir = useExcluirFicha(idApreciacao);
  const reordenar = useReordenarFichas(idApreciacao);
  const fichaAtivaId = useApreciacaoEdicaoStore((s) => s.fichaAtivaId);
  const setFichaAtiva = useApreciacaoEdicaoStore((s) => s.setFichaAtiva);
  const { data: inventario = [] } = useInventarioMaquinas();
  const { data: pend } = useMaquinasInspecaoPendentes(idEmpresa);
  const pendentes = pend?.pendentes ?? [];
  const importar = useImportarMaquinasInspecao();

  const maquinasEmpresa = useMemo(
    () => inventario.filter((m) => !idEmpresa || m.id_empresa === idEmpresa),
    [inventario, idEmpresa]
  );

  // Hierarquia Empresa → Setor → Máquina: agrupa as fichas por setor.
  // Ordem dos setores pela 1ª aparição (menor numero_ordem); máquinas dentro
  // do setor pela numero_ordem. Robusto a numero_ordem interleaveado.
  const SEM_SETOR = "Sem setor";
  const grupos = useMemo(() => {
    const byNum = [...fichas].sort(
      (a, b) => (a.numero_ordem ?? 0) - (b.numero_ordem ?? 0)
    );
    const ordem: string[] = [];
    const map = new Map<string, FichaMaquina[]>();
    for (const f of byNum) {
      const key = f.setor && f.setor.trim() ? f.setor.trim() : SEM_SETOR;
      if (!map.has(key)) {
        map.set(key, []);
        ordem.push(key);
      }
      map.get(key)!.push(f);
    }
    return ordem.map((setor) => ({ setor, fichas: map.get(setor)! }));
  }, [fichas]);

  // Ordem "achatada" (agrupada) → numeração sequencial 1..N na hierarquia.
  const fichasOrdenadas = useMemo(
    () => grupos.flatMap((g) => g.fichas),
    [grupos]
  );
  const seqPorId = useMemo(() => {
    const m = new Map<string, number>();
    fichasOrdenadas.forEach((f, i) => m.set(f.id_ficha, i + 1));
    return m;
  }, [fichasOrdenadas]);

  // Auto-seleciona a 1ª ficha quando a ativa não pertence a este laudo.
  useEffect(() => {
    if (isLoading) return;
    if (fichas.length === 0) {
      if (fichaAtivaId !== null) setFichaAtiva(null);
      return;
    }
    if (!fichas.some((f) => f.id_ficha === fichaAtivaId)) {
      setFichaAtiva(fichas[0].id_ficha);
    }
  }, [fichas, isLoading, fichaAtivaId, setFichaAtiva]);

  const [addOpen, setAddOpen] = useState(false);
  const [modo, setModo] = useState<"inventario" | "descrever">("descrever");
  const [idMaquinaSel, setIdMaquinaSel] = useState("");
  const [descricao, setDescricao] = useState("");
  const [setorNovo, setSetorNovo] = useState("");
  const [confirmarExcluir, setConfirmarExcluir] = useState<string | null>(null);

  // Edição inline de uma máquina (dados de identificação da ficha).
  type EditForm = {
    equipamento: string;
    setor: string;
    tipo: string;
    modelo: string;
    fabricante: string;
    serie: string;
    ano: string;
    capacidade: string;
  };
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    equipamento: "",
    setor: "",
    tipo: "",
    modelo: "",
    fabricante: "",
    serie: "",
    ano: "",
    capacidade: "",
  });

  function abrirEdicao(f: FichaMaquina) {
    setConfirmarExcluir(null);
    setEditandoId(f.id_ficha);
    setEditForm({
      equipamento: f.equipamento || f.maquina_descricao || "",
      setor: f.setor ?? "",
      tipo: f.tipo ?? "",
      modelo: f.modelo ?? "",
      fabricante: f.fabricante ?? "",
      serie: f.serie ?? "",
      ano: f.ano ?? "",
      capacidade: f.capacidade ?? "",
    });
  }

  async function salvarEdicao(id_ficha: string) {
    const nome = editForm.equipamento.trim();
    if (!nome) {
      toast.error("Informe o equipamento / descrição da máquina.");
      return;
    }
    try {
      await atualizar.mutateAsync({
        id_ficha,
        equipamento: nome,
        maquina_descricao: nome,
        setor: editForm.setor.trim() || null,
        tipo: editForm.tipo.trim() || null,
        modelo: editForm.modelo.trim() || null,
        fabricante: editForm.fabricante.trim() || null,
        serie: editForm.serie.trim() || null,
        ano: editForm.ano.trim() || null,
        capacidade: editForm.capacidade.trim() || null,
      });
      setEditandoId(null);
      toast.success("Máquina atualizada");
    } catch {
      /* erro tratado no hook */
    }
  }

  async function handleAdicionar() {
    let input: FichaMaquinaInput;
    if (modo === "inventario") {
      const m = maquinasEmpresa.find((x) => x.id_maquina === idMaquinaSel);
      if (!m) {
        toast.error("Selecione uma máquina do inventário.");
        return;
      }
      input = {
        id_maquina: m.id_maquina,
        equipamento: m.nome,
        tipo: m.tipo,
        modelo: m.modelo,
        fabricante: m.marca,
        serie: m.numero_serie,
        ano: m.ano_fabricacao != null ? String(m.ano_fabricacao) : null,
        capacidade: m.capacidade_operacional,
        setor: m.setor,
      };
    } else {
      if (!descricao.trim()) {
        toast.error("Descreva a máquina.");
        return;
      }
      input = {
        maquina_descricao: descricao.trim(),
        equipamento: descricao.trim(),
        setor: setorNovo.trim() || null,
      };
    }
    try {
      const nova = await criar.mutateAsync(input);
      setFichaAtiva(nova.id_ficha);
      setAddOpen(false);
      setDescricao("");
      setSetorNovo("");
      setIdMaquinaSel("");
      toast.success("Máquina adicionada");
    } catch {
      /* erro tratado no hook */
    }
  }

  // Importa as máquinas de inspeções da empresa e já as adiciona como fichas.
  async function handleImportarPendentes() {
    try {
      await importar.mutateAsync(pendentes);
      const supabase = createSupabaseBrowserClient();
      const idsInsp = pendentes.map((p) => p.id_maquina_inspecao);
      const { data } = await supabase
        .from("inventario_maquinas")
        .select("*")
        .in("id_maquina_inspecao", idsInsp);
      const invMaqs = (data ?? []) as Maquina[];
      const jaNoLaudo = new Set(
        fichas.map((f) => f.id_maquina).filter(Boolean) as string[]
      );
      let add = 0;
      for (const m of invMaqs) {
        if (jaNoLaudo.has(m.id_maquina)) continue;
        const nova = await criar.mutateAsync({
          id_maquina: m.id_maquina,
          equipamento: m.nome,
          tipo: m.tipo,
          modelo: m.modelo,
          fabricante: m.marca,
          serie: m.numero_serie,
          ano: m.ano_fabricacao != null ? String(m.ano_fabricacao) : null,
          capacidade: m.capacidade_operacional,
          setor: m.setor,
        });
        if (add === 0) setFichaAtiva(nova.id_ficha);
        add++;
      }
      toast.success(
        add > 0
          ? `${add} máquina${add > 1 ? "s" : ""} da inspeção adicionada${add > 1 ? "s" : ""} ao laudo`
          : "As máquinas da inspeção já estão no laudo."
      );
    } catch {
      /* erro tratado no hook */
    }
  }

  // Reordena DENTRO do setor: troca com a máquina vizinha do mesmo grupo,
  // preservando a ordem agrupada (setores contíguos).
  function moverNoGrupo(
    grupoFichas: FichaMaquina[],
    idxNoGrupo: number,
    dir: -1 | 1
  ) {
    const alvo = idxNoGrupo + dir;
    if (alvo < 0 || alvo >= grupoFichas.length) return;
    const ids = fichasOrdenadas.map((f) => f.id_ficha);
    const ia = ids.indexOf(grupoFichas[idxNoGrupo].id_ficha);
    const ib = ids.indexOf(grupoFichas[alvo].id_ficha);
    [ids[ia], ids[ib]] = [ids[ib], ids[ia]];
    reordenar.mutate(ids);
  }

  async function handleExcluir(id: string) {
    try {
      await excluir.mutateAsync(id);
      setConfirmarExcluir(null);
      if (fichaAtivaId === id) setFichaAtiva(null);
      toast.success("Máquina removida");
    } catch {
      /* erro tratado no hook */
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:hidden">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-700">
          <Cog className="size-4 text-orange-600" /> Máquinas do laudo
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
            {fichas.length}
          </span>
        </h2>
        {!disabled && (
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-700"
          >
            <Plus className="size-3.5" /> Adicionar máquina
          </button>
        )}
      </div>

      {/* Banner: máquinas de inspeções da empresa ainda não neste laudo */}
      {!disabled && pendentes.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
          <p className="text-xs text-blue-800">
            <strong>{pendentes.length}</strong> máquina
            {pendentes.length > 1 ? "s" : ""} de inspeções desta empresa{" "}
            {pendentes.length > 1 ? "não estão" : "não está"} no laudo.
          </p>
          <button
            type="button"
            onClick={handleImportarPendentes}
            disabled={importar.isPending || criar.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {importar.isPending || criar.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Download className="size-3" />
            )}
            Adicionar da inspeção
          </button>
        </div>
      )}

      {/* Form de adicionar */}
      {!disabled && addOpen && (
        <div className="mb-3 rounded-md border-2 border-dashed border-orange-200 bg-orange-50/30 p-3 space-y-2">
          <div className="flex gap-3 text-xs">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={modo === "descrever"}
                onChange={() => setModo("descrever")}
              />
              Descrever
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={modo === "inventario"}
                onChange={() => setModo("inventario")}
              />
              Vincular do inventário
            </label>
          </div>

          {modo === "inventario" ? (
            <select
              value={idMaquinaSel}
              onChange={(e) => setIdMaquinaSel(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione a máquina…</option>
              {maquinasEmpresa.map((m) => (
                <option key={m.id_maquina} value={m.id_maquina}>
                  {m.nome}
                  {m.setor ? ` — ${m.setor}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className={inputClass}
                placeholder="Equipamento / descrição da máquina"
              />
              <input
                type="text"
                value={setorNovo}
                onChange={(e) => setSetorNovo(e.target.value)}
                className={inputClass}
                placeholder="Setor (opcional)"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdicionar}
              disabled={criar.isPending}
              className="inline-flex items-center gap-1 rounded bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {criar.isPending ? <Loader2 className="size-3 animate-spin" /> : null}
              Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Lista de fichas */}
      {isLoading ? (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Loader2 className="size-3 animate-spin" /> Carregando máquinas…
        </div>
      ) : fichas.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">
          Nenhuma máquina neste laudo ainda.
          {!disabled && ' Clique em "Adicionar máquina".'}
        </p>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <div key={g.setor}>
              {/* Cabeçalho do setor (Empresa → Setor → Máquina) */}
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                  {g.setor}
                </span>
                <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700">
                  {g.fichas.length}
                </span>
                <span className="h-px flex-1 bg-gray-100" />
              </div>
              <ul className="space-y-1.5 pl-1">
                {g.fichas.map((f, i) => {
                  const ativa = f.id_ficha === fichaAtivaId;
                  const editando = editandoId === f.id_ficha;
                  return (
                    <li
                      key={f.id_ficha}
                      className={cn(
                        "rounded-md border",
                        ativa
                          ? "border-orange-300 bg-orange-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setFichaAtiva(f.id_ficha)}
                          className="flex flex-1 items-center gap-2 text-left min-w-0"
                        >
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                              ativa
                                ? "bg-orange-600 text-white"
                                : "bg-gray-100 text-gray-500"
                            )}
                          >
                            {seqPorId.get(f.id_ficha)}
                          </span>
                          <span className="block truncate text-xs font-semibold text-gray-800">
                            {nomeFicha(f)}
                          </span>
                          {f.prioridade_manual && (
                            <span className="ml-1 shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                              PRIORIDADE
                            </span>
                          )}
                        </button>

                        {!disabled && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                editando ? setEditandoId(null) : abrirEdicao(f)
                              }
                              className={cn(
                                "rounded p-1 hover:bg-orange-50 hover:text-orange-600",
                                editando
                                  ? "bg-orange-100 text-orange-600"
                                  : "text-gray-400"
                              )}
                              aria-label="Editar máquina"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moverNoGrupo(g.fichas, i, -1)}
                              disabled={i === 0 || reordenar.isPending}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                              aria-label="Mover para cima"
                            >
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moverNoGrupo(g.fichas, i, 1)}
                              disabled={
                                i === g.fichas.length - 1 || reordenar.isPending
                              }
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                              aria-label="Mover para baixo"
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                            {confirmarExcluir === f.id_ficha ? (
                              <span className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleExcluir(f.id_ficha)}
                                  disabled={excluir.isPending}
                                  className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {excluir.isPending ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    "Confirmar"
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmarExcluir(null)}
                                  className="rounded p-1 text-gray-400 hover:bg-gray-100"
                                  aria-label="Cancelar"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmarExcluir(f.id_ficha)}
                                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Remover máquina"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Formulário de edição inline da máquina */}
                      {!disabled && editando && (
                        <div className="border-t border-orange-200 bg-orange-50/40 px-3 py-2.5 space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                Equipamento / Descrição
                              </span>
                              <input
                                type="text"
                                value={editForm.equipamento}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, equipamento: e.target.value }))
                                }
                                className={inputClass}
                                placeholder="Ex: Furadeira de bancada"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                Setor
                              </span>
                              <input
                                type="text"
                                value={editForm.setor}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, setor: e.target.value }))
                                }
                                className={inputClass}
                                placeholder="Ex: Produção"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                Tipo
                              </span>
                              <input
                                type="text"
                                value={editForm.tipo}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, tipo: e.target.value }))
                                }
                                className={inputClass}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                Modelo
                              </span>
                              <input
                                type="text"
                                value={editForm.modelo}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, modelo: e.target.value }))
                                }
                                className={inputClass}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                Fabricante
                              </span>
                              <input
                                type="text"
                                value={editForm.fabricante}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, fabricante: e.target.value }))
                                }
                                className={inputClass}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                Nº de série
                              </span>
                              <input
                                type="text"
                                value={editForm.serie}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, serie: e.target.value }))
                                }
                                className={inputClass}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                Ano
                              </span>
                              <input
                                type="text"
                                value={editForm.ano}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, ano: e.target.value }))
                                }
                                className={inputClass}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                Capacidade / Potência
                              </span>
                              <input
                                type="text"
                                value={editForm.capacidade}
                                onChange={(e) =>
                                  setEditForm((p) => ({ ...p, capacidade: e.target.value }))
                                }
                                className={inputClass}
                              />
                            </label>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditandoId(null)}
                              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => salvarEdicao(f.id_ficha)}
                              disabled={atualizar.isPending}
                              className="inline-flex items-center gap-1 rounded bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                            >
                              {atualizar.isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Save className="size-3" />
                              )}
                              Salvar
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
