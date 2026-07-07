"use client";

import { LinhasSkeleton } from "@/components/ui/PageSkeletons";

import { useState } from "react";
import {
  ClipboardCheck, Plus, Pencil, Trash2, Check, X, Loader2, Eye, EyeOff,
  ChevronDown, ChevronRight, CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  useAcaoOque, useAcaoComo,
  useCriarOque, useAtualizarOque, useExcluirOque,
  useCriarComo, useAtualizarComo, useExcluirComo,
  type AcaoOque, type AcaoComo,
} from "@/lib/hooks/useAcaoCatalogo";

type Alvo = { tipo: "oque" | "como"; id: string; titulo: string } | null;

export default function AcoesPlanoPage() {
  const canEdit = useCanEdit();
  const { data: oques = [], isLoading } = useAcaoOque();
  const { data: comos = [] } = useAcaoComo();
  const criarOque = useCriarOque();
  const excluirOque = useExcluirOque();
  const excluirComo = useExcluirComo();

  const [novoOque, setNovoOque] = useState("");
  const [alvo, setAlvo] = useState<Alvo>(null);

  function handleCriarOque() {
    const t = novoOque.trim();
    if (!t) return;
    criarOque.mutate(t, { onSuccess: () => setNovoOque("") });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 reveal-up">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-verde-light text-verde-primary">
            <ClipboardCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Plano de Ação — Base “O Quê → Como”</h1>
            <p className="text-xs text-gray-500">
              Catálogo das ações (O Quê) e, dentro de cada uma, as formas de execução (Como) usadas no Plano de Ação 5W2H.
              {oques.length > 0 ? ` ${oques.length} ação(ões) cadastrada(s).` : ""}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={novoOque}
              onChange={(e) => setNovoOque(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCriarOque()}
              placeholder="Nova ação (O Quê)..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleCriarOque}
              disabled={criarOque.isPending || !novoOque.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-3 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {criarOque.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Adicionar
            </button>
          </div>
        )}
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        {isLoading ? (
          <LinhasSkeleton bare linhas={5} />
        ) : oques.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Nenhuma ação cadastrada.{canEdit ? " Adicione um \"O Quê\" acima." : ""}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {oques.map((o) => (
              <OqueItem
                key={o.id}
                oque={o}
                comos={comos.filter((c) => c.id_oque === o.id)}
                canEdit={canEdit}
                onExcluir={(tipo, id, titulo) => setAlvo({ tipo, id, titulo })}
              />
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!alvo}
        variant="danger"
        title={alvo?.tipo === "oque" ? "Excluir ação (O Quê)?" : "Excluir Como?"}
        description={
          alvo
            ? alvo.tipo === "oque"
              ? `"${alvo.titulo}" e todos os "Como" vinculados serão removidos (recuperável na Lixeira). Não afeta planos já preenchidos.`
              : `"${alvo.titulo}" será removido (recuperável na Lixeira).`
            : ""
        }
        confirmLabel="Excluir"
        loading={excluirOque.isPending || excluirComo.isPending}
        onCancel={() => setAlvo(null)}
        onConfirm={() => {
          if (!alvo) return;
          const m = alvo.tipo === "oque" ? excluirOque : excluirComo;
          m.mutate(alvo.id, { onSuccess: () => setAlvo(null) });
        }}
      />
    </div>
  );
}

function OqueItem({
  oque,
  comos,
  canEdit,
  onExcluir,
}: {
  oque: AcaoOque;
  comos: AcaoComo[];
  canEdit: boolean;
  onExcluir: (tipo: "oque" | "como", id: string, titulo: string) => void;
}) {
  const atualizarOque = useAtualizarOque();
  const criarComo = useCriarComo();
  const atualizarComo = useAtualizarComo();

  const [aberto, setAberto] = useState(false);
  const [editOque, setEditOque] = useState(false);
  const [editOqueTxt, setEditOqueTxt] = useState(oque.titulo);
  const [novoComo, setNovoComo] = useState("");
  const [editComoId, setEditComoId] = useState<string | null>(null);
  const [editComoTxt, setEditComoTxt] = useState("");

  function salvarOque() {
    const t = editOqueTxt.trim();
    if (!t) return;
    atualizarOque.mutate({ id: oque.id, titulo: t }, { onSuccess: () => setEditOque(false) });
  }
  function adicionarComo() {
    const t = novoComo.trim();
    if (!t) return;
    criarComo.mutate({ id_oque: oque.id, titulo: t }, { onSuccess: () => { setNovoComo(""); setAberto(true); } });
  }
  function salvarComo() {
    if (!editComoId) return;
    const t = editComoTxt.trim();
    if (!t) return;
    atualizarComo.mutate({ id: editComoId, titulo: t }, { onSuccess: () => setEditComoId(null) });
  }

  return (
    <li className={cn(!oque.ativo && "bg-gray-50/60 opacity-60")}>
      {/* Linha do O Quê */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button type="button" onClick={() => setAberto((v) => !v)} className="rounded p-0.5 text-gray-400 hover:text-gray-700" title={aberto ? "Recolher" : "Expandir"}>
          {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        {editOque ? (
          <>
            <input
              autoFocus
              value={editOqueTxt}
              onChange={(e) => setEditOqueTxt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") salvarOque(); if (e.key === "Escape") setEditOque(false); }}
              className="flex-1 rounded-lg border border-verde-primary/40 px-2.5 py-1.5 text-sm"
            />
            <button type="button" onClick={salvarOque} disabled={atualizarOque.isPending} className="rounded-md p-1.5 text-verde-primary hover:bg-verde-light" title="Salvar"><Check className="size-4" /></button>
            <button type="button" onClick={() => setEditOque(false)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" title="Cancelar"><X className="size-4" /></button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setAberto((v) => !v)} className={cn("flex-1 text-left text-sm font-medium text-gray-800", !oque.ativo && "line-through")}>
              {oque.titulo}
            </button>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{comos.length} como</span>
            {canEdit && (
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => atualizarOque.mutate({ id: oque.id, ativo: !oque.ativo })} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title={oque.ativo ? "Desativar" : "Ativar"}>
                  {oque.ativo ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
                <button type="button" onClick={() => { setEditOque(true); setEditOqueTxt(oque.titulo); }} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Editar"><Pencil className="size-4" /></button>
                <button type="button" onClick={() => onExcluir("oque", oque.id, oque.titulo)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Excluir"><Trash2 className="size-4" /></button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sub-lista de Como */}
      {aberto && (
        <div className="space-y-1.5 border-t border-gray-100 bg-gray-50/40 px-4 py-3 pl-10">
          {comos.length === 0 && <p className="text-xs italic text-gray-400">Nenhum “Como” cadastrado para esta ação.</p>}
          {comos.map((c) => (
            <div key={c.id} className={cn("flex items-center gap-2", !c.ativo && "opacity-60")}>
              <CornerDownRight className="size-3.5 shrink-0 text-gray-300" />
              {editComoId === c.id ? (
                <>
                  <input
                    autoFocus
                    value={editComoTxt}
                    onChange={(e) => setEditComoTxt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") salvarComo(); if (e.key === "Escape") setEditComoId(null); }}
                    className="flex-1 rounded-md border border-verde-primary/40 px-2 py-1 text-sm"
                  />
                  <button type="button" onClick={salvarComo} disabled={atualizarComo.isPending} className="rounded p-1 text-verde-primary hover:bg-verde-light"><Check className="size-3.5" /></button>
                  <button type="button" onClick={() => setEditComoId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="size-3.5" /></button>
                </>
              ) : (
                <>
                  <span className={cn("flex-1 text-sm text-gray-700", !c.ativo && "line-through")}>{c.titulo}</span>
                  {canEdit && (
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => atualizarComo.mutate({ id: c.id, ativo: !c.ativo })} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title={c.ativo ? "Desativar" : "Ativar"}>
                        {c.ativo ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </button>
                      <button type="button" onClick={() => { setEditComoId(c.id); setEditComoTxt(c.titulo); }} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Editar"><Pencil className="size-3.5" /></button>
                      <button type="button" onClick={() => onExcluir("como", c.id, c.titulo)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Excluir"><Trash2 className="size-3.5" /></button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {canEdit && (
            <div className="mt-2 flex items-center gap-2">
              <CornerDownRight className="size-3.5 shrink-0 text-gray-300" />
              <input
                type="text"
                value={novoComo}
                onChange={(e) => setNovoComo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarComo()}
                placeholder='Novo "Como" para esta ação...'
                className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm"
              />
              <button type="button" onClick={adicionarComo} disabled={criarComo.isPending || !novoComo.trim()} className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50">
                {criarComo.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Como
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
