"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Pencil,
  ChevronUp,
  ChevronDown,
  Factory,
  Download,
  X,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useFichasMaquina,
  useCriarFicha,
  useAtualizarFicha,
  useExcluirFicha,
  useReordenarFichas,
  useImportarInspecaoParaLaudo,
  type FichaMaquinaInput,
} from "@/lib/hooks/useFichasMaquina";
import { useApreciacaoMaquinasStore } from "@/lib/apreciacao-maquinas/store";
import { agruparFichasPorSetor, type FichaMaquina } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

/** Campos editáveis inline por máquina (mesma lista do handoff). */
const CAMPOS_FICHA: { key: keyof FichaMaquinaInput; label: string; placeholder?: string }[] = [
  { key: "equipamento", label: "Equipamento", placeholder: "Ex: Serra fita" },
  { key: "setor", label: "Setor", placeholder: "Ex: Açougue" },
  { key: "tipo", label: "Tipo", placeholder: "Ex: Serra para carnes" },
  { key: "modelo", label: "Modelo" },
  { key: "fabricante", label: "Fabricante" },
  { key: "serie", label: "Nº de série" },
  { key: "ano", label: "Ano" },
  { key: "capacidade", label: "Capacidade" },
];

function FormEdicaoFicha({
  ficha,
  idApreciacao,
  onFechar,
}: {
  ficha: FichaMaquina;
  idApreciacao: string;
  onFechar: () => void;
}) {
  const atualizar = useAtualizarFicha(idApreciacao);
  const [form, setForm] = useState<FichaMaquinaInput>({
    equipamento: ficha.equipamento,
    setor: ficha.setor,
    tipo: ficha.tipo,
    modelo: ficha.modelo,
    fabricante: ficha.fabricante,
    serie: ficha.serie,
    ano: ficha.ano,
    capacidade: ficha.capacidade,
  });

  async function salvar() {
    try {
      await atualizar.mutateAsync({
        id_ficha: ficha.id_ficha,
        ...form,
        // O nome exibido acompanha o equipamento — é o que sai no título da ficha.
        maquina_descricao: (form.equipamento ?? "")?.trim() || ficha.maquina_descricao,
      });
      toast.success("Máquina atualizada");
      onFechar();
    } catch {
      // erro tratado no hook
    }
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-2 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CAMPOS_FICHA.map((c) => (
          <label key={String(c.key)} className="block">
            <span className="mb-0.5 block text-[10px] font-semibold uppercase text-gray-500">
              {c.label}
            </span>
            <input
              type="text"
              value={(form[c.key] as string) ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, [c.key]: e.target.value || null }))
              }
              placeholder={c.placeholder}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
        >
          <X className="size-3" /> Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={atualizar.isPending}
          className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {atualizar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Salvar
        </button>
      </div>
    </div>
  );
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
  const excluir = useExcluirFicha(idApreciacao);
  const reordenar = useReordenarFichas(idApreciacao);
  const importar = useImportarInspecaoParaLaudo();

  const { fichaAtivaId, setFichaAtiva } = useApreciacaoMaquinasStore();
  const [editando, setEditando] = useState<string | null>(null);
  const [novaDescricao, setNovaDescricao] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState<string | null>(null);

  const { grupos, flat, seqDe } = agruparFichasPorSetor(fichas);

  async function handleAdicionar() {
    const nome = novaDescricao.trim();
    if (!nome) {
      toast.error("Descreva a máquina");
      return;
    }
    try {
      const ficha = await criar.mutateAsync({
        maquina_descricao: nome,
        equipamento: nome,
      });
      setNovaDescricao("");
      setAdicionando(false);
      setFichaAtiva(ficha.id_ficha);
      toast.success("Máquina adicionada — com checklist NR-12 próprio");
    } catch {
      // erro tratado no hook
    }
  }

  /**
   * Move a máquina uma posição dentro do PRÓPRIO setor. Reordenar entre setores
   * seria mudar o setor dela — isso se faz no botão editar.
   */
  async function moverNoGrupo(ficha: FichaMaquina, direcao: -1 | 1) {
    const grupo = grupos.find((g) => g.fichas.some((f) => f.id_ficha === ficha.id_ficha));
    if (!grupo) return;
    const i = grupo.fichas.findIndex((f) => f.id_ficha === ficha.id_ficha);
    const j = i + direcao;
    if (j < 0 || j >= grupo.fichas.length) return;

    const novaOrdemGrupo = [...grupo.fichas];
    [novaOrdemGrupo[i], novaOrdemGrupo[j]] = [novaOrdemGrupo[j], novaOrdemGrupo[i]];

    // Reconstrói a lista inteira preservando a ordem dos demais setores.
    const idsFinais = grupos.flatMap((g) =>
      (g.setor === grupo.setor ? novaOrdemGrupo : g.fichas).map((f) => f.id_ficha),
    );
    try {
      await reordenar.mutateAsync(idsFinais);
    } catch {
      // erro tratado no hook
    }
  }

  async function handleImportar() {
    if (!idEmpresa) {
      toast.error("O laudo precisa de uma empresa para importar da inspeção");
      return;
    }
    try {
      const r = await importar.mutateAsync({
        id_apreciacao: idApreciacao,
        id_empresa: idEmpresa,
      });
      if (r.importadas === 0) {
        toast("Nenhuma máquina nova na inspeção desta empresa", { icon: "ℹ️" });
      }
    } catch {
      // erro tratado no hook
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Loader2 className="size-3 animate-spin" /> Carregando máquinas...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">
          {flat.length === 0
            ? "Nenhuma máquina neste laudo."
            : `${flat.length} máquina(s) em ${grupos.length} setor(es).`}{" "}
          Cada máquina tem checklist, riscos e fotos próprios.
        </p>
        {!disabled && (
          <button
            type="button"
            onClick={handleImportar}
            disabled={importar.isPending || !idEmpresa}
            className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {importar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
            Importar da inspeção
          </button>
        )}
      </div>

      {grupos.map((grupo) => (
        <div key={grupo.setor} className="space-y-1">
          <div className="flex items-center gap-2 rounded bg-gray-100 px-2 py-1">
            <Factory className="size-3 text-gray-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
              {grupo.setor}
            </span>
            <span className="text-[10px] text-gray-400">({grupo.fichas.length})</span>
          </div>

          {grupo.fichas.map((ficha, i) => {
            const ativa = fichaAtivaId === ficha.id_ficha;
            return (
              <div
                key={ficha.id_ficha}
                className={cn(
                  "rounded-md border bg-white",
                  ativa ? "border-orange-400 ring-1 ring-orange-200" : "border-gray-200",
                )}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setFichaAtiva(ativa ? null : ficha.id_ficha)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-orange-700">
                      {seqDe(ficha)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-gray-800">
                        {ficha.maquina_descricao || ficha.equipamento || "Máquina sem nome"}
                      </span>
                      <span className="block truncate text-[10px] text-gray-500">
                        {[ficha.fabricante, ficha.modelo, ficha.serie && `Série ${ficha.serie}`]
                          .filter(Boolean)
                          .join(" · ") || "sem identificação"}
                      </span>
                    </span>
                  </button>

                  {!disabled && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moverNoGrupo(ficha, -1)}
                        disabled={i === 0 || reordenar.isPending}
                        title="Subir no setor"
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverNoGrupo(ficha, 1)}
                        disabled={i === grupo.fichas.length - 1 || reordenar.isPending}
                        title="Descer no setor"
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditando(editando === ficha.id_ficha ? null : ficha.id_ficha)
                        }
                        title="Editar identificação"
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-orange-600"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      {confirmandoExcluir === ficha.id_ficha ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await excluir.mutateAsync(ficha);
                            setConfirmandoExcluir(null);
                            if (ativa) setFichaAtiva(null);
                          }}
                          disabled={excluir.isPending}
                          className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-red-700"
                        >
                          {excluir.isPending ? "..." : "Confirmar"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmandoExcluir(ficha.id_ficha)}
                          title="Remover máquina do laudo"
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editando === ficha.id_ficha && !disabled && (
                  <FormEdicaoFicha
                    ficha={ficha}
                    idApreciacao={idApreciacao}
                    onFechar={() => setEditando(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {!disabled && adicionando && (
        <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-orange-200 bg-orange-50/30 p-2">
          <input
            type="text"
            value={novaDescricao}
            onChange={(e) => setNovaDescricao(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdicionar();
            }}
            placeholder="Nome da máquina (ex: Serra fita do açougue)"
            className={inputClass}
            autoFocus
          />
          <button
            type="button"
            onClick={handleAdicionar}
            disabled={criar.isPending}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {criar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            Adicionar
          </button>
          <button
            type="button"
            onClick={() => {
              setAdicionando(false);
              setNovaDescricao("");
            }}
            className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {!disabled && !adicionando && (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-orange-300 bg-orange-50/30 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100"
        >
          <Plus className="size-3.5" /> Adicionar máquina
        </button>
      )}
    </div>
  );
}
