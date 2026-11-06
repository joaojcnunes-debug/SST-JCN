"use client";

// Consolidação › Intervenções (0.3.233, banco v321): o catálogo da etapa Intervenções da Conciliação.
// Nasceu da planilha do setor Psicossocial. Quem libera altera, insere e exclui.
// 0.3.240 (banco v327): modalidades e responsáveis são listas abertas. O que for inserido na etapa
// Intervenções da Conciliação também aparece aqui.

import { useState } from "react";
import { HeartHandshake, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Dica from "@/components/ui/Dica";
import Modal from "@/components/ui/Modal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { DICAS_COMERCIAL_INTERVENCAO } from "@/lib/dicas/comercial";
import { comOpcao, normalizarOpcao, opcoesDoCatalogo } from "@/lib/comercial/liberacao";
import {
  useCatalogoIntervencoes,
  useExcluirIntervencao,
  usePodeLiberarServicos,
  useSalvarIntervencao,
  type IntervencaoCatalogo,
} from "@/lib/hooks/useComercial";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20";

type Forma = Omit<IntervencaoCatalogo, "id_intervencao"> & { id_intervencao?: string };

export default function IntervencoesPage() {
  const { data: catalogo = [], isLoading, error } = useCatalogoIntervencoes();
  const excluir = useExcluirIntervencao();
  const pode = usePodeLiberarServicos();
  const [forma, setForma] = useState<Forma | null>(null);

  if (!pode) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600">
        O catálogo de intervenções é mantido por quem edita (Admin ou Técnico).
      </p>
    );
  }
  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar o catálogo. Tente de novo.</p>;
  }

  async function remover(i: IntervencaoCatalogo) {
    const ok = await confirmar({
      title: "Excluir esta intervenção?",
      description: `${i.nome} sai do catálogo. Os riscos em que ela já foi indicada continuam com o nome gravado.`,
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (ok) excluir.mutate(i.id_intervencao);
  }

  const proximaOrdem = catalogo.reduce((m, i) => Math.max(m, i.ordem), 0) + 1;

  return (
    <div className="space-y-4">
      <ConfirmHost />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <HeartHandshake className="size-5 text-marca-primary" /> Intervenções
          </h1>
          <p className="max-w-3xl text-sm text-gray-500">
            O que pode ser indicado aos riscos na Conciliação DRPS/QPS × AEP, com as modalidades e os responsáveis de cada uma. O que for inserido na
            Conciliação também aparece aqui.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForma({ nome: "", modalidades: [], observacao: "", responsaveis: [], ativo: true, ordem: proximaOrdem })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent"
        >
          <Plus className="size-4" /> Nova intervenção
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th className="px-3 py-2">Intervenção</th>
              <th className="px-3 py-2">Modalidades</th>
              <th className="px-3 py-2">Responsável</th>
              <th className="w-44 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {catalogo.map((i) => (
              <tr key={i.id_intervencao} className={cn(!i.ativo && "opacity-60")}>
                <td className="px-3 py-2">
                  <span className="font-medium text-gray-900">{i.nome}</span>
                  {!i.ativo && (
                    <Badge variant="muted" className="ml-2">
                      inativa
                    </Badge>
                  )}
                  {i.observacao && <span className="block text-xs text-gray-500">{i.observacao}</span>}
                </td>
                <td className="px-3 py-2 text-gray-700">{i.modalidades.join(", ") || "—"}</td>
                <td className="px-3 py-2 text-gray-700">{i.responsaveis.join(", ") || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setForma({ ...i, observacao: i.observacao ?? "" })}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="size-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(i)}
                      disabled={excluir.isPending}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="size-3.5" /> Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {catalogo.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-sm text-gray-500">
                  Nenhuma intervenção no catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {forma && <JanelaIntervencao inicial={forma} catalogo={catalogo} onFechar={() => setForma(null)} />}
    </div>
  );
}

/** Marcar as que valem aqui, entre tudo o que já existe, ou inserir outra. */
function ListaAberta({
  opcoes,
  marcadas,
  rotuloNovo,
  onMudar,
}: {
  opcoes: string[];
  marcadas: string[];
  rotuloNovo: string;
  onMudar: (lista: string[]) => void;
}) {
  const [novo, setNovo] = useState("");
  const inserir = () => {
    const v = normalizarOpcao(novo);
    if (v) onMudar(comOpcao(marcadas, v));
    setNovo("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {marcadas.reduce((acc, v) => comOpcao(acc, v), opcoes).map((m) => (
          <label key={m} className="inline-flex cursor-pointer items-center gap-1.5 text-gray-700">
            <input
              type="checkbox"
              checked={marcadas.includes(m)}
              onChange={(e) => onMudar(e.target.checked ? [...marcadas, m] : marcadas.filter((x) => x !== m))}
              className="size-4 accent-marca-primary"
            />
            {m}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              inserir();
            }
          }}
          placeholder={rotuloNovo}
          aria-label={rotuloNovo}
          className={inputCls}
        />
        <button type="button" onClick={inserir} disabled={!novo.trim()} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          Inserir
        </button>
      </div>
    </div>
  );
}

function JanelaIntervencao({ inicial, catalogo, onFechar }: { inicial: Forma; catalogo: IntervencaoCatalogo[]; onFechar: () => void }) {
  const salvar = useSalvarIntervencao();
  const [f, setF] = useState(inicial);
  const opcoes = opcoesDoCatalogo(catalogo);

  const gravar = () =>
    salvar.mutate(
      { ...f, nome: f.nome.trim(), observacao: f.observacao?.trim() || null },
      { onSuccess: onFechar },
    );

  return (
    <Modal
      open
      onClose={onFechar}
      title={f.id_intervencao ? "Editar intervenção" : "Nova intervenção"}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={gravar}
            disabled={!f.nome.trim() || salvar.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-60"
          >
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <label htmlFor="intervencao-nome" className="mb-1 block text-xs font-semibold text-gray-600">
            Nome <span className="text-red-600">*</span>
          </label>
          <input id="intervencao-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className={inputCls} />
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-gray-600">
            <Dica texto={DICAS_COMERCIAL_INTERVENCAO.modalidades}>Modalidades</Dica>
          </legend>
          <ListaAberta opcoes={opcoes.modalidades} marcadas={f.modalidades} rotuloNovo="Nova modalidade" onMudar={(modalidades) => setF({ ...f, modalidades })} />
        </fieldset>
        <div>
          <label htmlFor="intervencao-obs" className="mb-1 block text-xs font-semibold text-gray-600">
            <Dica texto={DICAS_COMERCIAL_INTERVENCAO.observacao}>Observação</Dica>
          </label>
          <textarea id="intervencao-obs" rows={2} value={f.observacao ?? ""} onChange={(e) => setF({ ...f, observacao: e.target.value })} className={inputCls} />
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-gray-600">Responsáveis (o primeiro marcado vem preenchido na Conciliação)</legend>
          <ListaAberta opcoes={opcoes.responsaveis} marcadas={f.responsaveis} rotuloNovo="Novo responsável" onMudar={(responsaveis) => setF({ ...f, responsaveis })} />
        </fieldset>
        <label className="inline-flex cursor-pointer items-center gap-2 text-gray-700">
          <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} className="size-4 accent-marca-primary" />
          <Dica texto={DICAS_COMERCIAL_INTERVENCAO.ativo}>Ativa</Dica>
        </label>
      </div>
    </Modal>
  );
}
